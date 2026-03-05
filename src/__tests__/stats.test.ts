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

// Helper to create a batch of identical flights
function makeFlights(count: number, overrides: Partial<Flight> = {}): Flight[] {
  return Array.from({ length: count }, (_, i) =>
    makeFlight({ date: `2024-01-${String(i + 1).padStart(2, '0')}`, ...overrides }),
  )
}

describe('calculateStats', () => {
  it('returns zeros for empty array', () => {
    const stats = calculateStats([])
    expect(stats.totalFlights).toBe(0)
    expect(stats.totalMiles).toBe(0)
    expect(stats.uniqueAirports).toBe(0)
    expect(stats.mostFlownRoute).toBeNull()
    expect(stats.firstFlight).toBeNull()
    expect(stats.lastFlight).toBeNull()
  })

  it('calculates stats for a single flight', () => {
    const flights = [makeFlight()]
    const stats = calculateStats(flights)

    expect(stats.totalFlights).toBe(1)
    expect(stats.totalMiles).toBeGreaterThan(2400)
    expect(stats.totalMiles).toBeLessThan(2550)
    expect(stats.uniqueAirports).toBe(2)
    expect(stats.uniqueAirlines).toBe(1)
    expect(stats.firstFlight).toEqual(flights[0])
    expect(stats.lastFlight).toEqual(flights[0])
    expect(stats.domesticRatio).toBe(1) // JFK and LAX are both US
  })

  it('counts unique airports, cities, and countries', () => {
    const flights = [
      makeFlight({ origin: 'JFK', destination: 'LAX' }),
      makeFlight({ origin: 'SFO', destination: 'LHR', date: '2024-02-01' }),
    ]
    const stats = calculateStats(flights)

    expect(stats.uniqueAirports).toBe(4) // JFK, LAX, SFO, LHR
    expect(stats.uniqueCountries).toBeGreaterThanOrEqual(2) // US, UK
  })

  it('computes airline breakdown', () => {
    const flights = [
      makeFlight({ airline: 'Delta' }),
      makeFlight({ airline: 'Delta', date: '2024-02-01' }),
      makeFlight({ airline: 'United', date: '2024-03-01' }),
    ]
    const stats = calculateStats(flights)

    expect(stats.airlineBreakdown).toEqual({ Delta: 2, United: 1 })
    expect(stats.uniqueAirlines).toBe(2)
  })

  it('finds most flown route (undirected)', () => {
    const flights = [
      makeFlight({ origin: 'JFK', destination: 'LAX', date: '2024-01-01' }),
      makeFlight({ origin: 'LAX', destination: 'JFK', date: '2024-01-02' }),
      makeFlight({ origin: 'SFO', destination: 'ORD', date: '2024-01-03' }),
    ]
    const stats = calculateStats(flights)

    expect(stats.mostFlownRoute).not.toBeNull()
    expect(stats.mostFlownRoute!.count).toBe(2)
  })

  it('finds most visited airport', () => {
    const flights = [
      makeFlight({ origin: 'JFK', destination: 'LAX', date: '2024-01-01' }),
      makeFlight({ origin: 'JFK', destination: 'SFO', date: '2024-01-02' }),
      makeFlight({ origin: 'ORD', destination: 'JFK', date: '2024-01-03' }),
    ]
    const stats = calculateStats(flights)

    expect(stats.mostVisitedAirport).not.toBeNull()
    expect(stats.mostVisitedAirport!.iata).toBe('JFK')
    expect(stats.mostVisitedAirport!.count).toBe(3)
  })

  it('finds busiest month', () => {
    const flights = [
      makeFlight({ date: '2024-03-01' }),
      makeFlight({ date: '2024-03-15' }),
      makeFlight({ date: '2024-06-01' }),
    ]
    const stats = calculateStats(flights)

    expect(stats.busiestMonth).toEqual({ month: '2024-03', count: 2 })
  })

  it('identifies first and last flights', () => {
    const flights = [
      makeFlight({ date: '2024-06-01' }),
      makeFlight({ date: '2023-01-15' }),
      makeFlight({ date: '2024-12-25' }),
    ]
    const stats = calculateStats(flights)

    expect(stats.firstFlight!.date).toBe('2023-01-15')
    expect(stats.lastFlight!.date).toBe('2024-12-25')
  })

  it('tracks longest and shortest routes', () => {
    const flights = [
      makeFlight({ origin: 'JFK', destination: 'LHR', date: '2024-01-01' }), // ~3450 mi
      makeFlight({ origin: 'JFK', destination: 'BOS', date: '2024-01-02' }), // ~187 mi
    ]
    const stats = calculateStats(flights)

    expect(stats.longestRoute).not.toBeNull()
    expect(stats.longestRoute!.origin).toBe('JFK')
    expect(stats.longestRoute!.destination).toBe('LHR')
    expect(stats.shortestRoute).not.toBeNull()
    expect(stats.shortestRoute!.origin).toBe('JFK')
    expect(stats.shortestRoute!.destination).toBe('BOS')
  })

  it('calculates domestic ratio', () => {
    const flights = [
      makeFlight({ origin: 'JFK', destination: 'LAX', date: '2024-01-01' }), // domestic
      makeFlight({ origin: 'JFK', destination: 'LHR', date: '2024-01-02' }), // international
    ]
    const stats = calculateStats(flights)

    expect(stats.domesticRatio).toBe(0.5)
  })

  it('groups flights by year', () => {
    const flights = [
      makeFlight({ date: '2023-01-01' }),
      makeFlight({ date: '2023-06-01' }),
      makeFlight({ date: '2024-01-01' }),
    ]
    const stats = calculateStats(flights)

    expect(stats.flightsByYear).toEqual({ '2023': 2, '2024': 1 })
  })

  it('estimates hours and CO2', () => {
    const flights = [makeFlight()] // JFK-LAX ~2475 mi
    const stats = calculateStats(flights)

    expect(stats.estimatedHours).toBeGreaterThan(4)
    expect(stats.estimatedHours).toBeLessThan(6)
    expect(stats.co2Tons).toBeGreaterThan(0.5)
    expect(stats.co2Tons).toBeLessThan(0.8)
  })

  it('handles all same route', () => {
    const flights = makeFlights(5)
    const stats = calculateStats(flights)

    expect(stats.totalFlights).toBe(5)
    expect(stats.uniqueAirports).toBe(2)
    expect(stats.mostFlownRoute!.count).toBe(5)
  })
})

