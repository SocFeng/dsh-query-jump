/**
 * 客户端：删除会话入口（会话头按钮 + 侧栏菜单 + 确认弹窗）
 */
import React, { useCallback, useEffect, useState } from 'react'

const DELETE_EVENT = 'query-jump:delete-session'
const CHANNEL = '/query-jump'

type Rpc = { call: (ch: string, endpoint: string, body?: unknown) => Promise<any> }

type DeleteTarget = {
  sessionId: string | null
  title: string | null
  running: boolean
  notFound?: boolean
}

type SessionSummary = { title?: string; running?: boolean }

function normalizeTitle(t: unknown): string {
  return String(t || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function stripForkSuffix(t: string): string {
  return normalizeTitle(t).replace(/\s*\(\d+\)\s*$/, '')
}

function resolveTargetFromStore(
  detail: { sessionId?: string | null; title?: string | null; running?: boolean },
  sessionsSvc: any,
): DeleteTarget | null {
  let sessionId = detail.sessionId || null
  const title = detail.title || null
  let running = detail.running === true
  if (sessionId) return { sessionId, title, running }

  const want = normalizeTitle(title)
  if (!want) return null
  const wantBase = stripForkSuffix(want)
  const svc = sessionsSvc
  if (svc?.list) {
    try {
      const snap = svc.list.getSnapshot()
      const byId = snap?.byId ?? {}
      const ids = Object.keys(byId)
      for (const id of ids) {
        const s = byId[id] as SessionSummary | undefined
        if (s && normalizeTitle(s.title) === want) {
          return { sessionId: id, title: s.title ?? null, running: s.running === true }
        }
      }
      if (wantBase) {
        for (const id of ids) {
          const s = byId[id] as SessionSummary | undefined
          if (s && stripForkSuffix(String(s.title ?? '')) === wantBase) {
            return { sessionId: id, title: s.title ?? null, running: s.running === true }
          }
        }
      }
      let best: DeleteTarget | null = null
      for (const id of ids) {
        const s = byId[id] as SessionSummary | undefined
        if (!s?.title) continue
        const tt = normalizeTitle(s.title)
        if (tt && (tt.includes(want) || want.includes(tt))) {
          best = { sessionId: id, title: s.title ?? null, running: s.running === true }
        }
      }
      if (best) return best
    } catch {
      /* ignore */
    }
  }
  return null
}

async function resolveTargetFromHost(
  rpc: Rpc,
  isLoopback: boolean,
  want: string,
): Promise<DeleteTarget> {
  if (!isLoopback) {
    return { sessionId: null, title: want, running: false, notFound: true }
  }
  try {
    const res = await rpc.call(CHANNEL, 'listSessions', {})
    const sessions = res?.ok && Array.isArray(res.value?.sessions) ? res.value.sessions : []
    const wantBase = stripForkSuffix(want)
    for (const s of sessions) {
      if (!s?.title) continue
      const tt = normalizeTitle(s.title)
      if (
        tt === want ||
        (wantBase && stripForkSuffix(tt) === wantBase) ||
        tt.includes(want) ||
        want.includes(tt)
      ) {
        return {
          sessionId: String(s.sessionId),
          title: s.title,
          running: s.running === true,
        }
      }
    }
  } catch {
    /* ignore */
  }
  return { sessionId: null, title: want, running: false, notFound: true }
}

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  padding: 0,
  border: 'none',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--dsw-alias-label-tertiary, #8a8a8e)',
  cursor: 'pointer',
  flex: 'none',
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,.35)',
}

const dialogStyle: React.CSSProperties = {
  width: 'min(420px, calc(100vw - 32px))',
  borderRadius: 12,
  padding: '20px 22px 18px',
  background: 'var(--dsw-alias-bg-layer-1, #fff)',
  color: 'var(--dsw-alias-label-primary, inherit)',
  boxShadow: '0 12px 40px rgba(0,0,0,.18)',
}

