/**
 * Durable per-session index under ~/.dsh/storages/query-jump/
 * Survives dsh restart and plugin reinstall/update (as long as files remain).
 */
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import type { QueryJumpState } from './text.js'

export type PersistedSession = {
  messages: QueryJumpState['messages']
  mask: string[]
  updatedAt: number
}

function storeRoot(): string {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, 'storages', 'query-jump')
}

function sessionFile(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9._-]/g, '_')
  return path.join(storeRoot(), `${safe}.json`)
}

/** uuid 与 session- 前缀两种拼写各有一份缓存文件时一并删除 */
export function sessionIdVariants(sessionId: string): string[] {
  const id = String(sessionId || '').trim()
  if (!id) return []
  const variants = new Set<string>([id])
  if (id.startsWith('session-')) {
    variants.add(id.slice('session-'.length))
  } else if (/^[0-9a-f-]{36}$/i.test(id)) {
    variants.add(`session-${id}`)
  }
  return [...variants]
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  let removed = false
  for (const variant of sessionIdVariants(sessionId)) {
    try {
      await unlink(sessionFile(variant))
      removed = true
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        console.warn('[dsh-query-jump] deleteSession failed', variant, err)
      }
    }
  }
  return removed
}

export async function loadSession(sessionId: string): Promise<PersistedSession | null> {
  try {
    const raw = await readFile(sessionFile(sessionId), 'utf8')
    const data = JSON.parse(raw) as PersistedSession
    if (!data || !Array.isArray(data.messages)) return null
    return {
      messages: data.messages,
      mask: Array.isArray(data.mask) ? data.mask.map(String) : [],
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
    }
  } catch {
    return null
  }
}

export async function saveSession(
  sessionId: string,
  messages: QueryJumpState['messages'],
  mask: Iterable<string>,
): Promise<void> {
  const dir = storeRoot()
  await mkdir(dir, { recursive: true })
  const payload: PersistedSession = {
    messages,
    mask: [...mask],
    updatedAt: Date.now(),
  }
  await writeFile(sessionFile(sessionId), JSON.stringify(payload), 'utf8')
}
