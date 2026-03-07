// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { calculateFunStats } from '@/lib/funStats'
import { calculateStats } from '@/lib/stats'
import type { Flight } from '@/lib/types'

function makeFlight(origin: string, dest: string, date: string): Flight {
  return { origin, destination: dest, date, airline: 'Test', flightNumber: 'XX 1', confidence: 0.9 }
}

describe('calculateFunStats', () => {
  it('returns zeros for empty stats', () => {
    const stats = calculateStats([])
    const fun = calculateFunStats(stats)
    expect(fun.earthOrbits).toBe(0)
    expect(fun.moonPercent).toBe(0)
    expect(fun.daysInAir).toBe(0)
    expect(fun.speedComparison).toBe(0)
  })

  it('calculates earth orbits correctly', () => {
    const flights = [
      makeFlight('JFK', 'LAX', '2024-01-01'),
      makeFlight('LAX', 'JFK', '2024-01-10'),
    ]
    const stats = calculateStats(flights)
    const fun = calculateFunStats(stats)
    expect(fun.earthOrbits).toBeGreaterThan(0)
    expect(fun.moonPercent).toBeGreaterThan(0)
    expect(fun.daysInAir).toBeGreaterThan(0)
  })

  it('produces a distance label', () => {
    const flights = [makeFlight('JFK', 'LAX', '2024-01-01')]
    const stats = calculateStats(flights)
    const fun = calculateFunStats(stats)
    expect(fun.distanceLabel).toBeTruthy()
    expect(fun.distanceLabel.length).toBeGreaterThan(0)
  })

  it('produces speed comparison for non-zero hours', () => {
    const flights = [makeFlight('JFK', 'LAX', '2024-01-01')]
    const stats = calculateStats(flights)
    const fun = calculateFunStats(stats)
    expect(fun.speedComparison).toBeGreaterThan(0)
  })
})
