'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  normalizeOpenCode,
  normalizeCommandCode,
  clampPercent,
  toIso,
  num,
} = require('../lib/normalize')

// 取自 2026-11-06 的真实响应（值已够用，不含任何凭据）。
const OPENCODE_SAMPLE = {
  usage: {
    rolling: { status: 'ok', percent: 1, resetsAt: '2026-11-06T08:36:54.000Z' },
    weekly: { status: 'ok', percent: 43, resetsAt: '2026-11-09T00:00:00.000Z' },
    monthly: { status: 'ok', percent: 21, resetsAt: '2026-12-02T13:46:36.000Z' },
  },
}

const COMMANDCODE_CREDITS = {
  credits: { belowThreshold: false, creditThreshold: 0, monthlyCredits: 66.8035057624, purchasedCredits: 0, freeCredits: 0 },
  windowLimits: {
    limited: true,
    exceeded: null,
    fiveHour: { used: 0.2729593776, cap: 14, exceeded: false, resetAt: 1793955076826 },
    weekly: { used: 3.1964942376, cap: 35, exceeded: false, resetAt: 1794464249429 },
  },
  sandboxAccess: true,
}

const COMMANDCODE_SUBSCRIPTION = {
  success: true,
  data: {
    id: 'sub_test',
    status: 'active',
    planId: 'individual-goat',
    currentPeriodStart: '2026-11-05T04:57:47.000Z',
    currentPeriodEnd: '2026-12-05T04:57:47.000Z',
  },
}

const COMMANDCODE_SUMMARY = {
  totalCount: 439,
  totalCost: 3.1948757255999998,
  successRate: 100,
  completedCount: 439,
  failedCount: 0,
  totalTokens: 13719490,
  periodBasis: 'billing-period',
  periodStart: '2026-11-05T04:57:47.000Z',
}

test('num / clampPercent 宽松转换', () => {
  assert.equal(num('3.5'), 3.5)
  assert.equal(num(''), null)
  assert.equal(num('abc'), null)
  assert.equal(num(null), null)
  assert.equal(clampPercent(120), 100)
  assert.equal(clampPercent(-5), 0)
  assert.equal(clampPercent(43.27), 43.3)
  assert.equal(clampPercent('x'), null)
})

test('toIso 兼容毫秒、秒、ISO 与无效值', () => {
  assert.equal(toIso(1793955076826), new Date(1793955076826).toISOString())
  assert.equal(toIso(1793955076), new Date(1793955076 * 1000).toISOString())
  assert.equal(toIso('2026-11-09T00:00:00.000Z'), '2026-11-09T00:00:00.000Z')
  assert.equal(toIso('not a date'), null)
  assert.equal(toIso(null), null)
})

test('normalizeOpenCode 输出三个窗口', () => {
  const entry = normalizeOpenCode(OPENCODE_SAMPLE, { displayName: 'OpenCode Go' })
  assert.equal(entry.provider, 'opencode-go')
  assert.equal(entry.kind, 'percent')
  assert.equal(entry.displayName, 'OpenCode Go')
  assert.deepEqual(entry.windows.map(item => item.id), ['rolling', 'weekly', 'monthly'])
  assert.deepEqual(entry.windows.map(item => item.label), ['5 小时', '本周', '本月'])
  assert.equal(entry.windows[1].percent, 43)
  assert.equal(entry.windows[2].resetsAt, '2026-12-02T13:46:36.000Z')
})

test('normalizeOpenCode 缺字段时抛错', () => {
  assert.throws(() => normalizeOpenCode({}, {}), /缺少 usage/)
  assert.throws(() => normalizeOpenCode({ usage: {} }, {}), /为空/)
})

test('normalizeCommandCode 拼出套餐、余额与三个窗口', () => {
  const entry = normalizeCommandCode({
    credits: COMMANDCODE_CREDITS,
    subscription: COMMANDCODE_SUBSCRIPTION,
    summary: COMMANDCODE_SUMMARY,
    whoami: { success: true, user: { userName: 'unison777', email: 'unison777@foxmail.com' } },
  }, { displayName: 'CommandCode GOAT' })

  assert.equal(entry.provider, 'commandcode')
  assert.equal(entry.kind, 'credits')
  assert.equal(entry.displayName, 'CommandCode GOAT')
  assert.equal(entry.plan.id, 'individual-goat')
  assert.equal(entry.plan.label, 'GOAT')
  assert.equal(entry.plan.monthlyLimit, 70)
  assert.equal(entry.balance.currency, 'USD')
  assert.ok(Math.abs(entry.balance.remaining - 66.8035057624) < 1e-9)
  assert.equal(entry.periodEnd, '2026-12-05T04:57:47.000Z')

  const byId = Object.fromEntries(entry.windows.map(item => [item.id, item]))
  assert.equal(byId.fiveHour.cap, 14)
  assert.ok(byId.fiveHour.percent > 1 && byId.fiveHour.percent < 3)
  assert.equal(byId.weekly.cap, 35)
  assert.equal(byId.weekly.resetsAt, new Date(1794464249429).toISOString())
  assert.ok(Math.abs(byId.monthly.used - 3.1964942376) < 1e-9)
  assert.ok(byId.monthly.percent > 4 && byId.monthly.percent < 5)
  assert.equal(byId.monthly.resetsAt, '2026-12-05T04:57:47.000Z')

  assert.equal(entry.summary.requests, 439)
  assert.equal(entry.summary.successRate, 100)
  assert.equal(entry.summary.tokens, 13719490)
  assert.equal(entry.account.name, 'unison777')
})

test('normalizeCommandCode 未知套餐时不猜百分比', () => {
  const entry = normalizeCommandCode({
    credits: COMMANDCODE_CREDITS,
    subscription: { success: true, data: { planId: 'individual-mystery', currentPeriodEnd: '2026-12-05T04:57:47.000Z' } },
  }, {})
  assert.equal(entry.plan.label, 'individual-mystery')
  assert.equal(entry.plan.monthlyLimit, null)
  const monthly = entry.windows.find(item => item.id === 'monthly')
  assert.equal(monthly.percent, null)
  assert.equal(monthly.used, null)
  assert.ok(monthly.cap === null)
})

test('normalizeCommandCode 缺 credits 时抛错', () => {
  assert.throws(() => normalizeCommandCode({}, {}), /缺少 credits/)
})