describe('calculateFunStats', () => {
  it('computes earth orbits and moon percentage', () => {
    const stats = calculateStats([makeFlight()])
    const fun = calculateFunStats(stats)

    expect(fun.earthOrbits).toBeGreaterThan(0.09)
    expect(fun.earthOrbits).toBeLessThan(0.11)
    expect(fun.moonPercent).toBeGreaterThan(1)
    expect(fun.moonPercent).toBeLessThan(1.1)
    expect(fun.daysInAir).toBeGreaterThan(0.1)
    expect(fun.speedComparison).toBeGreaterThan(100)
  })

  it('gives appropriate distance label for high mileage', () => {
    const stats: FlightStats = {
      totalFlights: 100,
      totalMiles: 500000,
      uniqueAirports: 50,
      uniqueCities: 40,
      uniqueCountries: 20,
      uniqueAirlines: 10,
      airlineBreakdown: {},
      mostFlownRoute: null,
      mostVisitedAirport: null,
      busiestMonth: null,
      firstFlight: null,
      lastFlight: null,
      longestRoute: null,
      shortestRoute: null,
      domesticRatio: 0.5,
      flightsByYear: {},
      flightsByMonth: {},
      estimatedHours: 1000,
      co2Tons: 127.5,
    }
    const fun = calculateFunStats(stats)

    expect(fun.earthOrbits).toBeGreaterThan(20)
    expect(fun.distanceLabel).toContain('Moon and back')
  })

  it('gives low mileage label', () => {
    const stats: FlightStats = {
      totalFlights: 1,
      totalMiles: 500,
      uniqueAirports: 2,
      uniqueCities: 2,
      uniqueCountries: 1,
      uniqueAirlines: 1,
      airlineBreakdown: {},
      mostFlownRoute: null,
      mostVisitedAirport: null,
      busiestMonth: null,
      firstFlight: null,
      lastFlight: null,
      longestRoute: null,
      shortestRoute: null,
      domesticRatio: 1,
      flightsByYear: {},
      flightsByMonth: {},
      estimatedHours: 1,
      co2Tons: 0.1,
    }
    const fun = calculateFunStats(stats)
    expect(fun.distanceLabel).toContain('a lot of flying')
  })
})

