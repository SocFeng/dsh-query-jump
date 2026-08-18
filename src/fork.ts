/**
 * 分叉会话：子会话 seed 不触发 session/event，需在 created 时复制/折叠 query 缓存。
 */
import { applyProjectionEvent, type QueryJumpState } from './text.js'
import { loadSession } from './persist.js'

type SessionLike = {
  id?: unknown
  header?: {
    parentSession?: unknown
    seedLength?: unknown
  }
  firstLiveSeq?: unknown
  events?: readonly { type?: string; seq?: number; time?: number; data?: any }[]
}

export function resolveSeedLength(session: SessionLike): number | null {
  const headerLen = session.header?.seedLength
  if (typeof headerLen === 'number' && headerLen >= 0) return headerLen
  const liveSeq = session.firstLiveSeq
  if (typeof liveSeq === 'number' && liveSeq >= 0) return liveSeq
  return null
}

export function seedEventsOf(session: SessionLike): SessionLike['events'] {
  const events = session.events ?? []
  const seedLen = resolveSeedLength(session)
  if (seedLen == null) return events
  return events.slice(0, seedLen)
}

export function foldSeedQueries(
  session: SessionLike,
  opts: { includeSteering?: boolean; maxQuery?: number },
): QueryJumpState {
  let state: QueryJumpState = { messages: [] }
  for (const event of seedEventsOf(session) ?? []) {
    state = applyProjectionEvent(state, event, opts)
  }
  return state
}

async function inheritMaskFromParent(
  parentId: string,
  childMsgIds: Set<string>,
  clearMask: Map<string, Set<string>>,
): Promise<Set<string>> {
  if (childMsgIds.size === 0) return new Set()

  let parentMask = clearMask.get(parentId)
  if (!parentMask?.size) {
    const disk = await loadSession(parentId)
    if (disk?.mask.length) parentMask = new Set(disk.mask)
  }
  if (!parentMask?.size) return new Set()

  const inherited = new Set<string>()
  for (const id of parentMask) {
    if (childMsgIds.has(id)) inherited.add(id)
  }
  return inherited
}

export function createForkCacheSeeder(deps: {
  incremental: Map<string, QueryJumpState>
  clearMask: Map<string, Set<string>>
  hydrated: Set<string>
  schedulePersist: (sessionId: string) => void
  getConfig: () => { includeSteering: boolean; maxQuery: number }
}) {
  const onSessionCreated = (session: SessionLike) => {
    const parentId = String(session.header?.parentSession ?? '').trim()
    if (!parentId) return
    const childId = String(session.id ?? '').trim()
    if (!childId || deps.incremental.has(childId)) return

    void (async () => {
      const opts = deps.getConfig()
      let state = foldSeedQueries(session, opts)

      if (state.messages.length === 0) {
        const parentDisk = await loadSession(parentId)
        const parentMem = deps.incremental.get(parentId)?.messages
        const seedIds = new Set(
          (seedEventsOf(session) ?? [])
            .filter((e) => e?.type === 'user/message' && e.data?.source?.kind === 'user')
            .map((e) => String(e.data?.id ?? ''))
            .filter(Boolean),
        )
        const source = parentMem ?? parentDisk?.messages ?? []
        const copied = source.filter((m) => m.id && seedIds.has(String(m.id)))
        if (copied.length) state = { messages: copied.slice(-opts.maxQuery) }
      }

      deps.incremental.set(childId, state)
      deps.hydrated.add(childId)

      const childMsgIds = new Set(
        state.messages.map((m) => m.id).filter((id): id is string => Boolean(id)),
      )
      const inheritedMask = await inheritMaskFromParent(parentId, childMsgIds, deps.clearMask)
      if (inheritedMask.size) deps.clearMask.set(childId, inheritedMask)

      deps.schedulePersist(childId)
    })().catch((err) => {
      console.warn('[dsh-query-jump] fork cache seed failed', childId, err)
    })
  }

  return { onSessionCreated, foldSeedQueries }
}
