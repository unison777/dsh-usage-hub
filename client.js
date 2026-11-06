window.__ModuleLoader__.load({
  id: '@unison777/dsh-usage-hub',
  factory: function (require) {
    var React = require('react')
    var h = React.createElement
    var exports = {}

    var PANEL_CLS = 'uh-panel'
    var BTN_CLS = 'uh-btn'
    var STYLE_ID = 'dsh-usage-hub-style'
    var ROUTE = '/api/usage-hub'
    var REFRESH_MS = 60000
    var TICK_MS = 30000

    // ── 样式 ───────────────────────────────────────────────────────────────
    var CSS = [
      '.', BTN_CLS, '{display:inline-flex;align-items:center;gap:8px;min-width:0;height:32px;padding:0 10px;',
      'border:1px solid transparent;border-radius:8px;background:transparent;',
      'color:var(--dsw-alias-label-secondary,#5b6773);font:inherit;font-size:13px;line-height:20px;cursor:pointer}',
      '.', BTN_CLS, ':hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12))}',
      '.', BTN_CLS, '[data-compact="1"]{width:32px;padding:0;justify-content:center}',
      '.', BTN_CLS, ' .uh-dot{width:6px;height:6px;border-radius:50%;background:#e9a23b;flex:none}',
      '.', BTN_CLS, ' .uh-dot[data-level="full"]{background:#e5484d}',

      '.', PANEL_CLS, '{position:fixed;z-index:9998;left:12px;bottom:64px;width:328px;',
      'max-height:min(72vh,560px);overflow-y:auto;overflow-x:hidden;box-sizing:border-box;',
      'border-radius:14px;display:none;',
      '--uh-bg:#fff;--uh-fg:#1a2027;--uh-fg2:#5b6773;--uh-fg3:#8b98a5;--uh-border:rgba(16,24,32,.10);',
      '--uh-track:#e8edf2;--uh-card:#f7f9fb;--uh-shadow:0 10px 30px rgba(15,25,35,.16);--uh-brand:#4d6bfe;',
      '--uh-warn:#d98a1f;--uh-err:#d93a3f}',
      '.', PANEL_CLS, '[data-uh-theme="dark"]{--uh-bg:#1c2126;--uh-fg:#e8eef2;--uh-fg2:#9aa7b1;--uh-fg3:#6f7d88;',
      '--uh-border:rgba(255,255,255,.09);--uh-track:#2c343b;--uh-card:#222930;',
      '--uh-shadow:0 12px 34px rgba(0,0,0,.5);--uh-brand:#6f8bff;--uh-warn:#f0b44c;--uh-err:#ff6b6f}',
      '.', PANEL_CLS, '[data-open="1"]{display:block;animation:uh-in .16s ease-out}',
      '@keyframes uh-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
      '.', PANEL_CLS, '{background:var(--uh-bg);border:1px solid var(--uh-border);',
      'box-shadow:var(--uh-shadow);color:var(--uh-fg);',
      'font:12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,"Microsoft YaHei",sans-serif}',

      '.', PANEL_CLS, ' .uh-head{display:flex;align-items:center;gap:8px;padding:11px 13px;border-bottom:1px solid var(--uh-border)}',
      '.', PANEL_CLS, ' .uh-title{font-size:13px;font-weight:700;letter-spacing:.2px}',
      '.', PANEL_CLS, ' .uh-stamp{margin-left:auto;font-size:10.5px;color:var(--uh-fg3);font-variant-numeric:tabular-nums}',
      '.', PANEL_CLS, ' .uh-icon-btn{appearance:none;border:0;background:transparent;cursor:pointer;color:var(--uh-fg3);',
      'width:22px;height:22px;border-radius:6px;display:grid;place-items:center;font-size:14px;line-height:1;padding:0}',
      '.', PANEL_CLS, ' .uh-icon-btn:hover{background:var(--uh-track);color:var(--uh-fg)}',
      '.', PANEL_CLS, ' .uh-icon-btn[data-busy="1"]{animation:uh-spin .8s linear infinite}',
      '@keyframes uh-spin{to{transform:rotate(360deg)}}',

      '.', PANEL_CLS, ' .uh-body{padding:4px 8px 8px}',
      '.', PANEL_CLS, ' .uh-card{margin:8px 6px;padding:10px 10px 9px;border:1px solid var(--uh-border);',
      'border-radius:11px;background:var(--uh-card)}',
      '.', PANEL_CLS, ' .uh-card-head{display:flex;align-items:center;gap:6px;margin-bottom:7px}',
      '.', PANEL_CLS, ' .uh-name{font-size:12.5px;font-weight:700}',
      '.', PANEL_CLS, ' .uh-chip{margin-left:auto;font-size:9.5px;font-weight:700;letter-spacing:.4px;padding:1px 7px;',
      'border-radius:99px;background:rgba(77,107,254,.13);color:var(--uh-brand);text-transform:uppercase}',
      '.', PANEL_CLS, ' .uh-row{display:flex;align-items:center;gap:7px;padding:2.5px 0}',
      '.', PANEL_CLS, ' .uh-label{flex:none;width:44px;color:var(--uh-fg2)}',
      '.', PANEL_CLS, ' .uh-bar{flex:1;height:5px;border-radius:99px;background:var(--uh-track);overflow:hidden;min-width:24px}',
      '.', PANEL_CLS, ' .uh-fill{display:block;height:100%;border-radius:inherit;background:var(--uh-brand);transition:width .35s ease}',
      '.', PANEL_CLS, ' .uh-fill[data-level="warn"]{background:var(--uh-warn)}',
      '.', PANEL_CLS, ' .uh-fill[data-level="full"]{background:var(--uh-err)}',
      '.', PANEL_CLS, ' .uh-pct{flex:none;width:42px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600}',
      '.', PANEL_CLS, ' .uh-balance{margin-left:auto;font-variant-numeric:tabular-nums;font-weight:650}',
      '.', PANEL_CLS, ' .uh-balance .uh-frac{color:var(--uh-fg3);font-weight:500}',
      '.', PANEL_CLS, ' .uh-reset{flex:none;width:66px;text-align:right;color:var(--uh-fg3);font-size:10.5px;',
      'font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.', PANEL_CLS, ' .uh-note{margin-top:7px;padding-top:7px;border-top:1px dashed var(--uh-border);',
      'color:var(--uh-fg2);font-size:10.5px;display:flex;flex-wrap:wrap;gap:3px 12px}',
      '.', PANEL_CLS, ' .uh-empty{padding:16px 12px;text-align:center;color:var(--uh-fg3)}',
      '.', PANEL_CLS, ' .uh-error{color:var(--uh-err)}',
      '.', PANEL_CLS, ' .uh-warn-text{color:var(--uh-warn)}',
      '.', PANEL_CLS, ' .uh-muted{color:var(--uh-fg3)}',
      '.', PANEL_CLS, ' .uh-foot{padding:8px 14px 10px;border-top:1px solid var(--uh-border);',
      'color:var(--uh-fg3);font-size:10px;display:flex;align-items:center;gap:6px}',
    ].join('')

    function injectStyles() {
      if (document.getElementById(STYLE_ID)) return
      var style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = CSS
      document.head.appendChild(style)
    }

    // ── 格式化 ─────────────────────────────────────────────────────────────
    function esc(value) {
      return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    }

    function money(value) {
      if (typeof value !== 'number' || !isFinite(value)) return '—'
      return '$' + value.toFixed(2)
    }

    // 大数字缩写：22894175 → 22.9M
    function shortNumber(value) {
      if (typeof value !== 'number' || !isFinite(value)) return '—'
      if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M'
      if (value >= 1e3) return Math.round(value / 1e3) + 'K'
      return String(value)
    }

    function pct(value) {
      if (typeof value !== 'number' || !isFinite(value)) return '—'
      return (Math.round(value * 10) / 10) + '%'
    }

    function levelOf(value) {
      if (typeof value !== 'number' || !isFinite(value)) return 'ok'
      if (value >= 95) return 'full'
      if (value >= 80) return 'warn'
      return 'ok'
    }

    function countdown(iso, now) {
      if (!iso) return '—'
      var target = new Date(iso).getTime()
      if (!isFinite(target)) return '—'
      var diff = target - now
      if (diff <= 0) return '即将重置'
      var day = Math.floor(diff / 86400000)
      var hour = Math.floor((diff % 86400000) / 3600000)
      var minute = Math.floor((diff % 3600000) / 60000)
      if (day > 0) return day + '天' + (hour > 0 ? hour + '小时' : '')
      if (hour > 0) return hour + '小时' + (minute > 0 ? minute + '分' : '')
      return (minute > 0 ? minute : 1) + '分'
    }

    function clockOf(iso) {
      if (!iso) return ''
      var date = new Date(iso)
      if (!isFinite(date.getTime())) return ''
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }

    function absoluteOf(iso) {
      if (!iso) return ''
      var date = new Date(iso)
      if (!isFinite(date.getTime())) return ''
      return date.toLocaleString('zh-CN', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    }

    // ── 渲染 ───────────────────────────────────────────────────────────────
    function rowHtml(window, now, withMoney) {
      var level = levelOf(window.percent)
      var width = typeof window.percent === 'number' ? Math.max(2, Math.min(100, window.percent)) : 0
      var titleBits = []
      if (window.resetsAt) titleBits.push('重置 ' + absoluteOf(window.resetsAt))
      if (window.exceeded) titleBits.push('已超额')
      if (window.status && window.status !== 'ok') titleBits.push('状态 ' + window.status)

      var left = ''
      if (withMoney && typeof window.used === 'number' && typeof window.cap === 'number') {
        left = money(window.used) + ' / ' + money(window.cap)
      }

      return [
        '<div class="uh-row"' + (titleBits.length > 0 ? ' title="' + esc(titleBits.join(' · ')) + '"' : '') + '>',
        '<span class="uh-label">' + esc(window.label) + '</span>',
        '<span class="uh-bar"><i class="uh-fill" data-level="' + level + '" style="width:' + width + '%"></i></span>',
        '<span class="uh-pct">' + pct(window.percent) + '</span>',
        '<span class="uh-reset">' + esc(left || countdown(window.resetsAt, now)) + '</span>',
        '</div>',
      ].join('')
    }

    function cardHtml(entry, now) {
      var out = ['<div class="uh-card">']
      out.push('<div class="uh-card-head">')
      out.push('<span class="uh-name">' + esc(entry.displayName || entry.provider) + '</span>')
      if (entry.plan && entry.plan.label) {
        out.push('<span class="uh-chip">' + esc(entry.plan.label) + '</span>')
      } else if (entry.stale) {
        out.push('<span class="uh-chip">过期</span>')
      }
      out.push('</div>')

      if (entry.ok === false) {
        out.push('<div class="uh-row uh-error" title="' + esc(entry.error || '') + '">暂时取不到：' + esc(entry.error || '未知错误') + '</div>')
        out.push('</div>')
        return out.join('')
      }

      // 余额（CommandCode）：一行显示「剩余 / 月额度」，不占用进度条
      if (entry.balance) {
        var fraction = typeof entry.balance.limit === 'number'
          ? ' <span class="uh-frac">/ ' + esc(money(entry.balance.limit)) + '</span>'
          : ''
        out.push('<div class="uh-row" title="本月剩余额度">')
        out.push('<span class="uh-label">余额</span>')
        out.push('<span class="uh-balance">' + esc(money(entry.balance.remaining)) + fraction + '</span>')
        out.push('</div>')
      }

      for (var i = 0; i < (entry.windows || []).length; i++) {
        out.push(rowHtml(entry.windows[i], now, entry.kind === 'credits'))
      }

      if (entry.stale && entry.error) {
        out.push('<div class="uh-note uh-warn-text">上次刷新失败：' + esc(entry.error) + '</div>')
      }

      // 本周期统计（CommandCode）
      if (entry.summary) {
        var bits = []
        if (typeof entry.summary.requests === 'number') bits.push(entry.summary.requests + ' 次')
        if (typeof entry.summary.successRate === 'number') bits.push('成功率 ' + entry.summary.successRate + '%')
        if (typeof entry.summary.cost === 'number') bits.push('花费 ' + money(entry.summary.cost))
        if (typeof entry.summary.tokens === 'number') bits.push(shortNumber(entry.summary.tokens) + ' tokens')
        if (bits.length > 0) {
          out.push('<div class="uh-note"><span class="uh-muted">本周期</span>' + esc(bits.join(' · ')) + '</div>')
        }
      }

      out.push('</div>')
      return out.join('')
    }

    function bodyHtml(snapshot, error, now) {
      if (!snapshot || !snapshot.entries || snapshot.entries.length === 0) {
        if (error) return '<div class="uh-empty uh-error">' + esc(error) + '</div>'
        return '<div class="uh-empty">正在读取用量…</div>'
      }
      var out = snapshot.entries.map(function (entry) { return cardHtml(entry, now) }).join('')
      if (error) out += '<div class="uh-empty uh-error">' + esc(error) + '</div>'
      return out
    }

    // ── 面板（纯 DOM，避免被侧栏的 overflow/transform 裁剪） ────────────────
    function detectTheme() {
      try {
        var bg = getComputedStyle(document.body).backgroundColor || ''
        var match = /rgba?\(([^)]+)\)/.exec(bg)
        if (!match) return 'light'
        var parts = match[1].split(',').map(function (item) { return parseFloat(item.trim()) })
        if (parts.length < 3) return 'light'
        var luminance = (0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]) / 255
        var alpha = parts.length > 3 ? parts[3] : 1
        if (alpha === 0) return 'light'
        return luminance < 0.5 ? 'dark' : 'light'
      } catch (e) {
        return 'light'
      }
    }

    function createPanel() {
      var wrap = document.createElement('div')
      wrap.className = PANEL_CLS
      wrap.setAttribute('data-open', '0')
      wrap.innerHTML = [
        '<div class="uh-head">',
        '<span class="uh-title">用量</span>',
        '<span class="uh-stamp" data-role="stamp"></span>',
        '<button type="button" class="uh-icon-btn" data-role="refresh" title="立即刷新">↻</button>',
        '<button type="button" class="uh-icon-btn" data-role="close" title="关闭">×</button>',
        '</div>',
        '<div class="uh-body" data-role="body"><div class="uh-empty">正在读取用量…</div></div>',
        '<div class="uh-foot"><span data-role="foot">每 60 秒自动刷新</span></div>',
      ].join('')

      var body = wrap.querySelector('[data-role="body"]')
      var stamp = wrap.querySelector('[data-role="stamp"]')
      var foot = wrap.querySelector('[data-role="foot"]')
      var refreshBtn = wrap.querySelector('[data-role="refresh"]')

      var state = { snapshot: null, error: null, busy: false, open: false }
      var listeners = []
      var level = 'ok'
      var tickTimer = null
      var refreshTimer = null

      function computeLevel() {
        var worst = 'ok'
        var entries = (state.snapshot && state.snapshot.entries) || []
        for (var i = 0; i < entries.length; i++) {
          var windows = entries[i].windows || []
          for (var j = 0; j < windows.length; j++) {
            var next = levelOf(windows[j].percent)
            if (next === 'full') return 'full'
            if (next === 'warn') worst = 'warn'
          }
        }
        return worst
      }

      function notify() {
        var next = computeLevel()
        if (next === level && listeners.length === 0) return
        level = next
        for (var i = 0; i < listeners.length; i++) {
          try { listeners[i]() } catch (e) { /* 忽略单个订阅者的异常 */ }
        }
      }

      function render() {
        var now = Date.now()
        body.innerHTML = bodyHtml(state.snapshot, state.error, now)
        var captured = state.snapshot && state.snapshot.capturedAt
        stamp.textContent = captured ? clockOf(captured) : ''
        stamp.title = captured ? '更新于 ' + absoluteOf(captured) : ''
        foot.textContent = state.busy
          ? '正在刷新…'
          : '每 60 秒自动刷新' + (state.snapshot && state.snapshot.entries ? ' · ' + state.snapshot.entries.length + ' 个来源' : '')
        if (refreshBtn) refreshBtn.setAttribute('data-busy', state.busy ? '1' : '0')
        notify()
      }

      async function load(allowStale) {
        if (state.busy) return
        state.busy = true
        render()
        try {
          var url = ROUTE + '?allowStale=' + (allowStale ? '1' : '0')
          var response = await fetch(url, { headers: { Accept: 'application/json' } })
          var json = await response.json().catch(function () { return null })
          if (!response.ok || !json || json.ok !== true) {
            throw new Error((json && json.error) || ('HTTP ' + response.status))
          }
          state.snapshot = json.value
          state.error = null
        } catch (e) {
          state.error = '读取用量失败：' + String((e && e.message) || e)
        } finally {
          state.busy = false
          render()
        }
      }

      function startTimers() {
        stopTimers()
        tickTimer = setInterval(render, TICK_MS)
        refreshTimer = setInterval(function () { void load(false) }, REFRESH_MS)
      }

      function stopTimers() {
        if (tickTimer) clearInterval(tickTimer)
        if (refreshTimer) clearInterval(refreshTimer)
        tickTimer = null
        refreshTimer = null
      }

      function open() {
        if (state.open) return
        state.open = true
        wrap.setAttribute('data-uh-theme', detectTheme())
        wrap.setAttribute('data-open', '1')
        void load(true)
        startTimers()
      }

      function close() {
        if (!state.open) return
        state.open = false
        wrap.setAttribute('data-open', '0')
        stopTimers()
      }

      function toggle() {
        if (state.open) close()
        else open()
      }

      refreshBtn.addEventListener('click', function (event) {
        event.stopPropagation()
        void load(false)
      })
      wrap.querySelector('[data-role="close"]').addEventListener('click', function (event) {
        event.stopPropagation()
        close()
      })

      function onDocumentClick(event) {
        if (!state.open) return
        var target = event.target
        if (wrap.contains(target)) return
        if (target && target.closest && target.closest('.' + BTN_CLS)) return
        close()
      }

      function onKeyDown(event) {
        if (event.key === 'Escape' && state.open) close()
      }

      document.addEventListener('mousedown', onDocumentClick, true)
      document.addEventListener('keydown', onKeyDown, true)

      return {
        wrap: wrap,
        toggle: toggle,
        open: open,
        close: close,
        isOpen: function () { return state.open },
        refresh: function () { void load(false) },
        setTheme: function (theme) { wrap.setAttribute('data-uh-theme', theme) },
        subscribe: function (listener) {
          listeners.push(listener)
          return function () {
            var index = listeners.indexOf(listener)
            if (index >= 0) listeners.splice(index, 1)
          }
        },
        getLevel: function () { return level },
        dispose: function () {
          stopTimers()
          document.removeEventListener('mousedown', onDocumentClick, true)
          document.removeEventListener('keydown', onKeyDown, true)
          listeners.length = 0
          if (wrap.parentNode) wrap.parentNode.removeChild(wrap)
        },
      }
    }

    // ── 侧栏按钮 ───────────────────────────────────────────────────────────
    var ICON = h('svg', {
      viewBox: '0 0 16 16',
      width: 16,
      height: 16,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.6,
      strokeLinecap: 'round',
      'aria-hidden': 'true',
    },
    h('path', { d: 'M2.6 12.6V9.4' }),
    h('path', { d: 'M6.2 12.6V6.4' }),
    h('path', { d: 'M9.8 12.6V8.2' }),
    h('path', { d: 'M13.4 12.6V4.2' }))

    var panelInstance = null

    function UsageFooterAction(props) {
      var wide = !props || props.wide !== false
      var level = React.useSyncExternalStore(
        function (listener) {
          return panelInstance ? panelInstance.subscribe(listener) : function () {}
        },
        function () { return panelInstance ? panelInstance.getLevel() : 'ok' },
      )
      return h('button', {
        type: 'button',
        className: BTN_CLS,
        'data-compact': wide ? '0' : '1',
        title: 'OpenCode Go / CommandCode 用量',
        'aria-label': '用量',
        onClick: function (event) {
          event.stopPropagation()
          if (panelInstance) panelInstance.toggle()
        },
      },
      ICON,
      wide ? h('span', null, '用量') : null,
      level !== 'ok' ? h('span', { className: 'uh-dot', 'data-level': level }) : null)
    }

    // ── apply ──────────────────────────────────────────────────────────────
    exports.apply = function apply(ctx) {
      if (typeof document === 'undefined') return

      injectStyles()

      var previous = document.querySelector('.' + PANEL_CLS)
      if (previous && typeof previous.__uhDispose === 'function') {
        try { previous.__uhDispose() } catch (e) { /* 旧实例清理失败不阻塞 */ }
      }

      panelInstance = createPanel()
      panelInstance.wrap.__uhDispose = panelInstance.dispose
      document.body.appendChild(panelInstance.wrap)

      // 主题可能随设置切换，打开时重算一次即可；这里也监听一次变动。
      try {
        var observer = new MutationObserver(function () {
          if (panelInstance && panelInstance.isOpen()) panelInstance.setTheme(detectTheme())
        })
        observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-ds-dark-theme'] })
        ctx.effect(function () { return function () { observer.disconnect() } }, 'dsh-usage-hub: theme observer')
      } catch (e) { /* 没有 MutationObserver 也不影响主功能 */ }

      var slots = ctx.get('slots')
      if (!slots || typeof slots.inject !== 'function' || typeof slots.register !== 'function') {
        console.warn('[dsh-usage-hub] 当前界面没有 sidebar.footer.action 槽位')
        return
      }
      slots.inject('sidebar.footer.action', function () {
        return slots.register({ name: 'sidebar.footer.action', id: 'usage-hub', order: 18 }, UsageFooterAction)
      })
    }

    exports.inject = ['slots']
    return exports
  },
})
