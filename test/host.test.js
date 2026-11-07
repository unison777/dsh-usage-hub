'use strict'

// 联调测试：只有 USAGE_HUB_LIVE=1 且环境变量里有真实 key 时才跑。
//   $env:USAGE_HUB_LIVE='1'
//   $env:OPENCODE_GO_API_KEY='...'
//   $env:COMMANDCODE_GOAT_API_KEY='...'
//   node --test
// 平时（CI / 本地快速跑）自动跳过。

const test = require('node:test')
const assert = require('node:assert/strict')

const plugin = require('../index.js')

const live = process.env.USAGE_HUB_LIVE === '1'
const hasKeys = Boolean(process.env.OPENCODE_GO_API_KEY && process.env.COMMANDCODE_GOAT_API_KEY)
const skip = !live || !hasKeys ? '需要 USAGE_HUB_LIVE=1 与两个 provider key' : false

const PROVIDERS = {
  'opencode-go': {
    apiKeyEnv: 'OPENCODE_GO_API_KEY',
    baseURL: 'https://opencode.ai/zen/go/v1',
    displayName: 'OpenCode Go',
  },
  'commandcode-goat': {
    apiKeyEnv: 'COMMANDCODE_GOAT_API_KEY',
    baseURL: 'https://api.commandcode.ai/provider/v1',
    displayName: 'CommandCode GOAT',
  },
}

function fakeContext() {
  return {
    get(name) {
      if (name === 'settings') {
        return { describe: () => [{ ns: 'llm-pi-ai', value: { providers: PROVIDERS } }] }
      }
      if (name === 'credentials') {
        return { resolve: async ref => ({ value: process.env[ref] || '' }) }
      }
      return undefined
    },
    // 插件用 ctx.inject 等服务就绪（冷启动时 webServer 可能还没出现），这里同步回调。
    inject(_services, callback) {
      callback({
        webServer: { register: () => () => {} },
        get: () => undefined,
        effect: fn => { fn() },
      })
    },
    effect() {},
  }
}

test('live：两家都能取到用量', { skip }, async () => {
  const handle = plugin.apply(fakeContext())
  const snapshot = await handle.snapshot({})

  assert.equal(snapshot.entries.length, 2)
  const opencode = snapshot.entries.find(entry => entry.provider === 'opencode-go')
  const commandcode = snapshot.entries.find(entry => entry.provider === 'commandcode')

  assert.equal(opencode.ok, true, JSON.stringify(opencode))
  assert.equal(opencode.windows.length, 3, JSON.stringify(opencode))
  assert.equal(typeof opencode.windows[0].percent, 'number')

  assert.equal(commandcode.ok, true, JSON.stringify(commandcode))
  assert.ok(commandcode.balance && commandcode.balance.remaining > 0, JSON.stringify(commandcode))
  assert.equal(commandcode.windows.length, 3, JSON.stringify(commandcode))
  assert.ok(commandcode.windows.every(item => item.percent !== null), JSON.stringify(commandcode))

  console.log(JSON.stringify(snapshot, null, 2))
})

test('live：同一个实例第二次取数走缓存', { skip }, async () => {
  const handle = plugin.apply(fakeContext())
  const first = await handle.snapshot({})
  const started = Date.now()
  const second = await handle.snapshot({})
  assert.deepEqual(second.entries.map(entry => entry.provider), first.entries.map(entry => entry.provider))
  assert.ok(Date.now() - started < 2000, '命中缓存时应当很快返回')
})
