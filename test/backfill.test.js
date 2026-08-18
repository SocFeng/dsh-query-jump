import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { foldEventsToState, mergeQueryStates } from '../lib/backfill.js'

const userEvt = (seq, time, id, text) => ({
  type: 'user/message',
  seq,
  time,
  data: {
    id,
    source: { kind: 'user' },
    content: [{ type: 'text', text }],
  },
})

describe('mergeQueryStates', () => {
  it('adds missing queries and sorts by time', () => {
    const existing = {
      messages: [{ id: 'm2', seq: 2, time: 2000, text: 'later' }],
    }
    const folded = foldEventsToState(
      [userEvt(1, 1000, 'm1', 'earlier'), userEvt(2, 2000, 'm2', 'later')],
      { maxQuery: 200 },
    )
    const merged = mergeQueryStates(existing, folded, 200)
    assert.equal(merged.messages.length, 2)
    assert.equal(merged.messages[0].id, 'm1')
    assert.equal(merged.messages[1].id, 'm2')
    assert.equal(merged.messages[0].time, 1000)
  })

  it('prefers log seq/time for existing ids', () => {
    const existing = {
      messages: [{ id: 'm1', seq: 0, time: 1, text: 'old preview' }],
    }
    const folded = foldEventsToState([userEvt(5, 5000, 'm1', 'from log')], { maxQuery: 200 })
    const merged = mergeQueryStates(existing, folded, 200)
    assert.equal(merged.messages[0].seq, 5)
    assert.equal(merged.messages[0].time, 5000)
    assert.equal(merged.messages[0].text, 'from log')
  })
})