const metaStyle: React.CSSProperties = {
  color: 'var(--dsw-alias-label-secondary, #8a8a8e)',
  fontSize: 13,
  lineHeight: '20px',
  margin: '0 0 10px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const warnStyle: React.CSSProperties = {
  color: 'var(--dsw-alias-state-warn-primary, #f5a524)',
  fontSize: 13,
  lineHeight: '20px',
  margin: '0 0 10px',
}

const errStyle: React.CSSProperties = {
  color: 'var(--dsw-alias-state-error-primary, #e5484d)',
  fontSize: 12,
  lineHeight: '16px',
  marginTop: 8,
}

const optStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  lineHeight: '20px',
  marginTop: 10,
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 8,
  border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.4))',
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary, inherit)',
  fontSize: 13,
  cursor: 'pointer',
  marginRight: 8,
}

const dangerBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 8,
  border: '1px solid var(--dsw-alias-state-error-primary, #e5484d)',
  background: 'var(--dsw-alias-state-error-primary, #e5484d)',
  color: '#fff',
  fontSize: 13,
  cursor: 'pointer',
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M6.5 1.5h3l.5 1.5H13v1.5H3V3h2.5l.5-1.5zm-1 4.5v5.5h1.5V6H5.5zm4 0v5.5H11V6H9.5zM5 3.5h6l-.4 7.2c0 .8-.7 1.3-1.5 1.3H6.9c-.8 0-1.5-.5-1.5-1.3L5 3.5z" />
    </svg>
  )
}

