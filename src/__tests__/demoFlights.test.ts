import { describe, it, expect } from 'vitest'
import { DEMO_FLIGHTS } from '@/components/landing/demoFlights'
import { isValidIATA } from '@/lib/airports'
import { calculateStats } from '@/lib/stats'
import { calculateFunStats } from '@/lib/funStats'
import { generateInsights } from '@/lib/insights'
import { determineArchetype } from '@/lib/archetypes'

describe('demo flights data integrity', () => {
  it('has a reasonable number of flights', () => {
    expect(DEMO_FLIGHTS.length).toBeGreaterThan(20)
    expect(DEMO_FLIGHTS.length).toBeLessThan(200)
  })

  it('all flights have valid IATA origin codes', () => {
    const invalid = DEMO_FLIGHTS.filter((f) => !isValidIATA(f.origin)).map((f) => f.origin)
    expect(invalid).toEqual([])
  })

  it('all flights have valid IATA destination codes', () => {
    const invalid = DEMO_FLIGHTS.filter((f) => !isValidIATA(f.destination)).map((f) => f.destination)
    expect(invalid).toEqual([])
  })

  it('no flight has same origin and destination', () => {
    for (const f of DEMO_FLIGHTS) {
      expect(f.origin).not.toBe(f.destination)
    }
  })

  it('all flights have valid ISO date format', () => {
    for (const f of DEMO_FLIGHTS) {
      expect(f.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      // Also verify it's a valid date
      const d = new Date(f.date + 'T00:00:00Z')
      expect(isNaN(d.getTime())).toBe(false)
    }
  })

  it('all flights have non-empty airline', () => {
    for (const f of DEMO_FLIGHTS) {
      expect(f.airline.length).toBeGreaterThan(0)
    }
  })

  it('all flights have non-empty flight number', () => {
    for (const f of DEMO_FLIGHTS) {
      expect(f.flightNumber.length).toBeGreaterThan(0)
    }
  })

  it('all flights have confidence of 1', () => {
    for (const f of DEMO_FLIGHTS) {
      expect(f.confidence).toBe(1)
    }
  })

  it('does not contain defunct airlines', () => {
    const defunct = ['Alitalia', 'Monarch', 'Thomas Cook', 'WOW air']
    for (const f of DEMO_FLIGHTS) {
      for (const airline of defunct) {
        expect(f.airline).not.toBe(airline)
      }
    }
  })

  it('dates are in chronological order', () => {
    const dates = DEMO_FLIGHTS.map((f) => f.date)
    const sorted = [...dates].sort()
    expect(dates).toEqual(sorted)
  })

  it('spans multiple years', () => {
    const years = new Set(DEMO_FLIGHTS.map((f) => f.date.slice(0, 4)))
    expect(years.size).toBeGreaterThanOrEqual(2)
  })

  it('spans multiple continents', () => {
    const stats = calculateStats(DEMO_FLIGHTS)
    expect(stats.uniqueCountries).toBeGreaterThanOrEqual(5)
  })
})

describe('demo flights produce valid stats', () => {
  it('calculateStats runs without error', () => {
    const stats = calculateStats(DEMO_FLIGHTS)
    expect(stats.totalFlights).toBe(DEMO_FLIGHTS.length)
    expect(stats.totalMiles).toBeGreaterThan(0)
    expect(stats.uniqueAirports).toBeGreaterThan(10)
  })

  it('calculateFunStats runs without error', () => {
    const stats = calculateStats(DEMO_FLIGHTS)
    const fun = calculateFunStats(stats)
    expect(fun.earthOrbits).toBeGreaterThan(0)
    expect(fun.daysInAir).toBeGreaterThan(0)
    expect(fun.distanceLabel.length).toBeGreaterThan(0)
  })

  it('generateInsights produces insights', () => {
    const stats = calculateStats(DEMO_FLIGHTS)
    const insights = generateInsights(DEMO_FLIGHTS, stats)
    expect(insights.length).toBeGreaterThan(0)
  })

  it('determineArchetype returns a valid archetype', () => {
    const stats = calculateStats(DEMO_FLIGHTS)
    const archetype = determineArchetype(DEMO_FLIGHTS, stats)
    expect(archetype.id).toBeTruthy()
    expect(archetype.name).toBeTruthy()
    expect(archetype.description).toBeTruthy()
  })
})
