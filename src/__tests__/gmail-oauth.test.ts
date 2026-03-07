// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Gmail OAuth PKCE flow', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  describe('initiateAuth', () => {
    it('stores verifier and state in sessionStorage', async () => {
      // Mock window.location.href setter
      const hrefSetter = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { ...window.location, href: '' },
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window.location, 'href', {
        set: hrefSetter,
        get: () => 'http://localhost',
        configurable: true,
      })

      const { configureGmail, initiateAuth } = await import('@/lib/gmail')
      configureGmail({ clientId: 'test-client-id', redirectUri: 'http://localhost' })

      await initiateAuth()

      expect(sessionStorage.getItem('gmail_code_verifier')).toBeTruthy()
      expect(sessionStorage.getItem('gmail_oauth_state')).toBeTruthy()
      expect(hrefSetter).toHaveBeenCalledWith(expect.stringContaining('accounts.google.com'))
      expect(hrefSetter).toHaveBeenCalledWith(expect.stringContaining('state='))
    })
  })

  describe('handleCallback', () => {
    it('validates state parameter', async () => {
      sessionStorage.setItem('gmail_code_verifier', 'test-verifier')
      sessionStorage.setItem('gmail_oauth_state', 'correct-state')

      const { handleCallback } = await import('@/lib/gmail')
      await expect(handleCallback('test-code', 'wrong-state')).rejects.toThrow('state mismatch')
    })

    it('throws when state is null but saved state exists', async () => {
      sessionStorage.setItem('gmail_code_verifier', 'test-verifier')
      sessionStorage.setItem('gmail_oauth_state', 'some-state')

      const { handleCallback } = await import('@/lib/gmail')
      await expect(handleCallback('test-code', null)).rejects.toThrow('state mismatch')
    })

    it('cleans up sessionStorage on state mismatch', async () => {
      sessionStorage.setItem('gmail_code_verifier', 'test-verifier')
      sessionStorage.setItem('gmail_oauth_state', 'correct-state')

      const { handleCallback } = await import('@/lib/gmail')
      try {
        await handleCallback('test-code', 'wrong-state')
      } catch {
        // expected
      }
      expect(sessionStorage.getItem('gmail_code_verifier')).toBeNull()
      expect(sessionStorage.getItem('gmail_oauth_state')).toBeNull()
    })
  })

  describe('getCallbackCode', () => {
    it('returns code and state from URL', async () => {
      Object.defineProperty(window, 'location', {
        value: new URL('http://localhost/?code=auth-code&state=my-state'),
        writable: true,
        configurable: true,
      })

      const { getCallbackCode } = await import('@/lib/gmail')
      const result = getCallbackCode()
      expect(result).toEqual({ code: 'auth-code', state: 'my-state' })
    })

    it('returns null when no code in URL', async () => {
      Object.defineProperty(window, 'location', {
        value: new URL('http://localhost/'),
        writable: true,
        configurable: true,
      })

      const { getCallbackCode } = await import('@/lib/gmail')
      expect(getCallbackCode()).toBeNull()
    })
  })
})
