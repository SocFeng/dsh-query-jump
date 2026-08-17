import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyProjectionEvent,
  fuzzyMatch,
  isUserQueryEvent,
  textOf,
} from '../lib/index.js'

describe('textOf', () => {
  it('joins text blocks', () => {
    assert.equal(
      textOf([
        { type: 'text', text: '你好' },
        { type: 'text', text: '世界' },
      ]),
      '你好世界',
    )
  })

  it('uses image placeholder when no text', () => {
    assert.equal(textOf([{ type: 'image' }]), '[图片消息]')
  })

  it('strips leading goal tags', () => {
    assert.equal(textOf([{ type: 'text', text: '<goal_foo> 实际问题' }]), '实际问题')
  })

  it('returns empty for non-array', () => {
    assert.equal(textOf(null), '')
  })
})

describe('isUserQueryEvent', () => {
  it('accepts user/message with source.kind=user', () => {
    assert.equal(
      isUserQueryEvent({
        type: 'user/message',
        data: { source: { kind: 'user' }, content: [] },
      }),
      true,
    )
  })

  it('rejects plugin inject', () => {
    assert.equal(
      isUserQueryEvent({
        type: 'user/message',
        data: { source: { kind: 'plugin', plugin: 'x' }, content: [] },
      }),
      false,
    )
  })

  it('rejects assistant', () => {
    assert.equal(isUserQueryEvent({ type: 'assistant/message', data: {} }), false)
  })
})

describe('applyProjectionEvent', () => {
  it('appends and dedupes by id', () => {
    let state = { messages: [] }
    const evt = {
      type: 'user/message',
      seq: 1,
      time: 100,
      data: {
        id: 'm1',
        source: { kind: 'user' },
        content: [{ type: 'text', text: 'hello' }],
      },
    }
    state = applyProjectionEvent(state, evt)
    assert.equal(state.messages.length, 1)
    assert.equal(state.messages[0].text, 'hello')
    const same = applyProjectionEvent(state, evt)
    assert.equal(same, state)
  })

  it('respects maxQuery', () => {
    let state = { messages: [] }
    for (let i = 0; i < 5; i++) {
      state = applyProjectionEvent(
        state,
        {
          type: 'user/message',
          seq: i,
          time: i,
          data: {
            id: `m${i}`,
            source: { kind: 'user' },
            content: [{ type: 'text', text: `q${i}` }],
          },
        },
        { maxQuery: 3 },
      )
    }
    assert.equal(state.messages.length, 3)
    assert.equal(state.messages[0].id, 'm2')
  })
})

describe('fuzzyMatch', () => {
  it('matches substring', () => {
    assert.equal(fuzzyMatch('你好世界', '世界'), true)
  })
  it('matches subsequence', () => {
    assert.equal(fuzzyMatch('hello world', 'hlo'), true)
  })
  it('rejects non-match', () => {
    assert.equal(fuzzyMatch('abc', 'xyz'), false)
  })
})
