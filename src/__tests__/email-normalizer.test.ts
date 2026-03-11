// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { normalizeEmail, extractSenderDomainFast } from '@/lib/email-normalizer'
import type { RawEmail } from '@/lib/types'

describe('email normalizer', () => {
  it('extracts sender domain, subject, and body from a plain text email', async () => {
    const raw: RawEmail = {
      raw: [
        'From: bookings@united.com',
        'To: user@example.com',
        'Subject: Your Flight Confirmation - UA 1234',
        'Date: Mon, 15 Jan 2024 10:30:00 +0000',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Your flight UA 1234 from JFK to LAX on January 15, 2024 is confirmed.',
      ].join('\r\n'),
    }

    const result = await normalizeEmail(raw)

    expect(result.senderAddress).toBe('bookings@united.com')
    expect(result.senderDomain).toBe('united.com')
    expect(result.subject).toBe('Your Flight Confirmation - UA 1234')
    expect(result.textBody).toContain('UA 1234')
    expect(result.textBody).toContain('JFK')
    expect(result.date).toBeTruthy()
  })

  it('extracts HTML body from multipart email', async () => {
    const boundary = '----=_Part_123'
    const raw: RawEmail = {
      raw: [
        'From: noreply@delta.com',
        'To: user@example.com',
        'Subject: Booking Confirmed',
        'Date: Tue, 20 Feb 2024 08:00:00 +0000',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `------=_Part_123`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Plain text version',
        '',
        `------=_Part_123`,
        'Content-Type: text/html; charset=utf-8',
        '',
        '<html><body><p>HTML version with <strong>DL 456</strong></p></body></html>',
        '',
        `------=_Part_123--`,
      ].join('\r\n'),
    }

    const result = await normalizeEmail(raw)

    expect(result.senderDomain).toBe('delta.com')
    expect(result.textBody).toContain('Plain text version')
    expect(result.htmlBody).toContain('DL 456')
  })

  describe('extractSenderDomainFast', () => {
    it('extracts domain from angle-bracket From header', () => {
      const raw = 'From: John Doe <bookings@united.com>\r\nSubject: Test\r\n\r\nBody'
      expect(extractSenderDomainFast(raw)).toBe('united.com')
    })

    it('extracts domain from bare From header', () => {
      const raw = 'From: noreply@delta.com\r\nSubject: Test\r\n\r\nBody'
      expect(extractSenderDomainFast(raw)).toBe('delta.com')
    })

    it('handles ArrayBuffer input', () => {
      const raw = new TextEncoder().encode(
        'From: bookings@emirates.com\r\nSubject: Test\r\n\r\nBody',
      ).buffer
      expect(extractSenderDomainFast(raw)).toBe('emirates.com')
    })

    it('returns empty string for emails without From header', () => {
      const raw = 'Subject: No sender\r\nDate: Mon, 1 Jan 2024\r\n\r\nBody'
      expect(extractSenderDomainFast(raw)).toBe('')
    })

    it('handles subdomain From addresses', () => {
      const raw = 'From: noreply@email.united.com\r\nSubject: Test\r\n\r\nBody'
      expect(extractSenderDomainFast(raw)).toBe('email.united.com')
    })

    it('is case insensitive for the From header name', () => {
      const raw = 'from: test@AA.COM\r\nSubject: Test\r\n\r\nBody'
      expect(extractSenderDomainFast(raw)).toBe('aa.com')
    })
  })

  it('handles email with no sender gracefully', async () => {
    const raw: RawEmail = {
      raw: [
        'Subject: No sender',
        'Date: Wed, 1 Jan 2024 00:00:00 +0000',
        'Content-Type: text/plain',
        '',
        'Body content',
      ].join('\r\n'),
    }

    const result = await normalizeEmail(raw)

    expect(result.senderAddress).toBe('')
    expect(result.senderDomain).toBe('')
    expect(result.subject).toBe('No sender')
  })
})
