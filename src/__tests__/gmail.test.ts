import { describe, it, expect } from 'vitest'
import { isAirlineDomain } from '@/lib/domains'

describe('isAirlineDomain', () => {
  it('returns true for airline domains', () => {
    expect(isAirlineDomain('united.com')).toBe(true)
    expect(isAirlineDomain('delta.com')).toBe(true)
    expect(isAirlineDomain('emirates.com')).toBe(true)
  })

  it('returns true for booking platforms', () => {
    expect(isAirlineDomain('expedia.com')).toBe(true)
    expect(isAirlineDomain('kayak.com')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isAirlineDomain('UNITED.COM')).toBe(true)
    expect(isAirlineDomain('Delta.Com')).toBe(true)
  })

  it('returns false for non-airline domains', () => {
    expect(isAirlineDomain('gmail.com')).toBe(false)
    expect(isAirlineDomain('amazon.com')).toBe(false)
    expect(isAirlineDomain('twitter.com')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isAirlineDomain('')).toBe(false)
  })
})
