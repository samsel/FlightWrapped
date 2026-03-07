// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { deduplicateFlights } from '@/worker/dedup'
import type { Flight } from '@/lib/types'

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

describe('deduplicateFlights', () => {
  describe('flight number normalization', () => {
    it('treats "UA 1234" and "UA1234" as the same flight', () => {
      const flights = [
        flight({ flightNumber: 'UA 1234', confidence: 0.9 }),
        flight({ flightNumber: 'UA1234', confidence: 0.8 }),
      ]
      expect(deduplicateFlights(flights)).toHaveLength(1)
    })

    it('treats "ua 1234" and "UA 1234" as the same flight (case insensitive)', () => {
      const flights = [
        flight({ flightNumber: 'ua 1234', confidence: 0.9 }),
        flight({ flightNumber: 'UA 1234', confidence: 0.8 }),
      ]
      expect(deduplicateFlights(flights)).toHaveLength(1)
    })

    it('treats "UA  1234" (double space) as same as "UA1234"', () => {
      const flights = [
        flight({ flightNumber: 'UA  1234', confidence: 0.9 }),
        flight({ flightNumber: 'UA1234', confidence: 0.8 }),
      ]
      expect(deduplicateFlights(flights)).toHaveLength(1)
    })
  })

  describe('merge behavior', () => {
    it('keeps higher confidence record as base', () => {
      const flights = [
        flight({ airline: 'UA', confidence: 0.7 }),
        flight({ airline: 'United Airlines', confidence: 0.9 }),
      ]
      const result = deduplicateFlights(flights)
      expect(result[0].confidence).toBe(0.9)
      expect(result[0].airline).toBe('United Airlines')
    })

    it('fills in missing airline from lower confidence', () => {
      const flights = [
        flight({ airline: '', confidence: 0.95 }),
        flight({ airline: 'United', confidence: 0.8 }),
      ]
      const result = deduplicateFlights(flights)
      expect(result[0].airline).toBe('United')
      expect(result[0].confidence).toBe(0.95)
    })

    it('fills in missing flight number from lower confidence', () => {
      const flights = [
        flight({ flightNumber: '', origin: 'JFK', destination: 'LAX', confidence: 0.9 }),
        flight({ flightNumber: '', origin: 'JFK', destination: 'LAX', confidence: 0.7, airline: 'Delta' }),
      ]
      const result = deduplicateFlights(flights)
      expect(result).toHaveLength(1)
    })

    it('fills in missing origin from lower confidence', () => {
      const flights = [
        flight({ origin: '', flightNumber: 'UA1234', confidence: 0.95 }),
        flight({ origin: 'JFK', flightNumber: 'UA1234', confidence: 0.8 }),
      ]
      const result = deduplicateFlights(flights)
      expect(result[0].origin).toBe('JFK')
    })

    it('fills in missing destination from lower confidence', () => {
      const flights = [
        flight({ destination: '', flightNumber: 'UA1234', confidence: 0.95 }),
        flight({ destination: 'LAX', flightNumber: 'UA1234', confidence: 0.8 }),
      ]
      const result = deduplicateFlights(flights)
      expect(result[0].destination).toBe('LAX')
    })
  })

  describe('route-only dedup (no flight number)', () => {
    it('deduplicates by route+date when both lack flight numbers', () => {
      const flights = [
        flight({ flightNumber: '', confidence: 0.9 }),
        flight({ flightNumber: '', confidence: 0.7 }),
      ]
      const result = deduplicateFlights(flights)
      expect(result).toHaveLength(1)
    })

    it('does not collapse different routes on same date', () => {
      const flights = [
        flight({ origin: 'JFK', destination: 'LAX', flightNumber: '' }),
        flight({ origin: 'SFO', destination: 'ORD', flightNumber: '' }),
      ]
      const result = deduplicateFlights(flights)
      expect(result).toHaveLength(2)
    })

    it('route-only entry is suppressed when matching flight-number entry exists', () => {
      const flights = [
        flight({ flightNumber: 'UA1234', confidence: 0.9 }),
        flight({ flightNumber: '', confidence: 0.7 }),
      ]
      const result = deduplicateFlights(flights)
      expect(result).toHaveLength(1)
      expect(result[0].flightNumber).toBe('UA1234')
    })
  })

  describe('sorting', () => {
    it('returns flights sorted by date', () => {
      const flights = [
        flight({ date: '2024-12-01', flightNumber: 'DL500' }),
        flight({ date: '2024-01-01', flightNumber: 'UA100' }),
        flight({ date: '2024-06-15', flightNumber: 'AA300' }),
      ]
      const result = deduplicateFlights(flights)
      expect(result.map((f) => f.date)).toEqual(['2024-01-01', '2024-06-15', '2024-12-01'])
    })
  })

  describe('edge cases', () => {
    it('handles empty array', () => {
      expect(deduplicateFlights([])).toEqual([])
    })

    it('handles single flight', () => {
      const result = deduplicateFlights([flight()])
      expect(result).toHaveLength(1)
    })

    it('handles many duplicates of the same flight', () => {
      const flights = Array.from({ length: 20 }, () => flight())
      const result = deduplicateFlights(flights)
      expect(result).toHaveLength(1)
    })

    it('same flight number on different dates are kept separate', () => {
      const flights = [
        flight({ date: '2024-01-15' }),
        flight({ date: '2024-01-22' }),
      ]
      const result = deduplicateFlights(flights)
      expect(result).toHaveLength(2)
    })

    it('merges 3+ duplicates correctly', () => {
      const flights = [
        flight({ airline: '', flightNumber: 'UA1234', confidence: 0.9 }),
        flight({ airline: 'United', flightNumber: 'ua 1234', confidence: 0.7 }),
        flight({ airline: 'United Airlines', flightNumber: 'UA 1234', confidence: 0.5 }),
      ]
      const result = deduplicateFlights(flights)
      expect(result).toHaveLength(1)
      expect(result[0].confidence).toBe(0.9)
      expect(result[0].airline).toBe('United')
    })
  })
})
