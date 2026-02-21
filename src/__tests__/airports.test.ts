import { describe, it, expect } from 'vitest'
import { lookupAirport, isValidIATA, calculateDistance, getAirportCount } from '@/lib/airports'

describe('Airport database', () => {
  it('has loaded a substantial number of airports', () => {
    expect(getAirportCount()).toBeGreaterThan(5000)
  })

  it('looks up JFK correctly', () => {
    const jfk = lookupAirport('JFK')
    expect(jfk).not.toBeNull()
    expect(jfk!.city).toBe('New York')
    expect(jfk!.country).toBe('United States')
    expect(jfk!.timezone).toBe('America/New_York')
  })

  it('looks up airports case-insensitively', () => {
    expect(lookupAirport('jfk')).not.toBeNull()
    expect(lookupAirport('Jfk')).not.toBeNull()
  })

  it('returns null for invalid IATA codes', () => {
    expect(lookupAirport('ZZZ')).toBeNull()
    expect(lookupAirport('QQQ')).toBeNull()
    expect(lookupAirport('')).toBeNull()
  })

  it('validates IATA codes correctly', () => {
    expect(isValidIATA('LAX')).toBe(true)
    expect(isValidIATA('SFO')).toBe(true)
    expect(isValidIATA('XYZ')).toBe(false)
  })
})

describe('Haversine distance calculation', () => {
  it('calculates JFK to LAX distance (~2,475 miles)', () => {
    const distance = calculateDistance('JFK', 'LAX')
    expect(distance).toBeGreaterThan(2400)
    expect(distance).toBeLessThan(2550)
  })

  it('calculates SFO to ORD distance (~1,846 miles)', () => {
    const distance = calculateDistance('SFO', 'ORD')
    expect(distance).toBeGreaterThan(1800)
    expect(distance).toBeLessThan(1900)
  })

  it('calculates JFK to LHR distance (~3,459 miles)', () => {
    const distance = calculateDistance('JFK', 'LHR')
    expect(distance).toBeGreaterThan(3400)
    expect(distance).toBeLessThan(3550)
  })

  it('returns 0 for same origin and destination', () => {
    expect(calculateDistance('JFK', 'JFK')).toBe(0)
  })

  it('returns 0 for invalid airport codes', () => {
    expect(calculateDistance('JFK', 'ZZZ')).toBe(0)
    expect(calculateDistance('ZZZ', 'LAX')).toBe(0)
  })

  it('is symmetric (A→B = B→A)', () => {
    const ab = calculateDistance('JFK', 'LAX')
    const ba = calculateDistance('LAX', 'JFK')
    expect(Math.abs(ab - ba)).toBeLessThan(0.01)
  })
})
