'use strict'

// 给 agent 看的纯文本报告（工具输出 / 排错时直接读）。

function money(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return '$' + value.toFixed(2)
}

function percent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return String(value) + '%'
}

function windowLine(window) {
  const pieces = [window.label + '已用 ' + percent(window.percent)]
  if (typeof window.used === 'number' && typeof window.cap === 'number') {
    pieces.push(money(window.used) + ' / ' + money(window.cap))
  }
  if (window.resetsAt) pieces.push('重置 ' + window.resetsAt)
  if (window.exceeded) pieces.push('已超额')
  if (window.status && window.status !== 'ok') pieces.push('状态 ' + window.status)
  return '  - ' + pieces.join('，')
}

function formatEntry(entry) {
  const lines = []
  const title = entry.displayName || entry.provider
  if (entry.ok === false) {
    lines.push('【' + title + '】暂时取不到：' + (entry.error || '未知错误'))
    return lines
  }
  const tags = []
  if (entry.stale) tags.push('数据可能过期')
  if (entry.plan && entry.plan.label) tags.push('套餐 ' + entry.plan.label)
  if (entry.account && entry.account.name) tags.push('账号 ' + entry.account.name)
  lines.push('【' + title + '】' + (tags.length > 0 ? '（' + tags.join('，') + '）' : ''))
  if (entry.balance) {
    const limit = typeof entry.balance.limit === 'number' ? ' / ' + money(entry.balance.limit) : ''
    lines.push('  - 本月剩余 ' + money(entry.balance.remaining) + limit)
  }
  for (const window of entry.windows || []) lines.push(windowLine(window))
  if (entry.summary) {
    const bits = []
    if (typeof entry.summary.requests === 'number') bits.push(entry.summary.requests + ' 次请求')
    if (typeof entry.summary.successRate === 'number') bits.push('成功率 ' + entry.summary.successRate + '%')
    if (typeof entry.summary.cost === 'number') bits.push('花费 ' + money(entry.summary.cost))
    if (typeof entry.summary.tokens === 'number') bits.push('合计 ' + entry.summary.tokens + ' tokens')
    if (bits.length > 0) lines.push('  - 本周期：' + bits.join('，'))
  }
  return lines
}

function formatSnapshot(snapshot) {
  const entries = (snapshot && snapshot.entries) || []
  if (entries.length === 0) return '没有可用的用量数据。'
  const lines = []
  for (const entry of entries) {
    if (lines.length > 0) lines.push('')
    lines.push(...formatEntry(entry))
  }
  return lines.join('\n')
}

module.exports = { formatSnapshot, money, percent }