export function DeleteSessionDialog({
  rpc,
  isLoopback,
  sessionsSvc,
  t,
}: {
  rpc: Rpc
  isLoopback: boolean
  sessionsSvc: any
  t: (k: string) => string
}) {
  const [target, setTarget] = useState<DeleteTarget | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail ?? {}
      const resolved = resolveTargetFromStore(d, sessionsSvc)
      if (resolved) {
        setTarget(resolved)
        setAcknowledged(false)
        setError(null)
        setBusy(false)
        return
      }
      const want = normalizeTitle(d.title)
      if (!want) return
      void resolveTargetFromHost(rpc, isLoopback, want).then((next) => {
        setTarget(next)
        setAcknowledged(false)
        setError(null)
        setBusy(false)
      })
    }
    window.addEventListener(DELETE_EVENT, handler)
    return () => window.removeEventListener(DELETE_EVENT, handler)
  }, [rpc, isLoopback, sessionsSvc])

  const close = useCallback(() => {
    if (busy) return
    setTarget(null)
    setError(null)
  }, [busy])

  const confirm = useCallback(() => {
    if (busy || !acknowledged || !target?.sessionId) return
    setBusy(true)
    setError(null)
    void (async () => {
      try {
        const res = await rpc.call(CHANNEL, 'deleteSession', { sessionId: target.sessionId })
        if (!res?.ok) {
          throw new Error(res?.error?.message || 'delete failed')
        }
        const deletedId = target.sessionId
        const svc = sessionsSvc
        const deletedCurrent =
          svc?.list && deletedId ? svc.list.getSnapshot()?.current === deletedId : false
        setTarget(null)
        if (svc && typeof svc.refreshList === 'function') {
          const done = svc.refreshList()
          if (deletedCurrent && deletedId) {
            await Promise.resolve(done)
            try {
              const snap = svc.list.getSnapshot()
              const next = (snap?.ids ?? []).find((id: string) => id !== deletedId)
              if (next && typeof svc.open === 'function') svc.open(next)
            } catch {
              /* ignore */
            }
          }
        }
      } catch (reason) {
        setBusy(false)
        setError(reason instanceof Error ? reason.message : String(reason))
      }
    })()
  }, [busy, acknowledged, target, rpc, sessionsSvc])

  if (!target) return null

  const name = target.notFound
    ? target.title || t('deleteUntitled')
    : target.title || t('deleteUntitled')
  const description = target.notFound
    ? t('deleteNotFoundDesc')
    : target.running
      ? t('deleteRunningDesc')
      : t('deleteDesc')

  return (
    <div style={overlayStyle} onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qj-delete-title"
        style={dialogStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div id="qj-delete-title" style={{ fontSize: 16, fontWeight: 650, marginBottom: 8 }}>
          {t('deleteTitle')}
        </div>
        <div style={{ fontSize: 13, lineHeight: '20px', marginBottom: 12 }}>{description}</div>
        <div style={metaStyle}>
          {t('deleteSessionLabel')}
          {name}
          {target.sessionId ? (
            <>
              <br />
              {t('deleteSessionIdLabel')}
              {target.sessionId}
            </>
          ) : null}
        </div>
        {target.running ? <div style={warnStyle}>{t('deleteRunningWarn')}</div> : null}
        <label style={optStyle}>
          <input
            type="checkbox"
            checked={acknowledged}
            disabled={busy}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          {t('deleteAck')}
        </label>
        {busy ? (
          <div style={{ ...metaStyle, marginTop: 8 }}>{t('deleteBusy')}</div>
        ) : null}
        {error ? (
          <div style={errStyle} role="alert">
            {error}
          </div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" disabled={busy} onClick={close} style={cancelBtnStyle}>
            {t('deleteCancel')}
          </button>
          <button
            type="button"
            disabled={busy || !acknowledged || !target.sessionId}
            onClick={confirm}
            style={{
              ...dangerBtnStyle,
              opacity: busy || !acknowledged || !target.sessionId ? 0.5 : 1,
              cursor: busy || !acknowledged || !target.sessionId ? 'default' : 'pointer',
            }}
          >
            {busy ? t('deleteConfirming') : t('deleteConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DeleteSessionButton({
  sessionId,
  useSessions,
  t,
}: {
  sessionId: string
  useSessions: (sel: (s: any) => any) => any
  t: (k: string) => string
}) {
  const summary = useSessions((s) => s.byId?.[sessionId]) as SessionSummary | undefined
  const running = summary?.running === true

  const openDialog = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent(DELETE_EVENT, {
        detail: {
          sessionId,
          title: summary?.title ?? null,
          running,
        },
      }),
    )
  }, [sessionId, summary, running])

  return (
    <button
      type="button"
      title={running ? t('deleteBtnRunning') : t('deleteBtn')}
      aria-label={t('deleteBtn')}
      style={btnStyle}
      onClick={openDialog}
    >
      <TrashIcon />
    </button>
  )
}

const TRASH_PATH =
  'M14.4782 4.84067L14.2138 10.1152C14.1102 12.1872 14.067 13.0115 13.3866 13.9607C13.1044 14.3546 12.7498 14.6912 12.3424 14.9535C11.8239 15.2872 11.2415 15.4316 10.5585 15.4998C9.88727 15.5668 9.04946 15.5656 7.99998 15.5656C6.95051 15.5656 6.1127 15.5668 5.44142 15.4998C4.75851 15.4316 4.17602 15.2872 3.65753 14.9535C3.25012 14.6912 2.89559 14.3546 2.61332 13.9607C1.93296 13.0115 1.88979 12.1872 1.78619 10.1152L1.52179 4.84067L2.89006 4.77277L3.15343 10.0463C3.26221 12.2218 3.32452 12.6015 3.72646 13.1624C3.90825 13.4161 4.13686 13.6334 4.39927 13.8023C4.66204 13.9714 5.00263 14.0792 5.57825 14.1367C6.16562 14.1953 6.92298 14.1963 7.99998 14.1963C9.07699 14.1963 9.83434 14.1953 10.4217 14.1367C10.9973 14.0792 11.3379 13.9714 11.6007 13.8023C11.8631 13.6334 12.0917 13.4161 12.2735 13.1624C12.6755 12.6015 12.7378 12.2218 12.8465 10.0463L13.1099 4.77277L14.4782 4.84067ZM5.43011 6.22849H6.7994V11.3909H5.43011V6.22849ZM9.20056 6.22849H10.5699V11.3909H9.20056V6.22849ZM8.53597 0.434431C9.17976 0.434431 9.6522 0.426926 10.0966 0.571258C10.2357 0.616451 10.3717 0.672554 10.502 0.738948C10.9182 0.951107 11.2464 1.29099 11.7015 1.74612L12.4978 2.54136H15.3742V3.91169H0.625732V2.54136H3.50218L4.29845 1.74612C4.75358 1.29099 5.08174 0.951107 5.49801 0.738948C5.62831 0.672554 5.76425 0.616451 5.90334 0.571258C6.34776 0.426926 6.82021 0.434431 7.46399 0.434431H8.53597ZM7.46399 1.80476C6.73208 1.80476 6.51641 1.81187 6.32617 1.87369C6.25545 1.89667 6.18668 1.92533 6.12041 1.95907C5.96398 2.03878 5.82348 2.16253 5.44142 2.54136H10.5585C10.1765 2.16253 10.036 2.03878 9.87955 1.95907C9.81329 1.92533 9.74452 1.89667 9.6738 1.87369C9.48356 1.81187 9.26789 1.80476 8.53597 1.80476H7.46399Z'

function findOpenSessionRow(): Element | null {
  const rows = document.querySelectorAll('[class*=sessionRow]')
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i].className || '').includes('menuOpen')) return rows[i]
  }
  return null
}

