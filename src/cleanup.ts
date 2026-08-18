/**
 * 与会话 / 工作区删除保持同步：清内存索引 + 磁盘 query-jump 缓存。
 */
import { deleteSession, sessionIdVariants } from './persist.js'

type DomainChange = {
  domain?: string
  table?: string
  key?: string
  operation?: 'put' | 'deleted'
  value?: unknown
}

type WorkspaceRecord = { sessionIds?: unknown[] }

export function createSessionCacheJanitor(deps: {
  incremental: Map<string, { messages: unknown[] }>
  clearMask: Map<string, Set<string>>
  persistTimers: Map<string, ReturnType<typeof setTimeout>>
  hydrated: Set<string>
}) {
  const workspaceSessions = new Map<string, Set<string>>()

  const rememberWorkspace = (workspaceId: string, rec: WorkspaceRecord | null | undefined) => {
    const wid = String(workspaceId || '').trim()
    if (!wid) return
    const ids = Array.isArray(rec?.sessionIds) ? rec.sessionIds.map(String).filter(Boolean) : []
    if (ids.length === 0) {
      workspaceSessions.delete(wid)
      return
    }
    workspaceSessions.set(wid, new Set(ids))
  }

  const hydrateWorkspaces = (storageDomain: any) => {
    try {
      const ws = storageDomain?.get?.('workspace')
      const table = ws?.table?.('workspaces')
      if (!table || typeof table.entries !== 'function') return
      for (const [wid, rec] of table.entries()) {
        rememberWorkspace(String(wid), rec as WorkspaceRecord)
      }
    } catch (err) {
      console.warn('[dsh-query-jump] workspace hydrate skipped', err)
    }
  }

  const purgeMemory = (sessionId: string) => {
    for (const variant of sessionIdVariants(sessionId)) {
      const t = deps.persistTimers.get(variant)
      if (t != null) {
        clearTimeout(t)
        deps.persistTimers.delete(variant)
      }
      deps.incremental.delete(variant)
      deps.clearMask.delete(variant)
      deps.hydrated.delete(variant)
    }
  }

  const purgeSession = (sessionId: string) => {
    const variants = sessionIdVariants(sessionId)
    if (variants.length === 0) return
    for (const variant of variants) purgeMemory(variant)
    void deleteSession(sessionId).catch((err) => {
      console.warn('[dsh-query-jump] purgeSession disk failed', sessionId, err)
    })
  }

  const purgeWorkspace = (workspaceId: string) => {
    const wid = String(workspaceId || '').trim()
    if (!wid) return
    const ids = workspaceSessions.get(wid)
    workspaceSessions.delete(wid)
    if (!ids?.size) return
    for (const sid of ids) purgeSession(sid)
  }

  const onDomainChanged = (change: DomainChange) => {
    if (!change || typeof change !== 'object') return

    if (change.domain === 'workspace' && change.table === 'workspaces') {
      const wid = String(change.key ?? '')
      if (!wid) return
      if (change.operation === 'put') {
        rememberWorkspace(wid, change.value as WorkspaceRecord)
        return
      }
      if (change.operation === 'deleted') {
        purgeWorkspace(wid)
      }
      return
    }

    if (
      change.domain === 'session_projcache' &&
      change.table === 'sessions' &&
      change.operation === 'deleted'
    ) {
      const sid = String(change.key ?? '')
      if (sid) purgeSession(sid)
    }
  }

  const onSessionDisposed = (session: { id?: unknown }) => {
    const sid = String(session?.id ?? '')
    if (sid) purgeSession(sid)
  }

  return {
    hydrateWorkspaces,
    purgeSession,
    purgeWorkspace,
    onDomainChanged,
    onSessionDisposed,
  }
}
