/**
 * dsh-query-jump — browser half.
 *
 * UX:
 * - 默认收起：贴在对话区右缘的窄条（不常驻大面板）
 * - 鼠标悬停窄条 / 面板时展开完整列表
 * - 位置跟随 `[data-conversation-scroll]` 右边界，侧栏（Explorer 等）打开时自动内收，不被遮挡
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export const inject = ['slots', 'connection', 'locale']

const NS = 'query-jump'
const CHANNEL = '/query-jump'
const PROJECTION_KEY = 'queryJumpMessages'
const FLOW_KEY = 'data-chat-flow-key'
const FLOW_KIND = 'data-chat-flow-kind'
const SCROLL_SEL = '[data-conversation-scroll]'
const FULL_LOAD_PAGES = 120
const PANEL_W = 300
const TAB_W = 18
const EDGE_GAP = 8
const COLLAPSE_DELAY_MS = 220

const zh = {
  title: '会话 Query',
  enable: '启用',
  clear: '清空列表',
  empty: '暂无用户提问',
  noSession: '请先打开会话',
  loopback: '仅本机可用',
  jumpFail: '无法定位该消息',
  closed: '已关闭',
  tabHint: 'Query',
}

type DockGeo = { right: number; top: number; height: number }

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function measureDock(): DockGeo | null {
  const sc = document.querySelector(SCROLL_SEL) as HTMLElement | null
  if (!sc) return null
  const rect = sc.getBoundingClientRect()
  if (rect.width < 80 || rect.height < 80) return null
  const right = Math.max(EDGE_GAP, Math.round(window.innerWidth - rect.right + EDGE_GAP))
  const top = Math.max(56, Math.round(rect.top + 48))
  const height = Math.max(160, Math.min(Math.round(rect.height - 64), Math.round(window.innerHeight * 0.72)))
  return { right, top, height }
}

function windowHasId(snap: any, id: string): boolean {
  try {
    if (!snap?.chat?.order || !snap?.chat?.nodes) return false
    for (const k of snap.chat.order) {
      const n = snap.chat.nodes.get(k)
      if (n != null && String(n.id) === String(id)) return true
    }
  } catch {
    /* ignore */
  }
  return false
}

async function loadUntilIdLoaded(face: any, id: string) {
  let pages = 0
  let guard = 0
  while (guard++ < 300) {
    let snap: any
    try {
      snap = face.getSnapshot()
    } catch {
      return
    }
    if (snap == null || snap.openState === 'error') return
    if (snap.openState !== 'open') {
      await delay(120)
      continue
    }
    if (windowHasId(snap, id)) return
    if (snap.hasMore !== true) return
    if (snap.loadingOlder === true) {
      await delay(50)
      continue
    }
    try {
      await face.loadOlder()
    } catch {
      return
    }
    if (++pages >= FULL_LOAD_PAGES) return
  }
}

function findRowByMsgId(msgId: string): HTMLElement | null {
  const nodes = document.querySelectorAll(`[${FLOW_KEY}]`)
  for (const node of Array.from(nodes)) {
    const kind = node.getAttribute(FLOW_KIND)
    if (kind && kind !== 'user') continue
    const key = node.getAttribute(FLOW_KEY) || ''
    if (key.includes(msgId)) return node as HTMLElement
  }
  return null
}

type Rpc = { call: (ch: string, endpoint: string, body?: unknown) => Promise<any> }

type PanelProps = {
  ctx: any
  useSessions: (sel: (s: any) => any) => any
  useProjection?: (key: string) => any
  rpc: Rpc
  t: (k: string) => string
  isLoopback: boolean
}

