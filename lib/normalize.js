'use strict'

// 归一化层：把两家服务商的原始响应整理成客户端好渲染的形状。
// 这里全部是纯函数，不碰网络、不碰 ctx，方便单元测试。

// CommandCode 各套餐的月度额度（美元）。与 commandcode.ai 的套餐页一致；
// 遇到未知套餐时只显示「剩余额度」，不硬猜百分比。
const COMMANDCODE_PLAN_MONTHLY = {
  'individual-go': 10,
  'individual-goat': 70,
  'individual-pro': 30,
  'individual-max': 150,
  'individual-ultra': 300,
}

const COMMANDCODE_PLAN_LABEL = {
  'individual-go': 'Go',
  'individual-goat': 'GOAT',
  'individual-pro': 'Pro',
  'individual-max': 'Max',
  'individual-ultra': 'Ultra',
}

/** 宽松取数：数字、数字字符串都能转，其余一律 null。 */
function num(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

/** 百分比夹到 0–100 并保留一位小数。 */
function clampPercent(value) {
  const n = num(value)
  if (n === null) return null
  if (n <= 0) return 0
  if (n >= 100) return 100
  return Math.round(n * 10) / 10
}

/**
 * 时间归一成 ISO 字符串。
 * CommandCode 的 resetAt 是毫秒时间戳（数字），OpenCode 的 resetsAt 是 ISO 字符串。
 * 同时兼容「秒」时间戳，避免拿到 1970 年的结果。
 */
function toIso(value) {
  const n = num(value)
  if (n !== null && n > 0) {
    const ms = n > 1e11 ? n : n * 1000
    const date = new Date(ms)
    return Number.isFinite(date.getTime()) ? date.toISOString() : null
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date.toISOString() : null
  }
  return null
}

/**
 * OpenCode Go 用量接口：
 * { usage: { rolling: { percent, status, resetsAt }, weekly: {...}, monthly: {...} } }
 */
function normalizeOpenCode(payload, meta) {
  const usage = payload && payload.usage
  if (!usage || typeof usage !== 'object') {
    throw new Error('OpenCode 响应缺少 usage 字段')
  }
  const labels = { rolling: '5 小时', weekly: '本周', monthly: '本月' }
  const windows = []
  for (const id of ['rolling', 'weekly', 'monthly']) {
    const source = usage[id]
    if (!source || typeof source !== 'object') continue
    windows.push({
      id,
      label: labels[id],
      percent: clampPercent(source.percent),
      status: typeof source.status === 'string' ? source.status : null,
      resetsAt: toIso(source.resetsAt),
    })
  }
  if (windows.length === 0) {
    throw new Error('OpenCode 响应的 usage 字段为空')
  }
  return {
    provider: 'opencode-go',
    displayName: (meta && meta.displayName) || 'OpenCode Go',
    kind: 'percent',
    windows,
  }
}

function windowFromLimit(id, label, limit) {
  if (!limit || typeof limit !== 'object') return null
  const used = num(limit.used)
  const cap = num(limit.cap)
  return {
    id,
    label,
    used,
    cap,
    percent: used !== null && cap !== null && cap > 0 ? clampPercent((used / cap) * 100) : null,
    resetsAt: toIso(limit.resetAt),
    exceeded: limit.exceeded === true,
  }
}

/**
 * CommandCode 用量：由四个端点拼装。
 *   /alpha/billing/credits        → 余额 + 5 小时/每周窗口
 *   /alpha/billing/subscriptions  → 套餐与计费周期（可选）
 *   /alpha/usage/summary          → 本周期请求数/成功率/花费（可选）
 *   /alpha/whoami                 → 账号（可选）
 */
function normalizeCommandCode(parts, meta) {
  const source = parts && parts.credits
  if (!source || typeof source !== 'object') {
    throw new Error('CommandCode 响应缺少 credits 字段')
  }
  const credits = source.credits && typeof source.credits === 'object' ? source.credits : {}
  const limits = source.windowLimits || credits.windowLimits || {}
  const remaining = num(credits.monthlyCredits)

  const subscription = parts.subscription && parts.subscription.data ? parts.subscription.data : null
  const planId = subscription && typeof subscription.planId === 'string'
    ? subscription.planId.toLowerCase()
    : null
  const planLabel = planId ? COMMANDCODE_PLAN_LABEL[planId] || planId : null
  const planLimit = planId ? num(COMMANDCODE_PLAN_MONTHLY[planId]) : null
  const periodEnd = subscription ? toIso(subscription.currentPeriodEnd) : null

  const windows = []
  const fiveHour = windowFromLimit('fiveHour', '5 小时', limits.fiveHour)
  const weekly = windowFromLimit('weekly', '本周', limits.weekly)
  if (fiveHour) windows.push(fiveHour)
  if (weekly) windows.push(weekly)

  // 月度窗口：额度来自套餐月额度，剩余来自 credits.monthlyCredits。
  if (remaining !== null) {
    const used = planLimit !== null ? Math.max(0, planLimit - remaining) : null
    windows.push({
      id: 'monthly',
      label: '本月',
      used,
      cap: planLimit,
      percent: used !== null && planLimit ? clampPercent((used / planLimit) * 100) : null,
      resetsAt: periodEnd,
      exceeded: false,
    })
  }

  const rawSummary = parts.summary && typeof parts.summary === 'object' ? parts.summary : null
  const summary = rawSummary
    ? {
        requests: num(rawSummary.totalCount !== undefined ? rawSummary.totalCount : rawSummary.requests),
        successRate: num(rawSummary.successRate),
        cost: num(rawSummary.totalCost),
        tokens: num(rawSummary.totalTokens),
        periodStart: toIso(rawSummary.periodStart),
      }
    : null

  const user = parts.whoami && parts.whoami.user ? parts.whoami.user : null

  return {
    provider: 'commandcode',
    displayName: (meta && meta.displayName) || 'CommandCode',
    kind: 'credits',
    plan: planId ? { id: planId, label: planLabel, monthlyLimit: planLimit } : null,
    balance: remaining === null
      ? null
      : { remaining, limit: planLimit, currency: 'USD' },
    windows,
    summary,
    periodEnd,
    account: user ? { name: user.userName || user.name || null, email: user.email || null } : null,
  }
}

module.exports = {
  COMMANDCODE_PLAN_MONTHLY,
  COMMANDCODE_PLAN_LABEL,
  num,
  clampPercent,
  toIso,
  normalizeOpenCode,
  normalizeCommandCode,
}
