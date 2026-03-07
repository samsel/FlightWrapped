// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import type { NormalizedEmail } from '@/lib/types'

// Mock the LLM module to avoid loading the actual model
vi.mock('../worker/extractors/llm', () => ({
  extractFromLlm: vi.fn().mockResolvedValue([{
    origin: 'JFK',
    destination: 'LAX',
    date: '2024-01-15',
    airline: 'United',
    flightNumber: 'UA 1234',
    confidence: 0.85,
  }]),
}))

const { extractFlightsFromEmail } = await import('../worker/extract')

function makeEmail(domain: string): NormalizedEmail {
  return {
    senderAddress: `noreply@${domain}`,
    senderDomain: domain,
    subject: 'Your flight confirmation',
    date: '2024-01-15',
    textBody: 'Flight UA 1234 JFK to LAX',
    htmlBody: '',
  }
}

describe('extractFlightsFromEmail domain filter', () => {
  it('processes emails from airline domains', async () => {
    const flights = await extractFlightsFromEmail(makeEmail('united.com'))
    expect(flights).toHaveLength(1)
  })

  it('processes emails from booking platform domains', async () => {
    const flights = await extractFlightsFromEmail(makeEmail('expedia.com'))
    expect(flights).toHaveLength(1)
  })

  it('rejects emails from non-airline domains', async () => {
    const flights = await extractFlightsFromEmail(makeEmail('gmail.com'))
    expect(flights).toHaveLength(0)
  })

  it('rejects emails from random domains', async () => {
    const flights = await extractFlightsFromEmail(makeEmail('newsletter.randomcompany.com'))
    expect(flights).toHaveLength(0)
  })

  it('handles empty domain', async () => {
    const flights = await extractFlightsFromEmail(makeEmail(''))
    expect(flights).toHaveLength(0)
  })
})
