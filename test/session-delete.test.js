import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it, before, after } from 'node:test'
import { findSessionDirs, SessionDeleteError } from '../lib/session-delete.js'

describe('findSessionDirs', () => {
  /** @type {string} */
  let home
  /** @type {string | undefined} */
  let prevHome

  before(async () => {
    home = await mkdtemp(path.join(tmpdir(), 'dsh-query-jump-del-'))
    prevHome = process.env.DSH_HOME
    process.env.DSH_HOME = home
  })

  after(() => {
    if (prevHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = prevHome
  })

  it('finds session dir under workspace slug', async () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const dir = path.join(home, 'sessions', 'default', id)
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'events.jsonl'), '{}\n')
    const found = findSessionDirs(id)
    assert.equal(found.length, 1)
    assert.ok(found[0].endsWith(id))
  })
})

describe('SessionDeleteError', () => {
  it('carries http status', () => {
    const err = new SessionDeleteError('missing', 404)
    assert.equal(err.status, 404)
    assert.equal(err.message, 'missing')
  })
})
