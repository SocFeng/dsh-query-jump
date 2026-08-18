import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it, before, after } from 'node:test'
import { createForkCacheSeeder, foldSeedQueries, seedEventsOf } from '../lib/fork.js'
import { saveSession } from '../lib/persist.js'

const userEvt = (seq, id, text) => ({
  type: 'user/message',
  seq,
  time: seq * 1000,
  data: {
    id,
    source: { kind: 'user' },
    content: [{ type: 'text', text }],
  },
})

describe('seedEventsOf', () => {
  it('slices events by header.seedLength', () => {
    const events = [userEvt(0, 'm1', 'a'), userEvt(1, 'm2', 'b'), userEvt(2, 'm3', 'c')]
    const seed = seedEventsOf({
      header: { parentSession: 'parent-1', seedLength: 2 },
      events,
    })
    assert.equal(seed?.length, 2)
    assert.equal(seed?.[1]?.data?.id, 'm2')
  })
})

describe('foldSeedQueries', () => {
  it('folds user queries from fork seed', () => {
    const state = foldSeedQueries(
      {
        header: { parentSession: 'p', seedLength: 2 },
        events: [userEvt(0, 'm1', 'hello'), userEvt(1, 'm2', 'world')],
      },
      { maxQuery: 200 },
    )
    assert.equal(state.messages.length, 2)
    assert.equal(state.messages[0].text, 'hello')
    assert.equal(state.messages[1].text, 'world')
  })
})

describe('createForkCacheSeeder', () => {
  /** @type {string} */
  let home
  /** @type {string | undefined} */
  let prevHome

  before(async () => {
    home = await mkdtemp(path.join(tmpdir(), 'dsh-query-jump-fork-'))
    prevHome = process.env.DSH_HOME
    process.env.DSH_HOME = home
  })

  after(() => {
    if (prevHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = prevHome
  })

  it('seeds child incremental cache and inherits parent mask', async () => {
    const parentId = 'parent-session'
    await saveSession(parentId, [{ id: 'm1', seq: 0, time: 0, text: 'q1' }], new Set(['m1']))

    const incremental = new Map()
    const clearMask = new Map()
    const hydrated = new Set()
    const persisted = []

    const seeder = createForkCacheSeeder({
      incremental,
      clearMask,
      hydrated,
      schedulePersist: (id) => persisted.push(id),
      getConfig: () => ({ includeSteering: false, maxQuery: 200 }),
    })

    seeder.onSessionCreated({
      id: 'child-session',
      header: { parentSession: parentId, seedLength: 1 },
      events: [userEvt(0, 'm1', 'q1')],
    })

    await new Promise((r) => setTimeout(r, 20))

    assert.equal(incremental.get('child-session')?.messages.length, 1)
    assert.equal(incremental.get('child-session')?.messages[0].text, 'q1')
    assert.equal(clearMask.get('child-session')?.has('m1'), true)
    assert.equal(hydrated.has('child-session'), true)
    assert.deepEqual(persisted, ['child-session'])
  })
})