function QueryJumpPanel({ ctx, useSessions, useProjection, rpc, t, isLoopback }: PanelProps) {
  const sessionId = useSessions((s) => s.current) as string | undefined
  const projected = useProjection?.(PROJECTION_KEY) as
    | { messages?: Array<{ seq: number; time: number; text: string; id?: string }> }
    | undefined

  const [enable, setEnable] = useState(true)
  const [mask, setMask] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [geo, setGeo] = useState<DockGeo | null>(null)
  const [rpcMessages, setRpcMessages] = useState<
    Array<{ seq: number; time: number; text: string; id?: string }>
  >([])

  const hoverRef = useRef(false)
  const collapseTimer = useRef<number | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const clearCollapseTimer = () => {
    if (collapseTimer.current != null) {
      window.clearTimeout(collapseTimer.current)
      collapseTimer.current = null
    }
  }

  const scheduleCollapse = () => {
    clearCollapseTimer()
    collapseTimer.current = window.setTimeout(() => {
      if (!hoverRef.current) setOpen(false)
    }, COLLAPSE_DELAY_MS)
  }

  const onEnter = () => {
    hoverRef.current = true
    clearCollapseTimer()
    setOpen(true)
  }

  const onLeave = () => {
    hoverRef.current = false
    scheduleCollapse()
  }

  const refreshGeo = useCallback(() => {
    const next = measureDock()
    setGeo((prev) => {
      if (!next) return prev
      if (
        prev &&
        prev.right === next.right &&
        prev.top === next.top &&
        prev.height === next.height
      ) {
        return prev
      }
      return next
    })
  }, [])

  useEffect(() => {
    refreshGeo()
    const onResize = () => refreshGeo()
    window.addEventListener('resize', onResize)

    const sc = document.querySelector(SCROLL_SEL)
    let ro: ResizeObserver | null = null
    if (sc && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => refreshGeo())
      ro.observe(sc)
      if (sc.parentElement) ro.observe(sc.parentElement)
    }

    // 侧栏开合常改 layout，用轻量轮询兜底（比 MutationObserver 全树便宜）
    const tick = window.setInterval(refreshGeo, 500)
    return () => {
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
      window.clearInterval(tick)
      clearCollapseTimer()
    }
  }, [refreshGeo])

  const refreshConfig = useCallback(async () => {
    if (!isLoopback) return
    try {
      const res = await rpc.call(CHANNEL, 'getConfig', {})
      if (res?.ok) setEnable(!!res.value.enable)
    } catch (err) {
      console.warn('[dsh-query-jump] getConfig', err)
    }
  }, [rpc, isLoopback])

  const refreshMask = useCallback(async () => {
    if (!isLoopback || !sessionId) {
      setMask(new Set())
      return
    }
    try {
      const res = await rpc.call(CHANNEL, 'getMask', { sessionId })
      if (res?.ok) setMask(new Set((res.value.msgIds ?? []).map(String)))
    } catch (err) {
      console.warn('[dsh-query-jump] getMask', err)
    }
  }, [rpc, isLoopback, sessionId])

  const refreshList = useCallback(async () => {
    if (!isLoopback || !sessionId) {
      setRpcMessages([])
      return
    }
    try {
      const res = await rpc.call(CHANNEL, 'list', { sessionId })
      if (res?.ok) {
        if (typeof res.value.enable === 'boolean') setEnable(res.value.enable)
        setRpcMessages(res.value.messages ?? [])
      }
    } catch (err) {
      console.warn('[dsh-query-jump] list', err)
    }
  }, [rpc, isLoopback, sessionId])

  useEffect(() => {
    void refreshConfig()
  }, [refreshConfig])

  useEffect(() => {
    void refreshMask()
  }, [refreshMask])

  useEffect(() => {
    void refreshList()
    if (!sessionId || !isLoopback) return
    const timer = window.setInterval(() => void refreshList(), 1500)
    return () => window.clearInterval(timer)
  }, [refreshList, sessionId, isLoopback])

  const items = useMemo(() => {
    const fromProj = (projected?.messages ?? []).filter((m) => m.id && !mask.has(String(m.id)))
    const source = fromProj.length > 0 ? fromProj : rpcMessages
    return source.map((m) => ({
      msgId: String(m.id),
      query: m.text || '(空)',
      createAt: m.time,
      seq: m.seq,
    }))
  }, [projected, mask, rpcMessages])

  const onToggle = async (next: boolean) => {
    try {
      const res = await rpc.call(CHANNEL, 'setEnable', { enable: next })
      if (res?.ok) setEnable(next)
    } catch (err) {
      console.warn('[dsh-query-jump] setEnable', err)
    }
  }

  const onClear = async () => {
    if (!sessionId) return
    const ids = items.map((i) => i.msgId)
    try {
      await rpc.call(CHANNEL, 'clearMask', { sessionId, msgIds: ids })
      await refreshMask()
      await refreshList()
    } catch (err) {
      console.warn('[dsh-query-jump] clearMask', err)
    }
  }

  const onJump = async (msgId: string) => {
    if (busy || !sessionId) return
    setBusy(true)
    try {
      let row = findRowByMsgId(msgId)
      if (!row) {
        let face: any = null
        try {
          face = ctx.sessions?.binding?.(sessionId)?.session ?? null
        } catch {
          face = null
        }
        if (face) {
          await loadUntilIdLoaded(face, msgId)
          let tries = 0
          while (tries++ < 20 && !row) {
            row = findRowByMsgId(msgId)
            if (!row) await delay(60)
          }
        }
      }
      if (!row) {
        console.warn(`[dsh-query-jump] ${t('jumpFail')}`, msgId)
        return
      }
      row.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const prev = row.style.outline
      row.style.outline = '2px solid var(--dsw-alias-brand-primary, #2563eb)'
      window.setTimeout(() => {
        row!.style.outline = prev
      }, 1200)
    } finally {
      setBusy(false)
    }
  }

  const right = geo?.right ?? 16
  const top = geo?.top ?? 80
  const height = geo?.height ?? 360

  // 无对话滚动区时不渲染，避免贴死视口右缘被侧栏盖住
  if (!geo && !document.querySelector(SCROLL_SEL)) {
    return null
  }

  if (!isLoopback) {
    return (
      <div
        ref={rootRef}
        style={{ ...shellStyle, right, top, width: open ? PANEL_W : TAB_W, height: open ? 80 : 120 }}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
      >
        {open ? <div style={tipStyle}>{t('loopback')}</div> : <TabLabel text={t('tabHint')} />}
      </div>
    )
  }

  if (!enable) {
    return (
      <div
        ref={rootRef}
        style={{ ...shellStyle, right, top, width: open ? 200 : TAB_W, height: open ? 56 : 100 }}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
      >
        {open ? (
          <label style={{ ...headerStyle, borderBottom: 'none', gap: 8 }}>
            <input type="checkbox" checked={false} onChange={() => void onToggle(true)} />
            {t('closed')}
          </label>
        ) : (
          <TabLabel text="Off" />
        )}
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      style={{
        ...shellStyle,
        right,
        top,
        width: open ? PANEL_W : TAB_W,
        height: open ? height : Math.min(160, height),
        transition: 'width .18s ease, height .18s ease, box-shadow .18s ease',
      }}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      {!open ? (
        <TabLabel text={t('tabHint')} count={items.length} />
      ) : (
        <>
          <div style={headerStyle}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
              <input
                type="checkbox"
                checked={enable}
                onChange={(e) => void onToggle(e.target.checked)}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t('title')}
              </span>
            </label>
            <button type="button" style={btnStyle} onClick={() => void onClear()}>
              {t('clear')}
            </button>
          </div>
          <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
            {!sessionId && <div style={tipStyle}>{t('noSession')}</div>}
            {sessionId && items.length === 0 && <div style={tipStyle}>{t('empty')}</div>}
            {items.map((item) => (
              <div
                key={item.msgId}
                role="button"
                tabIndex={0}
                title={item.query}
                style={rowStyle}
                onClick={() => void onJump(item.msgId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onJump(item.msgId)
                }}
              >
                {item.query.length > 60 ? `${item.query.slice(0, 60)}…` : item.query}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function TabLabel({ text, count }: { text: string; count?: number }) {
  return (
    <div style={tabInnerStyle} title={text}>
      <span style={tabTextStyle}>{text}</span>
      {typeof count === 'number' && count > 0 ? <span style={badgeStyle}>{count > 99 ? '99+' : count}</span> : null}
    </div>
  )
}

const shellStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 45,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: 'var(--dsw-alias-bg-layer-3, #fff)',
  border: '1px solid var(--dsw-alias-border-l2, #e5e7eb)',
  borderRadius: 10,
  color: 'var(--dsw-alias-label-primary, #111)',
  boxShadow: '0 8px 24px rgba(0,0,0,.14)',
  pointerEvents: 'auto',
}

const tabInnerStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '10px 2px',
  cursor: 'pointer',
  userSelect: 'none',
}

const tabTextStyle: React.CSSProperties = {
  writingMode: 'vertical-rl',
  textOrientation: 'mixed',
  fontSize: 11,
  letterSpacing: '0.08em',
  color: 'var(--dsw-alias-label-secondary, #666)',
}

const badgeStyle: React.CSSProperties = {
  minWidth: 16,
  height: 16,
  padding: '0 4px',
  borderRadius: 8,
  fontSize: 10,
  lineHeight: '16px',
  textAlign: 'center',
  background: 'var(--dsw-alias-brand-primary, #2563eb)',
  color: '#fff',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 10px',
  borderBottom: '1px solid var(--dsw-alias-border-l2, #e5e7eb)',
  fontSize: 12,
  flexShrink: 0,
}

const tipStyle: React.CSSProperties = {
  color: 'var(--dsw-alias-label-secondary, #888)',
  fontSize: 12,
  padding: 8,
}

const btnStyle: React.CSSProperties = {
  fontSize: 11,
  flexShrink: 0,
}

const rowStyle: React.CSSProperties = {
  padding: '6px 8px',
  margin: '4px 8px',
  borderRadius: 6,
  background: 'var(--dsw-alias-bg-layer-2, #f5f7fa)',
  cursor: 'pointer',
  fontSize: 12,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

export function apply(ctx: any) {
  try {
    ctx.effect(() => ctx.locale.register(NS, 'zh', zh), 'dsh-query-jump: zh')
  } catch (err) {
    console.warn('[dsh-query-jump] locale.register skipped', err)
  }

  const rpc = ctx.connection.rpc
  const isLoopback = !!ctx.connection.isLoopback
  let t = (k: string) => (zh as Record<string, string>)[k] ?? k
  try {
    t = ctx.locale.bind(NS)
  } catch {
    /* keep fallback t */
  }

  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      { name: 'shell.overlay', id: 'query-jump', order: 110 },
      (props: any) =>
        React.createElement(QueryJumpPanel, {
          ctx,
          useSessions: props.useSessions,
          useProjection: props.useProjection,
          rpc,
          t,
          isLoopback,
        }),
    ),
  )
}
