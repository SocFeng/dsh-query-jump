/**
 * dsh-query-jump — browser half
 *
 * 通义风短横线导航：
 * - 平时：对话区右缘淡色 tick rail
 * - 当前阅读位置：更深色 tick + 列表高亮
 * - 悬停：弹出提问列表（无标题/搜索/清空），约 20 条可视可滚
 * - 贴 conversation-scroll 边界
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

const RAIL_W = 22
const TICK_GAP = 8
const TICK_H = 2
const EDGE_GAP = 6
const PANEL_W = 280
const ROW_H = 32
const VISIBLE_ROWS = 20
const LIST_H = ROW_H * VISIBLE_ROWS
const COLLAPSE_MS = 260
const READ_LINE = 0.38

const zh = {
  empty: '暂无提问',
  noSession: '请先打开会话',
  jumpFail: '无法定位该消息',
}

type Item = { msgId: string; query: string; createAt: number; seq: number }
type DockGeo = { right: number; top: number; railH: number }

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

function measureDock(): DockGeo | null {
  const sc = document.querySelector(SCROLL_SEL) as HTMLElement | null
  if (!sc) return null
  const rect = sc.getBoundingClientRect()
  if (rect.width < 80 || rect.height < 120) return null
  const right = Math.max(EDGE_GAP, Math.round(window.innerWidth - rect.right + EDGE_GAP))
  const railH = Math.max(120, Math.min(Math.round(rect.height * 0.72), 520))
  const top = Math.max(48, Math.round(rect.top + (rect.height - railH) / 2))
  return { right, top, railH }
}

function findRowByMsgId(msgId: string): HTMLElement | null {
  for (const node of Array.from(document.querySelectorAll(`[${FLOW_KEY}]`))) {
    const kind = node.getAttribute(FLOW_KIND)
    if (kind && kind !== 'user') continue
    const key = node.getAttribute(FLOW_KEY) || ''
    if (key.includes(msgId)) return node as HTMLElement
  }
  return null
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
    if (!snap || snap.openState === 'error') return
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

function formatTime(ts: number): string {
  try {
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

type Rpc = { call: (ch: string, endpoint: string, body?: unknown) => Promise<any> }

function QueryJumpPanel({
  ctx,
  useSessions,
  useProjection,
  rpc,
  t,
  isLoopback,
}: {
  ctx: any
  useSessions: (sel: (s: any) => any) => any
  useProjection?: (key: string) => any
  rpc: Rpc
  t: (k: string) => string
  isLoopback: boolean
}) {
  const sessionId = useSessions((s) => s.current) as string | undefined
  const projected = useProjection?.(PROJECTION_KEY) as
    | { messages?: Array<{ seq: number; time: number; text: string; id?: string }> }
    | undefined

  const [enable, setEnable] = useState(true)
  const [mask, setMask] = useState<Set<string>>(() => new Set())
  const [rpcMessages, setRpcMessages] = useState<
    Array<{ seq: number; time: number; text: string; id?: string }>
  >([])
  const [geo, setGeo] = useState<DockGeo | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [busy, setBusy] = useState(false)
  const [railScroll, setRailScroll] = useState(0)

  const hoverRef = useRef(false)
  const collapseTimer = useRef<number | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const items = useMemo(() => {
    const fromProj = (projected?.messages ?? []).filter((m) => m.id && !mask.has(String(m.id)))
    const source = fromProj.length > 0 ? fromProj : rpcMessages
    return source.map(
      (m): Item => ({
        msgId: String(m.id),
        query: m.text || '(空)',
        createAt: m.time,
        seq: m.seq,
      }),
    )
  }, [projected, mask, rpcMessages])

  const clearCollapse = () => {
    if (collapseTimer.current != null) {
      window.clearTimeout(collapseTimer.current)
      collapseTimer.current = null
    }
  }

  const onEnter = () => {
    hoverRef.current = true
    clearCollapse()
    setOpen(true)
  }

  const onLeave = () => {
    hoverRef.current = false
    clearCollapse()
    collapseTimer.current = window.setTimeout(() => {
      if (!hoverRef.current) setOpen(false)
    }, COLLAPSE_MS)
  }

  const refreshGeo = useCallback(() => {
    const next = measureDock()
    setGeo((prev) => {
      if (!next) return prev
      if (prev && prev.right === next.right && prev.top === next.top && prev.railH === next.railH) {
        return prev
      }
      return next
    })
  }, [])

  const spyActive = useCallback(() => {
    const sc = document.querySelector(SCROLL_SEL) as HTMLElement | null
    if (!sc || items.length === 0) {
      setActiveIdx(-1)
      return
    }
    const srect = sc.getBoundingClientRect()
    const lineY = srect.top + srect.height * READ_LINE
    let best = -1
    let bestDist = Infinity
    items.forEach((it, idx) => {
      const row = findRowByMsgId(it.msgId)
      if (!row) return
      const r = row.getBoundingClientRect()
      const mid = (r.top + r.bottom) / 2
      const dist = Math.abs(mid - lineY)
      if (dist < bestDist) {
        bestDist = dist
        best = idx
      }
    })
    setActiveIdx(best)
  }, [items])

  useEffect(() => {
    refreshGeo()
    spyActive()
    const sc = document.querySelector(SCROLL_SEL)
    const onScroll = () => spyActive()
    const onResize = () => {
      refreshGeo()
      spyActive()
    }
    sc?.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    let ro: ResizeObserver | null = null
    if (sc && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        refreshGeo()
        spyActive()
      })
      ro.observe(sc)
    }
    const tick = window.setInterval(() => {
      refreshGeo()
      spyActive()
    }, 600)
    return () => {
      sc?.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
      window.clearInterval(tick)
      clearCollapse()
    }
  }, [refreshGeo, spyActive])

  useEffect(() => {
    if (!open || activeIdx < 0 || !listRef.current) return
    const el = listRef.current.querySelector(`[data-qj-idx="${activeIdx}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIdx])

  const refreshConfig = useCallback(async () => {
    if (!isLoopback) return
    try {
      const res = await rpc.call(CHANNEL, 'getConfig', {})
      if (res?.ok) setEnable(!!res.value.enable)
    } catch {
      /* ignore */
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
    } catch {
      /* ignore */
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
    } catch {
      /* ignore */
    }
  }, [rpc, isLoopback, sessionId])

  useEffect(() => {
    void refreshConfig()
    const tmr = window.setInterval(() => void refreshConfig(), 3000)
    return () => window.clearInterval(tmr)
  }, [refreshConfig])

  useEffect(() => {
    void refreshMask()
  }, [refreshMask])

  useEffect(() => {
    void refreshList()
    if (!sessionId || !isLoopback) return
    const tmr = window.setInterval(() => void refreshList(), 1500)
    return () => window.clearInterval(tmr)
  }, [refreshList, sessionId, isLoopback])

  const onJump = async (msgId: string, idxInAll?: number) => {
    if (busy || !sessionId) return
    setBusy(true)
    try {
      if (typeof idxInAll === 'number') setActiveIdx(idxInAll)
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
      window.setTimeout(() => spyActive(), 350)
    } finally {
      setBusy(false)
    }
  }

  if (!enable || !isLoopback || !geo || items.length === 0) return null

  const { right, top, railH } = geo
  const contentH = Math.max(railH, (items.length - 1) * TICK_GAP + TICK_H + 8)
  const maxRailScroll = Math.max(0, contentH - railH)
  const offset = Math.min(railScroll, maxRailScroll)

  const onRailWheel = (e: React.WheelEvent) => {
    if (maxRailScroll <= 0) return
    e.preventDefault()
    e.stopPropagation()
    setRailScroll((v) => Math.min(maxRailScroll, Math.max(0, v + e.deltaY)))
  }

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 45,
        right,
        top,
        height: railH,
        display: 'flex',
        flexDirection: 'row-reverse',
        alignItems: 'stretch',
        gap: 8,
        pointerEvents: 'auto',
      }}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      <div
        style={{
          width: RAIL_W,
          height: railH,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 8,
          background: 'transparent',
        }}
        onWheel={onRailWheel}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: -offset,
            height: contentH,
            paddingTop: 4,
          }}
        >
          {items.map((it, idx) => {
            const active = idx === activeIdx
            return (
              <button
                key={it.msgId}
                type="button"
                title={it.query.slice(0, 120)}
                onClick={() => void onJump(it.msgId, idx)}
                style={{
                  position: 'absolute',
                  left: active ? 4 : 6,
                  right: active ? 4 : 6,
                  top: 4 + idx * TICK_GAP,
                  height: active ? 3 : TICK_H,
                  border: 'none',
                  borderRadius: 2,
                  padding: 0,
                  cursor: 'pointer',
                  background: active
                    ? 'var(--dsw-alias-label-primary, #3d3d3d)'
                    : 'var(--dsw-alias-label-dimmed, rgba(0,0,0,.28))',
                  opacity: active ? 1 : 0.72,
                  transition: 'background .12s, left .12s, right .12s, height .12s',
                }}
              />
            )
          })}
        </div>
      </div>

      {open && (
        <div
          ref={listRef}
          style={{
            width: PANEL_W,
            maxHeight: Math.min(railH, LIST_H),
            overflow: 'auto',
            padding: '6px 4px',
            background: 'var(--dsw-alias-bg-layer-3, #fff)',
            border: '1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.08))',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(15,23,42,.1)',
            animation: 'qjIn .14s ease-out',
          }}
        >
          {!sessionId && <div style={emptyStyle}>{t('noSession')}</div>}
          {sessionId && items.length === 0 && <div style={emptyStyle}>{t('empty')}</div>}
          {items.map((item, idx) => {
            const active = idx === activeIdx
            return (
              <button
                key={item.msgId}
                type="button"
                data-qj-idx={idx}
                title={item.query}
                onClick={() => void onJump(item.msgId, idx)}
                style={{
                  ...rowStyle,
                  background: active
                    ? 'var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.06))'
                    : 'transparent',
                  boxShadow: active
                    ? 'inset 2px 0 0 var(--dsw-alias-label-primary, #3d3d3d)'
                    : 'none',
                }}
              >
                <span
                  style={{
                    ...idxStyle,
                    background: active
                      ? 'var(--dsw-alias-label-primary, #3d3d3d)'
                      : 'var(--dsw-alias-bg-layer-2, rgba(0,0,0,.05))',
                    color: active ? '#fff' : 'var(--dsw-alias-label-secondary, #8a8f98)',
                  }}
                >
                  {idx + 1}
                </span>
                <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <span
                    style={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 12.5,
                      lineHeight: 1.3,
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {item.query}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--dsw-alias-label-secondary, #8a8f98)',
                    }}
                  >
                    {formatTime(item.createAt)}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      <style>{`
        @keyframes qjIn {
          from { opacity: 0; transform: translateX(8px); }
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

const rowStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  minHeight: ROW_H,
  padding: '5px 8px',
  marginBottom: 1,
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'inherit',
}

const idxStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 18,
  height: 18,
  marginTop: 1,
  borderRadius: 9,
  fontSize: 10,
  lineHeight: '18px',
  textAlign: 'center',
}

export function apply(ctx: any) {
  try {
    ctx.effect(() => ctx.locale.register(NS, 'zh', zh), 'dsh-query-jump: zh')
  } catch {
    /* ignore */
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
