import { describe, it, expect } from 'vitest'

describe('Worker message protocol', () => {
  it('defines correct message types', async () => {
    const { default: types } = await import('@/lib/types') as never
    void types

    type InMsg = import('@/lib/types').WorkerInMessage
    type OutMsg = import('@/lib/types').WorkerOutMessage

    const ping: InMsg = { type: 'ping' }
    expect(ping.type).toBe('ping')

    const initLlm: InMsg = { type: 'init-llm' }
    expect(initLlm.type).toBe('init-llm')

    const pong: OutMsg = { type: 'pong' }
    expect(pong.type).toBe('pong')

    const llmReady: OutMsg = { type: 'llm-ready' }
    expect(llmReady.type).toBe('llm-ready')

    const loadingModel: OutMsg = {
      type: 'progress',
      data: { phase: 'loading-model', current: 50, total: 100, flightsFound: 0, message: 'Downloading...' },
    }
    expect(loadingModel.type).toBe('progress')

    const progress: OutMsg = {
      type: 'progress',
      data: { phase: 'extracting', current: 0, total: 100, flightsFound: 0 },
    }
    expect(progress.type).toBe('progress')

    const result: OutMsg = { type: 'result', data: [] }
    expect(result.type).toBe('result')

    const error: OutMsg = { type: 'error', data: { message: 'test error' } }
    expect(error.type).toBe('error')
  })
})
