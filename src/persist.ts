/**
 * Durable per-session index under ~/.dsh/storages/query-jump/
 * Survives dsh restart and plugin reinstall/update (as long as files remain).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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
