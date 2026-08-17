/**
 * dsh-query-jump — browser half（通义风 / 低存在感）
 *
 * - 默认几乎不可见：对话区右缘一条透明热区
 * - 鼠标靠近热区才滑出提问列表（类似通义会话导航）
 * - 贴 `[data-conversation-scroll]` 右边界，侧栏打开时自动内收
 * - 开关以 settings / Config 为准；关闭时完全不渲染，避免显示疲劳
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
const PANEL_W = 280
const HOT_W = 10
const EDGE_GAP = 4
const COLLAPSE_DELAY_MS = 280

const zh = {
  title: '提问记录',
  clear: '清空',
  empty: '暂无提问',
  noSession: '请先打开会话',
  jumpFail: '无法定位该消息',
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
  const top = Math.max(48, Math.round(rect.top + 24))
  const height = Math.max(180, Math.min(Math.round(rect.height - 40), Math.round(window.innerHeight * 0.78)))
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

function formatTime(ts: number): string {
  try {
    const d = new Date(ts)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  } catch {
    return ''
  }
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
      if (prev && prev.right === next.right && prev.top === next.top && prev.height === next.height) {
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
    const tick = window.setInterval(refreshGeo, 400)
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
    const timer = window.setInterval(() => void refreshConfig(), 3000)
    return () => window.clearInterval(timer)
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
      row.style.outline = '2px solid var(--dsw-alias-brand-primary, #615ced)'
      window.setTimeout(() => {
        row!.style.outline = prev
      }, 1200)
    } finally {
      setBusy(false)
    }
  }

  // 开关关闭：完全不渲染，零存在感
  if (!enable || !isLoopback) return null
  if (!geo) return null
  // 还没有任何提问时也不占位（避免空热区打扰）
  if (items.length === 0 && !open) return null

  const { right, top, height } = geo

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 45,
        right,
        top,
        width: open ? PANEL_W : HOT_W,
        height: open ? height : Math.min(220, height),
        display: 'flex',
        justifyContent: 'flex-end',
        pointerEvents: 'auto',
        transition: 'width .2s ease',
      }}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      {/* 收起：几乎透明的热区，仅悬停可感知 */}
      {!open && (
        <div
          style={{
            width: HOT_W,
            height: '100%',
            borderRadius: 6,
            background: 'transparent',
            cursor: 'ew-resize',
          }}
          title={t('title')}
        />
      )}

      {/* 展开：通义风滑出卡片 */}
      {open && (
        <div
          style={{
            width: PANEL_W,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--dsw-alias-bg-layer-3, rgba(255,255,255,.96))',
            border: '1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.06))',
            borderRadius: 12,
            boxShadow: '0 10px 40px rgba(15,23,42,.12)',
            color: 'var(--dsw-alias-label-primary, #1f2329)',
            backdropFilter: 'blur(8px)',
            overflow: 'hidden',
            animation: 'qjSlideIn .18s ease-out',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px 8px',
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>{t('title')}</div>
            <button
              type="button"
              onClick={() => void onClear()}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--dsw-alias-label-secondary, #8a8f98)',
                fontSize: 12,
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              {t('clear')}
            </button>
          </div>

          <div style={{ overflow: 'auto', flex: 1, padding: '0 8px 10px' }}>
            {!sessionId && <div style={emptyStyle}>{t('noSession')}</div>}
            {sessionId && items.length === 0 && <div style={emptyStyle}>{t('empty')}</div>}
            {items.map((item, idx) => (
              <button
                key={item.msgId}
                type="button"
                title={item.query}
                onClick={() => void onJump(item.msgId)}
                style={itemStyle}
              >
                <span style={idxStyle}>{idx + 1}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 13,
                      lineHeight: 1.4,
                      textAlign: 'left',
                    }}
                  >
                    {item.query}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      marginTop: 2,
                      fontSize: 11,
                      color: 'var(--dsw-alias-label-secondary, #8a8f98)',
                      textAlign: 'left',
                    }}
                  >
                    {formatTime(item.createAt)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes qjSlideIn {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

const emptyStyle: React.CSSProperties = {
  color: 'var(--dsw-alias-label-secondary, #8a8f98)',
  fontSize: 12,
  padding: '16px 8px',
  textAlign: 'center',
}

const itemStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  padding: '10px 8px',
  marginBottom: 2,
  border: 'none',
  borderRadius: 8,
  background: 'transparent',
  cursor: 'pointer',
  color: 'inherit',
}

const idxStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 18,
  height: 18,
  marginTop: 1,
  borderRadius: 9,
  fontSize: 11,
  lineHeight: '18px',
  textAlign: 'center',
  color: 'var(--dsw-alias-label-secondary, #8a8f98)',
  background: 'var(--dsw-alias-bg-layer-2, rgba(0,0,0,.04))',
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
    /* fallback */
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