describe('generateInsights', () => {
  it('returns empty array for no flights', () => {
    const stats = calculateStats([])
    expect(generateInsights([], stats)).toEqual([])
  })

  it('detects Weekend Warrior', () => {
    // 2024-01-05 is a Friday, 2024-01-06 is Saturday, 2024-01-07 is Sunday
    const flights = [
      makeFlight({ date: '2024-01-05' }),
      makeFlight({ date: '2024-01-06' }),
      makeFlight({ date: '2024-01-07' }),
    ]
    const stats = calculateStats(flights)
    const insights = generateInsights(flights, stats)

    expect(insights.some((i) => i.id === 'weekend-warrior')).toBe(true)
  })

  it('detects Loyalty King', () => {
    const flights = makeFlights(5, { airline: 'Delta' })
    const stats = calculateStats(flights)
    const insights = generateInsights(flights, stats)

    expect(insights.some((i) => i.id === 'loyalty-king')).toBe(true)
  })

  it('detects Globe Trotter for 5+ countries', () => {
    const flights = [
      makeFlight({ origin: 'JFK', destination: 'LHR', date: '2024-01-01' }), // US, UK
      makeFlight({ origin: 'CDG', destination: 'NRT', date: '2024-01-02' }), // France, Japan
      makeFlight({ origin: 'SYD', destination: 'JFK', date: '2024-01-03' }), // Australia, US
    ]
    const stats = calculateStats(flights)
    const insights = generateInsights(flights, stats)

    expect(insights.some((i) => i.id === 'globe-trotter')).toBe(true)
  })

  it('detects Domestic Flyer', () => {
    const flights = makeFlights(5) // All JFK-LAX (domestic)
    const stats = calculateStats(flights)
    const insights = generateInsights(flights, stats)

    expect(insights.some((i) => i.id === 'domestic-flyer')).toBe(true)
  })

  it('detects International Jet-Setter', () => {
    const flights = [
      makeFlight({ origin: 'JFK', destination: 'LHR', date: '2024-01-01' }),
      makeFlight({ origin: 'CDG', destination: 'NRT', date: '2024-01-02' }),
      makeFlight({ origin: 'LHR', destination: 'CDG', date: '2024-01-03' }),
    ]
    const stats = calculateStats(flights)
    const insights = generateInsights(flights, stats)

    expect(insights.some((i) => i.id === 'international-jet-setter')).toBe(true)
  })

  it('detects Coast to Coast', () => {
    const flights = [
      makeFlight({ origin: 'JFK', destination: 'LAX', date: '2024-01-01' }),
    ]
    const stats = calculateStats(flights)
    const insights = generateInsights(flights, stats)

    expect(insights.some((i) => i.id === 'coast-to-coast')).toBe(true)
  })

  it('detects Hub Hugger', () => {
    const flights = [
      makeFlight({ origin: 'JFK', destination: 'LAX', date: '2024-01-01' }),
      makeFlight({ origin: 'JFK', destination: 'SFO', date: '2024-01-02' }),
      makeFlight({ origin: 'JFK', destination: 'ORD', date: '2024-01-03' }),
    ]
    const stats = calculateStats(flights)
    const insights = generateInsights(flights, stats)

    expect(insights.some((i) => i.id === 'hub-hugger')).toBe(true)
  })
})

