import { describe, it, expect } from 'vitest'

describe('Worker message protocol', () => {
  it('defines correct message types', async () => {
    // Import types to verify they compile
    const { default: types } = await import('@/lib/types') as never
    void types

    // Type-level check: ensure WorkerInMessage and WorkerOutMessage exist
    type InMsg = import('@/lib/types').WorkerInMessage
    type OutMsg = import('@/lib/types').WorkerOutMessage

    // Runtime check: create valid messages
    const ping: InMsg = { type: 'ping' }
    expect(ping.type).toBe('ping')

    const pong: OutMsg = { type: 'pong' }
    expect(pong.type).toBe('pong')

    const progress: OutMsg = {
      type: 'progress',
      data: { phase: 'scanning', current: 0, total: 100, flightsFound: 0 },
    }
    expect(progress.type).toBe('progress')

    const result: OutMsg = { type: 'result', data: [] }
    expect(result.type).toBe('result')

    const error: OutMsg = { type: 'error', data: { message: 'test error' } }
    expect(error.type).toBe('error')
  })
})
