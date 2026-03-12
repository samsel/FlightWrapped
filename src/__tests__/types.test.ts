// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type {
  Flight,
  FlightStats,
  ParseProgress,
  WorkerInMessage,
  WorkerOutMessage,
  NormalizedEmail,
  RawEmail,
  FunStats,
  Insight,
  Archetype,
  Airport,
} from '@/lib/types'

/**
 * Type-level tests to ensure the type definitions are correct and compatible.
 * These tests verify runtime shape compliance. If the types change in a
 * breaking way, these tests will fail at compile time or at runtime.
 */

describe('Type contracts', () => {
  it('Flight has all required fields', () => {
    const f: Flight = {
      origin: 'JFK',
      destination: 'LAX',
      date: '2024-01-15',
      airline: 'Delta',
      flightNumber: 'DL100',
      confidence: 0.85,
    }
    expect(f.origin).toBe('JFK')
    expect(typeof f.confidence).toBe('number')
  })

  it('FlightStats has all required fields', () => {
    const s: FlightStats = {
      totalFlights: 0,
      totalMiles: 0,
      uniqueAirports: 0,
      uniqueCities: 0,
      uniqueCountries: 0,
      uniqueAirlines: 0,
      airlineBreakdown: {},
      mostFlownRoute: null,
      mostVisitedAirport: null,
      busiestMonth: null,
      firstFlight: null,
      lastFlight: null,
      longestRoute: null,
      shortestRoute: null,
      domesticRatio: 0,
      flightsByYear: {},
      flightsByMonth: {},
      estimatedHours: 0,
      co2Tons: 0,
    }
    expect(s.totalFlights).toBe(0)
  })

  it('ParseProgress phase covers all expected values', () => {
    const phases: ParseProgress['phase'][] = [
      'loading-model',
      'scanning',
      'extracting',
      'deduplicating',
      'done',
      'error',
    ]
    for (const phase of phases) {
      const p: ParseProgress = { phase, current: 0, total: 0, flightsFound: 0 }
      expect(p.phase).toBe(phase)
    }
  })

  it('WorkerInMessage covers all message types', () => {
    const msgs: WorkerInMessage[] = [
      { type: 'ping' },
      { type: 'init-llm' },
      { type: 'parse-mbox-files', data: [] },
      { type: 'set-profiler', data: true },
    ]
    expect(msgs).toHaveLength(4)
  })

  it('WorkerOutMessage covers all message types', () => {
    const msgs: WorkerOutMessage[] = [
      { type: 'pong' },
      { type: 'llm-ready' },
      { type: 'progress', data: { phase: 'scanning', current: 0, total: 0, flightsFound: 0 } },
      { type: 'result', data: [] },
      { type: 'error', data: { message: 'test' } },
    ]
    expect(msgs).toHaveLength(5)
  })

  it('NormalizedEmail has all required fields', () => {
    const e: NormalizedEmail = {
      senderAddress: 'test@example.com',
      senderDomain: 'example.com',
      subject: 'Test',
      date: '2024-01-15',
      htmlBody: '<p>test</p>',
      textBody: 'test',
    }
    expect(e.senderDomain).toBe('example.com')
  })

  it('RawEmail accepts both string and ArrayBuffer', () => {
    const str: RawEmail = { raw: 'MIME content' }
    expect(typeof str.raw).toBe('string')

    const buf: RawEmail = { raw: new ArrayBuffer(10) }
    expect(buf.raw instanceof ArrayBuffer).toBe(true)
  })

  it('FunStats has all required fields', () => {
    const f: FunStats = {
      earthOrbits: 1.5,
      moonPercent: 50,
      daysInAir: 3.2,
      speedComparison: 150,
      distanceLabel: 'test',
    }
    expect(typeof f.speedComparison).toBe('number')
  })

  it('Insight has all required fields', () => {
    const i: Insight = {
      id: 'test',
      title: 'Test',
      description: 'A test insight',
      icon: 'plane',
    }
    expect(i.id).toBe('test')
  })

  it('Archetype has all required fields', () => {
    const a: Archetype = {
      id: 'test',
      name: 'Test',
      description: 'A test archetype',
      icon: 'plane',
    }
    expect(a.id).toBe('test')
  })

  it('Airport has all required fields', () => {
    const a: Airport = {
      iata: 'JFK',
      name: 'John F. Kennedy',
      city: 'New York',
      country: 'United States',
      lat: 40.6413,
      lng: -73.7781,
      timezone: 'America/New_York',
    }
    expect(a.iata).toBe('JFK')
  })
})
