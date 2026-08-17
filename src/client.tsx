/**
 * dsh-query-jump — browser half.
 * Registers a right-docked shell.overlay panel: query list, enable toggle,
 * clear-mask, jump via data-chat-flow-key (+ loadOlder when needed).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'

export const inject = ['slots', 'connection', 'locale']

const NS = 'query-jump'
const CHANNEL = '/query-jump'
const PROJECTION_KEY = 'queryJumpMessages'
const FLOW_KEY = 'data-chat-flow-key'
const FLOW_KIND = 'data-chat-flow-kind'
const FULL_LOAD_PAGES = 120

const zh = {
  title: '会话 Query 定位',
  enable: '启用',
  clear: '清空本会话列表',
  empty: '暂无用户提问',
  noSession: '请先打开会话',
  loopback: '仅本机 127.0.0.1 可用',
  jumpFail: '无法定位该消息（可能仍在加载历史）',
  closed: '已关闭 — 勾选以重新启用',
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
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
  const [rpcMessages, setRpcMessages] = useState<
    Array<{ seq: number; time: number; text: string; id?: string }>
  >([])

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

  if (!isLoopback) {
    return React.createElement('div', { style: panelStyle }, t('loopback'))
  }

  if (!enable) {
    return React.createElement(
      'div',
      { style: { ...panelStyle, maxHeight: 52 } },
      React.createElement(
        'label',
        { style: { ...headerStyle, gap: 8 } },
        React.createElement('input', {
          type: 'checkbox',
          checked: false,
          onChange: () => void onToggle(true),
        }),
        t('closed'),
      ),
    )
  }

  return React.createElement(
    'div',
    { style: panelStyle },
    React.createElement(
      'div',
      { style: headerStyle },
      React.createElement(
        'label',
        { style: { display: 'flex', gap: 6, alignItems: 'center' } },
        React.createElement('input', {
          type: 'checkbox',
          checked: enable,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => void onToggle(e.target.checked),
        }),
        t('title'),
      ),
      React.createElement(
        'button',
        { type: 'button', style: { fontSize: 11 }, onClick: () => void onClear() },
        t('clear'),
      ),
    ),
    React.createElement(
      'div',
      { style: { overflow: 'auto', flex: 1 } },
      !sessionId && React.createElement('div', { style: tipStyle }, t('noSession')),
      sessionId && items.length === 0 && React.createElement('div', { style: tipStyle }, t('empty')),
      items.map((item) =>
        React.createElement(
          'div',
          {
            key: item.msgId,
            role: 'button',
            tabIndex: 0,
            title: item.query,
            style: rowStyle,
            onClick: () => void onJump(item.msgId),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter') void onJump(item.msgId)
            },
          },
          item.query.length > 60 ? `${item.query.slice(0, 60)}…` : item.query,
        ),
      ),
    ),
  )
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  right: 16,
  top: 80,
  width: 320,
  maxHeight: '70vh',
  zIndex: 40,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--dsw-alias-bg-layer-3, #fff)',
  border: '1px solid var(--dsw-alias-border-l2, #e5e7eb)',
  borderRadius: 12,
  color: 'var(--dsw-alias-label-primary, #111)',
  boxShadow: '0 8px 24px rgba(0,0,0,.12)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 10px',
  borderBottom: '1px solid var(--dsw-alias-border-l2, #e5e7eb)',
  fontSize: 12,
}

const tipStyle: React.CSSProperties = {
  color: 'var(--dsw-alias-label-secondary, #888)',
  fontSize: 12,
  padding: 8,
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