describe('determineArchetype', () => {
  it('returns Occasional Flyer for empty flights', () => {
    const stats = calculateStats([])
    const archetype = determineArchetype([], stats)
    expect(archetype.id).toBe('occasional-flyer')
  })

  it('detects The Commuter (>40% same route)', () => {
    const flights = [
      ...makeFlights(5), // JFK-LAX
      makeFlight({ origin: 'SFO', destination: 'ORD', date: '2024-02-01' }),
      makeFlight({ origin: 'BOS', destination: 'MIA', date: '2024-02-02' }),
    ]
    const stats = calculateStats(flights)
    const archetype = determineArchetype(flights, stats)
    expect(archetype.id).toBe('commuter')
  })

  it('detects The Explorer (10+ airports, diverse routes)', () => {
    const airports = ['JFK', 'LAX', 'SFO', 'ORD', 'ATL', 'DFW', 'DEN', 'SEA', 'MIA', 'BOS', 'IAD']
    const flights = airports.slice(0, -1).map((origin, i) =>
      makeFlight({ origin, destination: airports[i + 1], date: `2024-${String(i + 1).padStart(2, '0')}-01` }),
    )
    const stats = calculateStats(flights)
    const archetype = determineArchetype(flights, stats)
    expect(archetype.id).toBe('explorer')
  })

  it('detects The Road Warrior (30+ flights)', () => {
    // Need 30+ flights with varied routes to not trigger Commuter
    const routes = [
      { origin: 'JFK', destination: 'LAX' },
      { origin: 'SFO', destination: 'ORD' },
      { origin: 'ATL', destination: 'DFW' },
      { origin: 'DEN', destination: 'SEA' },
      { origin: 'MIA', destination: 'BOS' },
    ]
    const flights = Array.from({ length: 32 }, (_, i) => {
      const route = routes[i % routes.length]
      return makeFlight({ ...route, date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}` })
    })
    const stats = calculateStats(flights)
    const archetype = determineArchetype(flights, stats)
    expect(archetype.id).toBe('road-warrior')
  })

  it('detects The Long Hauler (avg >2000mi)', () => {
    const flights = [
      makeFlight({ origin: 'JFK', destination: 'LHR', date: '2024-01-01' }), // ~3450 mi
      makeFlight({ origin: 'LAX', destination: 'NRT', date: '2024-01-02' }), // ~5450 mi
      makeFlight({ origin: 'SFO', destination: 'CDG', date: '2024-01-03' }), // ~5500 mi
    ]
    const stats = calculateStats(flights)
    const archetype = determineArchetype(flights, stats)
    expect(archetype.id).toBe('long-hauler')
  })

  it('detects The Weekender', () => {
    // All on weekends, fewer than 15 flights, varied routes to avoid Commuter but <10 airports to avoid Explorer
    const flights = [
      makeFlight({ origin: 'JFK', destination: 'LAX', date: '2024-01-05' }), // Friday
      makeFlight({ origin: 'LAX', destination: 'SFO', date: '2024-01-06' }), // Saturday
      makeFlight({ origin: 'SFO', destination: 'JFK', date: '2024-01-07' }), // Sunday
      makeFlight({ origin: 'JFK', destination: 'ORD', date: '2024-01-12' }), // Friday
      makeFlight({ origin: 'ORD', destination: 'LAX', date: '2024-01-13' }), // Saturday
    ]
    const stats = calculateStats(flights)
    const archetype = determineArchetype(flights, stats)
    expect(archetype.id).toBe('weekender')
  })

  it('falls back to Occasional Flyer', () => {
    // Varied short routes, weekday, few flights — no archetype should match
    const flights = [
      makeFlight({ origin: 'JFK', destination: 'BOS', date: '2024-01-15' }), // Tuesday, short
      makeFlight({ origin: 'ORD', destination: 'DFW', date: '2024-01-16' }), // Wednesday, short
      makeFlight({ origin: 'ATL', destination: 'MIA', date: '2024-01-17' }), // Thursday, short
    ]
    const stats = calculateStats(flights)
    const archetype = determineArchetype(flights, stats)
    expect(archetype.id).toBe('occasional-flyer')
  })
})
