'use strict'

// 宿主半：把两家的用量查好，通过同源只读路由交给客户端半渲染。
//
// 原则：
//   1. 密钥不落在插件代码里 —— 走 DSH 自己的 credentials 服务（ctx.credentials.resolve),
//      引用名直接取自 llm-pi-ai 里各 provider 的 apiKeyEnv。
//   2. 只读、只访问这两家的官方接口，不写任何文件。
//   3. 网络失败不覆盖上一次的有效数据（客户端会看到 stale 标记）。

const { normalizeOpenCode, normalizeCommandCode } = require('./lib/normalize')
const { formatSnapshot } = require('./lib/report')

const ROUTE_PATH = '/api/usage-hub'
const CACHE_TTL_MS = 60 * 1000
const REQUEST_TIMEOUT_MS = 15 * 1000
const ACCOUNT_TTL_MS = 30 * 60 * 1000
const SUBSCRIPTION_TTL_MS = 10 * 60 * 1000

// provider 名可能有别名，按顺序取第一个在 llm-pi-ai 里配置过的。
const OPENCODE_PROVIDERS = ['opencode-go', 'opencode', 'opencode-zen']
const COMMANDCODE_PROVIDERS = ['commandcode-goat', 'commandcode-go', 'commandcode-pro', 'commandcode-claude']

const FALLBACK = {
  opencode: {
    ref: 'OPENCODE_GO_API_KEY',
    base: 'https://opencode.ai/zen/go/v1',
    displayName: 'OpenCode Go',
  },
  commandcode: {
    ref: 'COMMANDCODE_GOAT_API_KEY',
    origin: 'https://api.commandcode.ai',
    displayName: 'CommandCode',
  },
}

// ── 小工具 ────────────────────────────────────────────────────────────────

function originOf(url) {
  if (typeof url !== 'string' || url === '') return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

function trimSlash(url) {
  return String(url).replace(/\/+$/, '')
}

function describeError(error) {
  if (!error) return '未知错误'
  const status = error.status
  if (status === 401 || status === 403) return '凭证无效或已过期（HTTP ' + status + '）'
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return '请求超时'
  const message = typeof error.message === 'string' ? error.message : String(error)
  return message.length > 120 ? message.slice(0, 120) + '…' : message
}

// ── ctx 取数 ──────────────────────────────────────────────────────────────

function providerEntry(ctx, names) {
  let docs = []
  try {
    const settings = ctx.get('settings')
    docs = settings && typeof settings.describe === 'function' ? settings.describe() : []
  } catch {
    docs = []
  }
  const entry = Array.isArray(docs) ? docs.find(doc => doc && doc.ns === 'llm-pi-ai') : null
  const providers = entry && entry.value && entry.value.providers ? entry.value.providers : {}
  for (const name of names) {
    const provider = providers[name]
    if (provider && typeof provider === 'object') return provider
  }
  return null
}

function providerMeta(ctx) {
  const opencode = providerEntry(ctx, OPENCODE_PROVIDERS)
  const commandcode = providerEntry(ctx, COMMANDCODE_PROVIDERS)
  return {
    opencode: {
      ref: (opencode && opencode.apiKeyEnv) || FALLBACK.opencode.ref,
      base: trimSlash((opencode && opencode.baseURL) || FALLBACK.opencode.base),
      displayName: (opencode && opencode.displayName) || FALLBACK.opencode.displayName,
    },
    commandcode: {
      ref: (commandcode && commandcode.apiKeyEnv) || FALLBACK.commandcode.ref,
      origin: originOf(commandcode && commandcode.baseURL) || FALLBACK.commandcode.origin,
      displayName: (commandcode && commandcode.displayName) || FALLBACK.commandcode.displayName,
    },
  }
}

async function resolveKey(ctx, ref) {
  const credentials = ctx.get('credentials')
  if (!credentials || typeof credentials.resolve !== 'function') {
    throw new Error('credentials 服务不可用')
  }
  const resolved = await credentials.resolve(ref)
  const value = typeof resolved === 'string' ? resolved : resolved && resolved.value
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('未配置 ' + ref + '（在设置 → 模型里填 API key）')
  }
  return value.trim()
}

