import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureGmail, isDomainRelevant } from '@/lib/gmail'

describe('configureGmail', () => {
  it('does not throw', () => {
    expect(() => configureGmail({ clientId: 'test-id', redirectUri: 'http://localhost' })).not.toThrow()
  })
})

describe('isDomainRelevant', () => {
  it('returns true for airline domains', () => {
    expect(isDomainRelevant('united.com')).toBe(true)
    expect(isDomainRelevant('delta.com')).toBe(true)
    expect(isDomainRelevant('emirates.com')).toBe(true)
  })

  it('returns true for booking platforms', () => {
    expect(isDomainRelevant('expedia.com')).toBe(true)
    expect(isDomainRelevant('kayak.com')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isDomainRelevant('UNITED.COM')).toBe(true)
    expect(isDomainRelevant('Delta.Com')).toBe(true)
  })

  it('returns false for non-airline domains', () => {
    expect(isDomainRelevant('gmail.com')).toBe(false)
    expect(isDomainRelevant('amazon.com')).toBe(false)
    expect(isDomainRelevant('twitter.com')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isDomainRelevant('')).toBe(false)
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
    await expect(handleCallback('test-code')).rejects.toThrow('Missing code verifier')
  })
})
