/**
 * Shared pure helpers (host projection + unit tests).
 */

export type ContentBlock = { type?: string; text?: string }

const GOAL_TAG = /^\s*<\s*goal_[a-z_]*\s*>\s*/i

/** Flatten message ContentBlock[] into a short preview string. */
export function textOf(content: unknown, maxChars = 200): string {
  if (!Array.isArray(content)) return ''
  let out = ''
  let hasImage = false
  for (const block of content as ContentBlock[]) {
    if (block && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
      out += block.text
    } else if (block && typeof block === 'object' && block.type === 'image') {
      hasImage = true
    }
  }
  const trimmed = out.replace(GOAL_TAG, '').trim().slice(0, maxChars)
  if (trimmed) return trimmed
  return hasImage ? '[图片消息]' : ''
}

export type QueryJumpMessage = {
  seq: number
  time: number
  text: string
  id?: string
}

export type QueryJumpState = { messages: QueryJumpMessage[] }

/** Whether a session event should enter the query list. */
export function isUserQueryEvent(
  event: { type?: string; data?: any },
  includeSteering = false,
): boolean {
  if (event?.type !== 'user/message') return false
  const kind = event.data?.source?.kind
  if (kind !== 'user') return false
  // Steering shares kind===user in some builds; keep includeSteering for future tightening.
  void includeSteering
  return true
}

/** Pure projection apply (same reference when unchanged). */
export function applyProjectionEvent(
  state: QueryJumpState,
  event: { type?: string; seq?: number; time?: number; data?: any },
  opts: { includeSteering?: boolean; maxQuery?: number } = {},
): QueryJumpState {
  const maxQuery = opts.maxQuery ?? 200
  if (!isUserQueryEvent(event, opts.includeSteering)) return state

  const data = event.data
  const id = typeof data?.id === 'string' ? data.id : undefined
  if (id && state.messages.some((m) => m.id === id)) return state

  const entry: QueryJumpMessage = {
    seq: typeof event.seq === 'number' ? event.seq : state.messages.length,
    time: typeof event.time === 'number' ? event.time : Date.now(),
    text: textOf(data?.content) || '(空消息)',
    ...(id ? { id } : {}),
  }
  return { messages: [...state.messages, entry].slice(-maxQuery) }
}

/** 模糊：子串 或 子序列 */
export function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase()
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (t.includes(q)) return true
  let i = 0
  for (const ch of t) {
    if (ch === q[i]) i++
    if (i >= q.length) return true
  }
  return false
}
