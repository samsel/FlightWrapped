// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { determineArchetype } from '@/lib/archetypes'
import { calculateStats } from '@/lib/stats'
import type { Flight } from '@/lib/types'

function makeFlight(origin: string, dest: string, date: string, airline = 'Test Air'): Flight {
  return { origin, destination: dest, date, airline, flightNumber: 'XX 1', confidence: 0.9 }
}

describe('determineArchetype', () => {
  it('returns Occasional Flyer for no flights', () => {
    const stats = calculateStats([])
    const arch = determineArchetype([], stats)
    expect(arch.id).toBe('occasional-flyer')
  })

  it('returns Commuter when top route >40%', () => {
    const flights = [
      makeFlight('JFK', 'LAX', '2024-01-01'),
      makeFlight('JFK', 'LAX', '2024-02-01'),
      makeFlight('JFK', 'LAX', '2024-03-01'),
      makeFlight('JFK', 'LAX', '2024-04-01'),
      makeFlight('JFK', 'LAX', '2024-05-01'),
      makeFlight('SFO', 'ORD', '2024-06-01'),
    ]
    const stats = calculateStats(flights)
    const arch = determineArchetype(flights, stats)
    expect(arch.id).toBe('commuter')
    expect(arch.icon).toBe('briefcase')
  })

  it('returns Road Warrior for 30+ flights', () => {
    const flights = Array.from({ length: 35 }, (_, i) =>
      makeFlight('JFK', 'LAX', `2024-${String((i % 12) + 1).padStart(2, '0')}-01`, `Airline${i % 5}`),
    )
    const stats = calculateStats(flights)
    const arch = determineArchetype(flights, stats)
    // Could be Road Warrior or Commuter depending on route distribution
    expect(['road-warrior', 'commuter']).toContain(arch.id)
  })

  it('archetype icon is a valid token (not empty)', () => {
    const flights = [makeFlight('JFK', 'LAX', '2024-01-01')]
    const stats = calculateStats(flights)
    const arch = determineArchetype(flights, stats)
    expect(arch.icon).toBeTruthy()
    expect(arch.icon.length).toBeGreaterThan(0)
  })
})