async function fetchJson(url, key, extraHeaders) {
  const headers = Object.assign(
    { Authorization: 'Bearer ' + key, Accept: 'application/json' },
    extraHeaders || {},
  )
  const response = await fetch(url, {
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const text = await response.text()
  if (!response.ok) {
    const error = new Error('HTTP ' + response.status)
    error.status = response.status
    throw error
  }
  if (text === '') return null
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('响应不是合法 JSON')
  }
}

// ── 两个数据源 ────────────────────────────────────────────────────────────

async function loadOpenCode(ctx, meta) {
  const key = await resolveKey(ctx, meta.ref)
  const payload = await fetchJson(meta.base + '/usage', key)
  return normalizeOpenCode(payload, { displayName: meta.displayName })
}

async function loadCommandCode(ctx, meta, slow) {
  const key = await resolveKey(ctx, meta.ref)
  const headers = {
    'x-command-code-version': '1.0.0',
    'x-cli-environment': 'production',
  }
  const [credits, summary, subscription, whoami] = await Promise.allSettled([
    fetchJson(meta.origin + '/alpha/billing/credits', key, headers),
    fetchJson(meta.origin + '/alpha/usage/summary', key, headers),
    slow.get('subscription', SUBSCRIPTION_TTL_MS, () =>
      fetchJson(meta.origin + '/alpha/billing/subscriptions', key, headers)),
    slow.get('account', ACCOUNT_TTL_MS, () =>
      fetchJson(meta.origin + '/alpha/whoami', key, headers)),
  ])
  if (credits.status !== 'fulfilled') throw credits.reason || new Error('CommandCode 额度接口失败')
  const pick = result => (result.status === 'fulfilled' ? result.value : null)
  return normalizeCommandCode(
    { credits: credits.value, summary: pick(summary), subscription: pick(subscription), whoami: pick(whoami) },
    { displayName: meta.displayName },
  )
}

// ── 插件本体 ──────────────────────────────────────────────────────────────

module.exports.name = '@unison777/dsh-usage-hub'
module.exports.inject = []

module.exports.apply = function apply(ctx) {
  const cache = new Map()
  const slow = new Map()

  function slowGet(key, ttl, loader) {
    const held = slow.get(key)
    if (held && Date.now() - held.at < ttl) return Promise.resolve(held.value)
    return loader().then(
      value => {
        slow.set(key, { at: Date.now(), value })
        return value
      },
      () => (held ? held.value : null),
    )
  }

  async function refresh(id, loader) {
    try {
      const entry = await loader()
      const record = { at: Date.now(), ok: true, entry, stale: false, error: null }
      cache.set(id, record)
      return record
    } catch (error) {
      const message = describeError(error)
      const previous = cache.get(id)
      if (previous && previous.ok) {
        // 最后一次成功的数据仍有用：标 stale，不覆盖。
        const stale = Object.assign({}, previous, { stale: true, error: message })
        return stale
      }
      const record = {
        at: Date.now(),
        ok: false,
        stale: false,
        error: message,
        entry: { provider: id, displayName: id, kind: 'error', windows: [] },
      }
      cache.set(id, record)
      return record
    }
  }

  async function entryFor(id, loader, allowStale) {
    const held = cache.get(id)
    if (held && Date.now() - held.at < CACHE_TTL_MS) return held
    if (held && allowStale) {
      // 先给旧的，后台再刷。
      void refresh(id, loader)
      return Object.assign({}, held, { stale: true })
    }
    return refresh(id, loader)
  }

  async function snapshot(options) {
    const allowStale = !!(options && options.allowStale)
    const meta = providerMeta(ctx)
    const providers = (options && options.providers) || ['opencode', 'commandcode']

    const jobs = []
    if (providers.includes('opencode')) {
      jobs.push(entryFor('opencode-go', () => loadOpenCode(ctx, meta.opencode), allowStale))
    }
    if (providers.includes('commandcode')) {
      jobs.push(entryFor('commandcode', () => loadCommandCode(ctx, meta.commandcode, { get: slowGet }), allowStale))
    }

    const records = await Promise.all(jobs)
    return {
      capturedAt: new Date().toISOString(),
      entries: records.map(record => Object.assign({}, record.entry, {
        ok: record.ok,
        stale: record.stale === true,
        error: record.error || null,
      })),
    }
  }

  // ── 同源只读路由 ────────────────────────────────────────────────────────
  // ⚠️ 冷启动时插件可能比 webServer 服务先被 apply，这时 ctx.get('webServer')
  // 拿到的是 undefined，注册会静默跳过（客户端就只看到 404）。
  // 用 ctx.inject 等服务就绪再注册——DSH 官方插件也是这个写法。
  ctx.inject(['webServer'], webCtx => {
    const webServer = webCtx.webServer
    if (!webServer || typeof webServer.register !== 'function') {
      console.warn('[dsh-usage-hub] webServer 没有 register 方法，界面将取不到数据')
      return
    }
    webCtx.effect(() => webServer.register({
      kind: 'exact',
      path: ROUTE_PATH,
      handler: async (request, response) => {
        const connection = ctx.get('connection')
        const rejection = connection && typeof connection.requestRejection === 'function'
          ? connection.requestRejection(request)
          : undefined
        if (rejection !== undefined) {
          response.writeHead(rejection)
          response.end(rejection === 401 ? 'unauthorized' : 'forbidden')
          return
        }
        if (request.method !== 'GET') {
          response.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' })
          response.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }))
          return
        }
        try {
          const url = new URL(request.url, 'http://localhost')
          const requested = (url.searchParams.get('providers') || '')
            .split(',')
            .map(item => item.trim())
            .filter(Boolean)
          const value = await snapshot({
            allowStale: url.searchParams.get('allowStale') === '1',
            providers: requested.length > 0 ? requested : undefined,
          })
          response.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
          })
          response.end(JSON.stringify({ ok: true, value }))
        } catch (error) {
          response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
          response.end(JSON.stringify({ ok: false, error: describeError(error) }))
        }
      },
    }), 'dsh-usage-hub: route')
  })

  // ── 给 agent 的只读工具（可选，失败不影响界面） ──────────────────────────
  ctx.inject(['tools'], toolCtx => {
    try {
      const tools = toolCtx.tools
      if (!tools || typeof tools.register !== 'function') return
      const { defineTool } = require('@deepseek-ai/dsh-tools')
      if (typeof defineTool !== 'function') return
      tools.register(defineTool({
        name: 'usage_report',
        description: '查询 OpenCode Go 与 CommandCode GOAT 的订阅用量：5 小时 / 每周 / 每月窗口、剩余额度、重置时间，以及本计费周期的请求数与花费。',
        parameters: {},
        output: {
          schema: { type: 'string' },
          render: (_args, value) => [{ type: 'text', text: value }],
        },
        async execute() {
          const value = await snapshot({})
          return formatSnapshot(value)
        },
      }))
    } catch (error) {
      console.warn('[dsh-usage-hub] 工具注册跳过：' + describeError(error))
    }
  })

  return { snapshot }
}

// 供测试直接调用。
module.exports.__internals = {
  ROUTE_PATH,
  CACHE_TTL_MS,
  providerMeta,
  resolveKey,
  loadOpenCode,
  loadCommandCode,
  describeError,
  originOf,
  providerEntry,
  createSlowCache() {
    const slow = new Map()
    return {
      get(key, ttl, loader) {
        const held = slow.get(key)
        if (held && Date.now() - held.at < ttl) return Promise.resolve(held.value)
        return loader().then(
          value => {
            slow.set(key, { at: Date.now(), value })
            return value
          },
          () => (held ? held.value : null),
        )
      },
    }
  },
}
