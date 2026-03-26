// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { deduplicateFlights } from '@/worker/dedup'
import { evaluateExtraction } from '@/lib/eval'
import type { Flight } from '@/lib/types'

// --- Helper ---
function flight(overrides: Partial<Flight> = {}): Flight {
  return {
    origin: 'JFK',
    destination: 'LAX',
    date: '2024-01-15',
    airline: 'United',
    flightNumber: 'UA 1234',
    confidence: 0.85,
    ...overrides,
  }
}

// ========================================
// Deduplication
// ========================================
describe('Deduplication', () => {
  it('deduplicates by flight number + date', () => {
    const flights: Flight[] = [
      flight({ confidence: 0.85 }),
      flight({ airline: '', confidence: 0.80 }),
      flight({ airline: 'United Airlines', flightNumber: 'UA1234', confidence: 0.75 }),
    ]

    const result = deduplicateFlights(flights)
    expect(result).toHaveLength(1)
    expect(result[0].confidence).toBe(0.85)
    expect(result[0].airline).toBe('United')
  })

  it('deduplicates by route + date when no flight number', () => {
    const flights: Flight[] = [
      flight({ origin: 'SFO', destination: 'ORD', flightNumber: '', airline: 'Delta', confidence: 0.80 }),
      flight({ origin: 'SFO', destination: 'ORD', flightNumber: '', airline: '', confidence: 0.70 }),
    ]

    const result = deduplicateFlights(flights)
    expect(result).toHaveLength(1)
    expect(result[0].airline).toBe('Delta')
  })

  it('keeps different flights on different dates', () => {
    const flights: Flight[] = [
      flight({ date: '2024-01-15', flightNumber: 'UA 100' }),
      flight({ date: '2024-01-22', flightNumber: 'UA 100' }),
    ]

    const result = deduplicateFlights(flights)
    expect(result).toHaveLength(2)
  })

  it('keeps different routes on the same date', () => {
    const flights: Flight[] = [
      flight({ origin: 'JFK', destination: 'LAX', flightNumber: 'UA 100' }),
      flight({ origin: 'LAX', destination: 'SFO', flightNumber: 'UA 200' }),
    ]

    const result = deduplicateFlights(flights)
    expect(result).toHaveLength(2)
  })

  it('returns flights sorted by date', () => {
    const flights: Flight[] = [
      flight({ date: '2024-03-01', flightNumber: 'DL 500' }),
      flight({ date: '2024-01-15', flightNumber: 'UA 100' }),
      flight({ date: '2024-02-20', flightNumber: 'AA 300' }),
    ]

    const result = deduplicateFlights(flights)
    expect(result[0].date).toBe('2024-01-15')
    expect(result[1].date).toBe('2024-02-20')
    expect(result[2].date).toBe('2024-03-01')
  })

  it('merges missing fields from lower-confidence duplicate', () => {
    const flights: Flight[] = [
      flight({ airline: '', flightNumber: 'UA 1234', confidence: 0.90 }),
      flight({ airline: 'United Airlines', flightNumber: 'UA 1234', confidence: 0.80 }),
    ]

    const result = deduplicateFlights(flights)
    expect(result).toHaveLength(1)
    expect(result[0].airline).toBe('United Airlines')
    expect(result[0].confidence).toBe(0.90)
  })
})

// ========================================
// Eval framework
// ========================================
describe('Eval framework', () => {
  it('calculates perfect precision and recall', () => {
    const extracted = [flight()]
    const groundTruth = [flight({ confidence: 1 })]

    const result = evaluateExtraction(extracted, groundTruth)
    expect(result.precision).toBe(1)
    expect(result.recall).toBe(1)
  })

  it('calculates zero recall when nothing extracted', () => {
    const extracted: Flight[] = []
    const groundTruth = [flight()]

    const result = evaluateExtraction(extracted, groundTruth)
    expect(result.precision).toBe(1) // no false positives
    expect(result.recall).toBe(0) // missed everything
  })

  it('calculates partial recall', () => {
    const extracted = [flight()]
    const groundTruth = [
      flight(),
      flight({ origin: 'SFO', destination: 'ORD', date: '2024-02-20', airline: 'Delta', flightNumber: 'DL 100' }),
    ]

    const result = evaluateExtraction(extracted, groundTruth)
    expect(result.precision).toBe(1)
    expect(result.recall).toBe(0.5)
  })

  it('tracks per-field accuracy', () => {
    const extracted = [flight({ airline: 'UA' })]
    const groundTruth = [flight({ airline: 'United Airlines' })]

    const result = evaluateExtraction(extracted, groundTruth)
    expect(result.fieldAccuracy.airline.accuracy).toBe(0) // "UA" != "United Airlines"
    expect(result.fieldAccuracy.flightNumber.accuracy).toBe(1)
  })

  it('handles empty ground truth and empty extraction', () => {
    const result = evaluateExtraction([], [])
    expect(result.precision).toBe(1)
    expect(result.recall).toBe(1)
  })
})