function openDeleteFlowFromSidebar(row: Element | null, t: (k: string) => string) {
  if (!row) return
  const titleEl = row.querySelector('[class*=title]')
  const title = titleEl ? String((titleEl as HTMLElement).innerText || '').trim() : ''
  if (!title) return
  window.dispatchEvent(new CustomEvent(DELETE_EVENT, { detail: { title } }))
}

export function installSidebarDeleteMenu(t: (k: string) => string) {
  if ((window as any).__queryJumpSidebarDeleteInstalled) return
  ;(window as any).__queryJumpSidebarDeleteInstalled = true

  const ensureItem = () => {
    const menu = document.querySelector('[role=menu]')
    if (!menu || menu.querySelector('[data-query-jump-delete]')) return
    const row = findOpenSessionRow()
    if (!row) return

    const item = document.createElement('button')
    item.type = 'button'
    item.setAttribute('role', 'menuitem')
    item.setAttribute('data-query-jump-delete', '1')
    item.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:8px',
      'width:100%',
      'padding:6px 12px',
      'border:none',
      'background:transparent',
      'color:var(--dsw-alias-state-error-primary,#e5484d)',
      'font:inherit',
      'font-size:13px',
      'line-height:20px',
      'text-align:left',
      'border-radius:6px',
      'cursor:pointer',
    ].join(';')
    item.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="${TRASH_PATH}"/></svg><span></span>`
    const span = item.querySelector('span')
    if (span) span.textContent = t('deleteMenu')
    item.addEventListener('mouseenter', () => {
      item.style.background = 'var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14))'
    })
    item.addEventListener('mouseleave', () => {
      item.style.background = 'transparent'
    })
    item.addEventListener('click', () => openDeleteFlowFromSidebar(row, t))
    const sep = document.createElement('div')
    sep.style.cssText =
      'height:1px;margin:4px 8px;background:var(--dsw-alias-border-l1,rgba(128,128,128,.2))'
    menu.appendChild(sep)
    menu.appendChild(item)
  }

  try {
    ensureItem()
  } catch {
    /* ignore */
  }
  const observer = new MutationObserver(() => {
    try {
      ensureItem()
    } catch {
      /* ignore */
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

export { DELETE_EVENT }
