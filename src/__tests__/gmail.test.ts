import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureGmail } from '@/lib/gmail'
import { isAirlineDomain } from '@/lib/domains'

describe('configureGmail', () => {
  it('does not throw', () => {
    expect(() => configureGmail({ clientId: 'test-id', redirectUri: 'http://localhost' })).not.toThrow()
  })
})

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

describe('clearCallbackParams', () => {
  beforeEach(() => {
    // Reset URL
    vi.stubGlobal('location', new URL('http://localhost'))
  })

  it('getCallbackCode returns null when no code in URL', async () => {
    // We need to set window.location.search
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost/'),
      writable: true,
    })
    const { getCallbackCode } = await import('@/lib/gmail')
    expect(getCallbackCode()).toBeNull()
  })
})

describe('handleCallback', () => {
  it('throws when code verifier is missing from sessionStorage', async () => {
    sessionStorage.clear()
    const { handleCallback } = await import('@/lib/gmail')
    await expect(handleCallback('test-code', null)).rejects.toThrow('Session expired')
  })
})
