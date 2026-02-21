import { describe, it, expect } from 'vitest'
import { isAirlineDomain, AIRLINE_DOMAINS } from '@/lib/domains'

describe('Airline domain list', () => {
  it('has a substantial number of domains', () => {
    expect(AIRLINE_DOMAINS.size).toBeGreaterThan(150)
  })

  it('recognizes major US airlines', () => {
    expect(isAirlineDomain('united.com')).toBe(true)
    expect(isAirlineDomain('delta.com')).toBe(true)
    expect(isAirlineDomain('aa.com')).toBe(true)
    expect(isAirlineDomain('southwest.com')).toBe(true)
    expect(isAirlineDomain('jetblue.com')).toBe(true)
  })

  it('recognizes international airlines', () => {
    expect(isAirlineDomain('britishairways.com')).toBe(true)
    expect(isAirlineDomain('emirates.com')).toBe(true)
    expect(isAirlineDomain('singaporeair.com')).toBe(true)
    expect(isAirlineDomain('qantas.com')).toBe(true)
  })

  it('recognizes booking platforms', () => {
    expect(isAirlineDomain('expedia.com')).toBe(true)
    expect(isAirlineDomain('kayak.com')).toBe(true)
    expect(isAirlineDomain('booking.com')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isAirlineDomain('UNITED.COM')).toBe(true)
    expect(isAirlineDomain('Delta.Com')).toBe(true)
  })

  it('rejects non-airline domains', () => {
    expect(isAirlineDomain('gmail.com')).toBe(false)
    expect(isAirlineDomain('amazon.com')).toBe(false)
    expect(isAirlineDomain('facebook.com')).toBe(false)
  })
})
