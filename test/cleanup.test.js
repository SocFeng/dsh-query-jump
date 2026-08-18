import assert from 'node:assert/strict'
import { mkdtemp, writeFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it, before, after } from 'node:test'
import { createSessionCacheJanitor } from '../lib/cleanup.js'
import { deleteSession, sessionIdVariants, saveSession } from '../lib/persist.js'

describe('sessionIdVariants', () => {
  it('includes uuid and session- prefix forms', () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const variants = sessionIdVariants(id)
    assert.ok(variants.includes(id))
    assert.ok(variants.includes(`session-${id}`))
  })
})

describe('createSessionCacheJanitor', () => {
  it('purges memory on session_projcache deleted', () => {
    const incremental = new Map([['sid-1', { messages: [{ id: 'm1' }] }]])
    const clearMask = new Map([['sid-1', new Set(['m1'])]])
    const persistTimers = new Map()
    const hydrated = new Set(['sid-1'])
    const janitor = createSessionCacheJanitor({
      incremental,
      clearMask,
      persistTimers,
      hydrated,
    })

    janitor.onDomainChanged({
      domain: 'session_projcache',
      table: 'sessions',
      key: 'sid-1',
      operation: 'deleted',
    })

    assert.equal(incremental.has('sid-1'), false)
    assert.equal(clearMask.has('sid-1'), false)
    assert.equal(hydrated.has('sid-1'), false)
  })

  it('purges all workspace sessions on workspace deleted', () => {
    const incremental = new Map([
      ['s1', { messages: [] }],
      ['s2', { messages: [] }],
    ])
    const janitor = createSessionCacheJanitor({
      incremental: incremental,
      clearMask: new Map(),
      persistTimers: new Map(),
      hydrated: new Set(),
    })

    janitor.onDomainChanged({
      domain: 'workspace',
      table: 'workspaces',
      key: 'ws-1',
      operation: 'put',
      value: { sessionIds: ['s1', 's2'] },
    })
    janitor.onDomainChanged({
      domain: 'workspace',
      table: 'workspaces',
      key: 'ws-1',
      operation: 'deleted',
    })

    assert.equal(incremental.has('s1'), false)
    assert.equal(incremental.has('s2'), false)
  })
})

describe('deleteSession', () => {
  /** @type {string} */
  let home
  /** @type {string | undefined} */
  let prevHome

  before(async () => {
    home = await mkdtemp(path.join(tmpdir(), 'dsh-query-jump-'))
    prevHome = process.env.DSH_HOME
    process.env.DSH_HOME = home
  })

  after(() => {
    if (prevHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = prevHome
  })

  it('removes persisted json for id variants', async () => {
    const id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    await saveSession(id, [{ id: 'm1', text: 'x' }], new Set())
    const file = path.join(home, 'storages', 'query-jump', `${id}.json`)
    await access(file)

    const removed = await deleteSession(`session-${id}`)
    assert.equal(removed, true)
    await assert.rejects(() => access(file), { code: 'ENOENT' })
  })
})
