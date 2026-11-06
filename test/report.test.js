'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { formatSnapshot } = require('../lib/report')

const SNAPSHOT = {
  capturedAt: '2026-11-06T08:00:00.000Z',
  entries: [
    {
      provider: 'opencode-go',
      displayName: 'OpenCode Go',
      kind: 'percent',
      ok: true,
      stale: false,
      error: null,
      windows: [
        { id: 'rolling', label: '5 小时', percent: 1, resetsAt: '2026-11-06T08:36:54.000Z', status: 'ok' },
        { id: 'weekly', label: '本周', percent: 43, resetsAt: '2026-11-09T00:00:00.000Z', status: 'ok' },
        { id: 'monthly', label: '本月', percent: 21, resetsAt: '2026-12-02T13:46:36.000Z', status: 'ok' },
      ],
    },
    {
      provider: 'commandcode',
      displayName: 'CommandCode GOAT',
      kind: 'credits',
      ok: true,
      stale: true,
      error: '请求超时',
      plan: { id: 'individual-goat', label: 'GOAT', monthlyLimit: 70 },
      balance: { remaining: 66.8, limit: 70, currency: 'USD' },
      windows: [
        { id: 'fiveHour', label: '5 小时', used: 0.27, cap: 14, percent: 1.9, resetsAt: '2026-11-06T08:51:16.000Z' },
      ],
      summary: { requests: 439, successRate: 100, cost: 3.19, tokens: 13719490 },
      account: { name: 'unison777', email: null },
    },
    { provider: 'x', displayName: '坏掉的来源', kind: 'error', ok: false, stale: false, error: '凭证无效或已过期（HTTP 401）', windows: [] },
  ],
}

test('formatSnapshot 输出两家报告', () => {
  const text = formatSnapshot(SNAPSHOT)
  assert.match(text, /【OpenCode Go】/)
  assert.match(text, /5 小时已用 1%/)
  assert.match(text, /本周已用 43%/)
  assert.match(text, /【CommandCode GOAT】.*账号 unison777/s)
  assert.match(text, /本月剩余 \$66\.80 \/ \$70\.00/)
  assert.match(text, /\$0\.27 \/ \$14\.00/)
  assert.match(text, /本周期：439 次请求，成功率 100%，花费 \$3\.19/)
  assert.match(text, /数据可能过期/)
  assert.match(text, /【坏掉的来源】暂时取不到：凭证无效或已过期（HTTP 401）/)
})

test('formatSnapshot 空数据', () => {
  assert.equal(formatSnapshot({ entries: [] }), '没有可用的用量数据。')
  assert.equal(formatSnapshot(null), '没有可用的用量数据。')
})
