// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { evaluateExtraction } from '@/lib/eval'
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

describe('evaluateExtraction', () => {
  describe('precision and recall', () => {
    it('perfect extraction: precision=1, recall=1', () => {
      const result = evaluateExtraction([flight()], [flight()])
      expect(result.precision).toBe(1)
      expect(result.recall).toBe(1)
    })

    it('no extraction, no ground truth: precision=1, recall=1', () => {
      const result = evaluateExtraction([], [])
      expect(result.precision).toBe(1)
      expect(result.recall).toBe(1)
    })

    it('no extraction with ground truth: precision=1, recall=0', () => {
      const result = evaluateExtraction([], [flight()])
      expect(result.precision).toBe(1) // no false positives (convention)
      expect(result.recall).toBe(0)
    })

    it('extra extractions with no ground truth: precision=0, recall=1', () => {
      const result = evaluateExtraction([flight()], [])
      expect(result.precision).toBe(0) // all false positives
      expect(result.recall).toBe(1) // nothing to miss (convention)
    })

    it('partial recall: found 1 of 2', () => {
      const gt = [
        flight(),
        flight({ origin: 'SFO', destination: 'ORD', date: '2024-02-01' }),
      ]
      const result = evaluateExtraction([flight()], gt)
      expect(result.precision).toBe(1)
      expect(result.recall).toBe(0.5)
    })

    it('partial precision: 1 correct + 1 extra', () => {
      const extracted = [
        flight(),
        flight({ origin: 'AAA', destination: 'BBB', date: '2024-05-01' }),
      ]
      const result = evaluateExtraction(extracted, [flight()])
      expect(result.precision).toBe(0.5)
      expect(result.recall).toBe(1)
    })

    it('multiple flights: 2 correct of 3 extracted, 2 of 3 ground truth', () => {
      const extracted = [
        flight({ origin: 'JFK', destination: 'LAX', date: '2024-01-15' }),
        flight({ origin: 'SFO', destination: 'ORD', date: '2024-02-01' }),
        flight({ origin: 'AAA', destination: 'BBB', date: '2024-05-01' }), // false positive
      ]
      const gt = [
        flight({ origin: 'JFK', destination: 'LAX', date: '2024-01-15' }),
        flight({ origin: 'SFO', destination: 'ORD', date: '2024-02-01' }),
        flight({ origin: 'ATL', destination: 'DFW', date: '2024-03-01' }), // missed
      ]
      const result = evaluateExtraction(extracted, gt)
      expect(result.precision).toBeCloseTo(2 / 3)
      expect(result.recall).toBeCloseTo(2 / 3)
    })
  })

  describe('matching logic', () => {
    it('matches by origin + destination + date', () => {
      const ext = [flight({ airline: 'Different', flightNumber: 'XX999' })]
      const gt = [flight({ airline: 'United', flightNumber: 'UA 1234' })]
      const result = evaluateExtraction(ext, gt)
      // Should match because origin+destination+date are the same
      expect(result.recall).toBe(1)
    })

    it('does not match when origin differs', () => {
      const ext = [flight({ origin: 'SFO' })]
      const gt = [flight({ origin: 'JFK' })]
      const result = evaluateExtraction(ext, gt)
      expect(result.recall).toBe(0)
    })

    it('does not match when date differs', () => {
      const ext = [flight({ date: '2024-01-16' })]
      const gt = [flight({ date: '2024-01-15' })]
      const result = evaluateExtraction(ext, gt)
      expect(result.recall).toBe(0)
    })

    it('each ground truth can only be matched once', () => {
      // Two identical extractions should only match one ground truth
      const ext = [flight(), flight()]
      const gt = [flight()]
      const result = evaluateExtraction(ext, gt)
      expect(result.precision).toBe(0.5) // 1 true positive out of 2 extracted
      expect(result.recall).toBe(1) // 1 found out of 1
    })

    it('matches case-insensitively on origin and destination', () => {
      const ext = [flight({ origin: 'jfk', destination: 'lax' })]
      const gt = [flight({ origin: 'JFK', destination: 'LAX' })]
      const result = evaluateExtraction(ext, gt)
      expect(result.recall).toBe(1)
      expect(result.precision).toBe(1)
    })
  })

  describe('field accuracy', () => {
    it('reports 100% accuracy when all fields match', () => {
      const result = evaluateExtraction([flight()], [flight()])
      expect(result.fieldAccuracy.airline.accuracy).toBe(1)
      expect(result.fieldAccuracy.flightNumber.accuracy).toBe(1)
    })

    it('reports 0% accuracy for mismatched airline', () => {
      const ext = [flight({ airline: 'Delta' })]
      const gt = [flight({ airline: 'United' })]
      const result = evaluateExtraction(ext, gt)
      expect(result.fieldAccuracy.airline.accuracy).toBe(0)
    })

    it('normalizes flight number for comparison (case + whitespace)', () => {
      const ext = [flight({ flightNumber: 'ua1234' })]
      const gt = [flight({ flightNumber: 'UA 1234' })]
      const result = evaluateExtraction(ext, gt)
      expect(result.fieldAccuracy.flightNumber.accuracy).toBe(1)
    })

    it('field accuracy is case-insensitive for airline', () => {
      const ext = [flight({ airline: 'united' })]
      const gt = [flight({ airline: 'UNITED' })]
      const result = evaluateExtraction(ext, gt)
      expect(result.fieldAccuracy.airline.accuracy).toBe(1)
    })

    it('returns empty field accuracy when no matches', () => {
      const ext = [flight({ origin: 'SFO', destination: 'ORD', date: '2024-05-01' })]
      const gt = [flight()]
      const result = evaluateExtraction(ext, gt)
      expect(result.fieldAccuracy.airline.total).toBe(0)
      expect(result.fieldAccuracy.airline.accuracy).toBe(0)
    })
  })
})
