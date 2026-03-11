import { describe, it, expect } from 'vitest'
import { calculateStats } from '@/lib/stats'
import { calculateFunStats } from '@/lib/funStats'
import { generateInsights } from '@/lib/insights'
import { determineArchetype } from '@/lib/archetypes'
import type { Flight, FlightStats } from '@/lib/types'

function makeFlight(overrides: Partial<Flight> = {}): Flight {
  return {
    origin: 'JFK',
    destination: 'LAX',
    date: '2024-01-15',
    airline: 'Delta',
    flightNumber: 'DL100',
    confidence: 1,
    ...overrides,
  }
}

function makeStats(overrides: Partial<FlightStats> = {}): FlightStats {
  return {
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
    ...overrides,
  }
}

describe('calculateStats edge cases', () => {
  it('returns null firstFlight/lastFlight when all flights have empty dates', () => {
    const flights = [
      makeFlight({ date: '' }),
      makeFlight({ date: '' }),
    ]
    const stats = calculateStats(flights)
    expect(stats.firstFlight).toBeNull()
    expect(stats.lastFlight).toBeNull()
  })

  it('handles flights with empty date string', () => {
    const flights = [
      makeFlight({ date: '' }),
      makeFlight({ date: '2024-06-01' }),
    ]
    const stats = calculateStats(flights)
    // The flight with a date should be first and last
    expect(stats.firstFlight!.date).toBe('2024-06-01')
    expect(stats.lastFlight!.date).toBe('2024-06-01')
  })

  it('empty date does not corrupt firstFlight', () => {
    const flights = [
      makeFlight({ date: '2024-03-01' }),
      makeFlight({ date: '' }),
      makeFlight({ date: '2024-06-01' }),
    ]
    const stats = calculateStats(flights)
    expect(stats.firstFlight!.date).toBe('2024-03-01')
    expect(stats.lastFlight!.date).toBe('2024-06-01')
  })

  it('handles flights with empty airline', () => {
    const flights = [
      makeFlight({ airline: '' }),
      makeFlight({ airline: 'Delta', date: '2024-02-01' }),
    ]
    const stats = calculateStats(flights)
    expect(stats.uniqueAirlines).toBe(1)
    expect(stats.airlineBreakdown).toEqual({ Delta: 1 })
  })

  it('handles unknown airport codes gracefully', () => {
    const flights = [makeFlight({ origin: 'ZZZ', destination: 'QQQ' })]
    const stats = calculateStats(flights)
    expect(stats.totalFlights).toBe(1)
    expect(stats.totalMiles).toBe(0) // unknown airports return 0 distance
    expect(stats.uniqueAirports).toBe(2)
  })

  it('handles very large number of flights', () => {
    const flights = Array.from({ length: 1000 }, (_, i) =>
      makeFlight({ date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}` }),
    )
    const stats = calculateStats(flights)
    expect(stats.totalFlights).toBe(1000)
    expect(stats.totalMiles).toBeGreaterThan(0)
  })

  it('all flights on same date', () => {
    const flights = [
      makeFlight({ origin: 'JFK', destination: 'LAX' }),
      makeFlight({ origin: 'SFO', destination: 'ORD' }),
      makeFlight({ origin: 'ATL', destination: 'DFW' }),
    ]
    const stats = calculateStats(flights)
    expect(stats.firstFlight!.date).toBe('2024-01-15')
    expect(stats.lastFlight!.date).toBe('2024-01-15')
    expect(stats.flightsByMonth).toEqual({ '2024-01': 3 })
  })

  it('single flight gives correct domestic ratio', () => {
    const intl = [makeFlight({ origin: 'JFK', destination: 'LHR' })]
    expect(calculateStats(intl).domesticRatio).toBe(0)

    const domestic = [makeFlight({ origin: 'JFK', destination: 'LAX' })]
    expect(calculateStats(domestic).domesticRatio).toBe(1)
  })

  it('flightsByMonth groups correctly across years', () => {
    const flights = [
      makeFlight({ date: '2023-06-15' }),
      makeFlight({ date: '2024-06-15' }),
    ]
    const stats = calculateStats(flights)
    expect(stats.flightsByMonth).toEqual({ '2023-06': 1, '2024-06': 1 })
  })
})

describe('calculateFunStats edge cases', () => {
  it('handles zero miles (no division by zero)', () => {
    const stats = makeStats({ totalMiles: 0, estimatedHours: 0 })
    const fun = calculateFunStats(stats)
    expect(fun.earthOrbits).toBe(0)
    expect(fun.moonPercent).toBe(0)
    expect(fun.daysInAir).toBe(0)
    expect(fun.speedComparison).toBe(0)
    expect(Number.isFinite(fun.speedComparison)).toBe(true)
  })

  it('handles very high mileage', () => {
    const stats = makeStats({ totalMiles: 1_000_000, estimatedHours: 2000 })
    const fun = calculateFunStats(stats)
    expect(fun.earthOrbits).toBeGreaterThan(40)
    expect(fun.moonPercent).toBeGreaterThan(400)
    expect(fun.distanceLabel).toContain('Moon and back')
  })

  it('each distance label threshold works', () => {
    const thresholds = [
      { miles: 500, contains: 'a lot of flying' },
      { miles: 10_000, contains: 'New York to Sydney' },
      { miles: 25_000, contains: 'circle the Earth' },
      { miles: 50_000, contains: 'circle the Earth twice' },
      { miles: 240_000, contains: 'fly to the Moon' },
      { miles: 500_000, contains: 'Moon and back' },
    ]
    for (const { miles, contains } of thresholds) {
      const stats = makeStats({ totalMiles: miles, estimatedHours: miles / 500 })
      const fun = calculateFunStats(stats)
      expect(fun.distanceLabel).toContain(contains)
    }
  })
})

describe('generateInsights edge cases', () => {
  it('handles single flight', () => {
    const flights = [makeFlight()]
    const stats = calculateStats(flights)
    const insights = generateInsights(flights, stats)
    // Should not crash, may or may not generate insights
    expect(Array.isArray(insights)).toBe(true)
  })

  it('does not produce QNaN from empty dates', () => {
    const flights = [
      makeFlight({ date: '' }),
      makeFlight({ date: '2024-01-15' }),
      makeFlight({ date: '2024-01-16' }),
    ]
    const stats = calculateStats(flights)
    const insights = generateInsights(flights, stats)
    // No insight should contain NaN
    for (const insight of insights) {
      expect(insight.description).not.toContain('NaN')
      expect(insight.title).not.toContain('NaN')
    }
  })

  it('detects Seasonal Traveler when >40% in one quarter', () => {
    // All in Q1
    const flights = Array.from({ length: 10 }, (_, i) =>
      makeFlight({
        date: `2024-0${(i % 3) + 1}-${String(i + 10).padStart(2, '0')}`,
        origin: i % 2 === 0 ? 'JFK' : 'LAX',
        destination: i % 2 === 0 ? 'LAX' : 'JFK',
      }),
    )
    const stats = calculateStats(flights)
    const insights = generateInsights(flights, stats)
    expect(insights.some((i) => i.id === 'seasonal-traveler')).toBe(true)
  })

  it('does not detect Weekend Warrior when most flights are weekdays', () => {
    // 2024-01-15 is Monday, 2024-01-16 is Tuesday, etc.
    const flights = [
      makeFlight({ date: '2024-01-15' }),
      makeFlight({ date: '2024-01-16' }),
      makeFlight({ date: '2024-01-17' }),
      makeFlight({ date: '2024-01-18' }),
    ]
    const stats = calculateStats(flights)
    const insights = generateInsights(flights, stats)
    expect(insights.some((i) => i.id === 'weekend-warrior')).toBe(false)
  })

  it('Frequent Flyer triggers at 20+ flights in a year', () => {
    const flights = Array.from({ length: 21 }, (_, i) =>
      makeFlight({
        date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
        flightNumber: `DL${i}`,
      }),
    )
    const stats = calculateStats(flights)
    const insights = generateInsights(flights, stats)
    expect(insights.some((i) => i.id === 'frequent-flyer')).toBe(true)
  })

  it('Frequent Flyer does not trigger at 19 flights', () => {
    const flights = Array.from({ length: 19 }, (_, i) =>
      makeFlight({
        date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
        flightNumber: `DL${i}`,
      }),
    )
    const stats = calculateStats(flights)
    const insights = generateInsights(flights, stats)
    expect(insights.some((i) => i.id === 'frequent-flyer')).toBe(false)
  })
})

describe('determineArchetype edge cases', () => {
  it('Explorer needs 10+ airports AND max route <=20%', () => {
    // 10 airports but one route >20% - should not be Explorer
    const flights = [
      ...Array.from({ length: 6 }, (_, i) =>
        makeFlight({ origin: 'JFK', destination: 'LAX', date: `2024-01-${String(i + 1).padStart(2, '0')}` }),
      ),
      makeFlight({ origin: 'SFO', destination: 'ORD', date: '2024-02-01' }),
      makeFlight({ origin: 'ATL', destination: 'DFW', date: '2024-02-02' }),
      makeFlight({ origin: 'DEN', destination: 'SEA', date: '2024-02-03' }),
      makeFlight({ origin: 'MIA', destination: 'BOS', date: '2024-02-04' }),
    ]
    const stats = calculateStats(flights)
    const archetype = determineArchetype(flights, stats)
    // 6/10 = 60% on one route -> should be Commuter not Explorer
    expect(archetype.id).toBe('commuter')
  })

  it('Commuter threshold is >40%', () => {
    // Exactly 40% should NOT trigger commuter
    const flights = [
      makeFlight({ origin: 'JFK', destination: 'LAX', date: '2024-01-01' }),
      makeFlight({ origin: 'JFK', destination: 'LAX', date: '2024-01-02' }),
      makeFlight({ origin: 'SFO', destination: 'ORD', date: '2024-01-03' }),
      makeFlight({ origin: 'ATL', destination: 'DFW', date: '2024-01-04' }),
      makeFlight({ origin: 'DEN', destination: 'SEA', date: '2024-01-05' }),
    ]
    const stats = calculateStats(flights)
    const archetype = determineArchetype(flights, stats)
    expect(archetype.id).not.toBe('commuter')
  })

  it('Road Warrior requires 30+ flights', () => {
    const flights = Array.from({ length: 29 }, (_, i) => {
      const routes = [
        { origin: 'JFK', destination: 'LAX' },
        { origin: 'SFO', destination: 'ORD' },
        { origin: 'ATL', destination: 'DFW' },
      ]
      const route = routes[i % routes.length]
      return makeFlight({ ...route, date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}` })
    })
    const stats = calculateStats(flights)
    const archetype = determineArchetype(flights, stats)
    // 29 flights, not 30 - should not be road warrior
    expect(archetype.id).not.toBe('road-warrior')
  })

  it('Weekender requires >60% weekend AND <15 flights', () => {
    // 16 flights all on weekends - too many to be weekender
    const flights = Array.from({ length: 16 }, (_, i) =>
      makeFlight({
        origin: i % 2 === 0 ? 'JFK' : 'LAX',
        destination: i % 2 === 0 ? 'LAX' : 'JFK',
        date: `2024-01-${String((i * 7 % 28) + 6).padStart(2, '0')}`, // ~Saturdays
      }),
    )
    const stats = calculateStats(flights)
    const archetype = determineArchetype(flights, stats)
    expect(archetype.id).not.toBe('weekender')
  })

  it('archetype priority: Commuter > Explorer > Road Warrior > Long Hauler > Weekender', () => {
    // A flight set that could match multiple - should get highest priority
    // 35 flights, >40% on one route → Commuter wins
    const flights = [
      ...Array.from({ length: 20 }, (_, i) =>
        makeFlight({ origin: 'JFK', destination: 'LAX', date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}` }),
      ),
      ...Array.from({ length: 15 }, (_, i) =>
        makeFlight({
          origin: 'SFO',
          destination: 'ORD',
          date: `2024-02-${String((i % 28) + 1).padStart(2, '0')}`,
          flightNumber: `AA${i}`,
        }),
      ),
    ]
    const stats = calculateStats(flights)
    const archetype = determineArchetype(flights, stats)
    expect(archetype.id).toBe('commuter')
  })
})
