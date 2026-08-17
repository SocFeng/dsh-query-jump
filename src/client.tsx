/**
 * dsh-query-jump — browser half
 *
 * 通义风短横线导航：
 * - 对话区右缘淡色 tick rail（无弹出 dialog）
 * - 当前阅读位置：更深色 tick
 * - 悬停 tick 看提问摘要，点击跳转；贴 conversation-scroll 边界
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'

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
const READ_LINE = 0.38

const zh = {
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
  const [activeIdx, setActiveIdx] = useState(-1)
  const [busy, setBusy] = useState(false)
  const [railScroll, setRailScroll] = useState(0)

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

  /** 阅读线 scroll-spy：哪个用户消息最接近视口 READ_LINE */
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
    }
  }, [refreshGeo, spyActive])

  // 当前项滚进 rail 可视区
  useEffect(() => {
    if (!geo || activeIdx < 0) return
    const { railH } = geo
    const tickY = 4 + activeIdx * TICK_GAP
    setRailScroll((prev) => {
      const contentH = Math.max(railH, (items.length - 1) * TICK_GAP + TICK_H + 8)
      const max = Math.max(0, contentH - railH)
      if (tickY < prev) return Math.min(max, tickY)
      if (tickY + TICK_H > prev + railH) return Math.min(max, Math.max(0, tickY + TICK_H - railH))
      return Math.min(max, prev)
    })
  }, [activeIdx, geo, items.length])

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
        width: RAIL_W,
        pointerEvents: 'auto',
      }}
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
    </div>
  )
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
