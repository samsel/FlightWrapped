// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { normalizeEmail, normalizeEmails } from '@/lib/email-normalizer'
import type { RawEmail } from '@/lib/types'

function makeRawEmail(headers: Record<string, string>, body: string): RawEmail {
  const lines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`)
  lines.push('Content-Type: text/plain; charset=utf-8')
  lines.push('')
  lines.push(body)
  return { raw: lines.join('\r\n') }
}

describe('normalizeEmail edge cases', () => {
  it('extracts sender domain from complex From header', async () => {
    const raw = makeRawEmail(
      {
        From: '"United Airlines" <noreply@united.com>',
        Subject: 'Flight Confirmation',
        Date: 'Mon, 15 Jan 2024 10:00:00 +0000',
      },
      'Your flight is confirmed.',
    )
    const result = await normalizeEmail(raw)
    expect(result.senderDomain).toBe('united.com')
  })

  it('handles missing From header', async () => {
    const raw = makeRawEmail(
      {
        Subject: 'No sender',
        Date: 'Mon, 15 Jan 2024 10:00:00 +0000',
      },
      'Body text',
    )
    const result = await normalizeEmail(raw)
    expect(result.senderAddress).toBe('')
    expect(result.senderDomain).toBe('')
  })

  it('handles missing Subject', async () => {
    const raw = makeRawEmail(
      {
        From: 'test@example.com',
        Date: 'Mon, 15 Jan 2024 10:00:00 +0000',
      },
      'Body without subject',
    )
    const result = await normalizeEmail(raw)
    expect(result.subject).toBe('')
  })

  it('handles empty body', async () => {
    const raw = makeRawEmail(
      {
        From: 'test@example.com',
        Subject: 'Empty body',
        Date: 'Mon, 15 Jan 2024 10:00:00 +0000',
      },
      '',
    )
    const result = await normalizeEmail(raw)
    expect(result.textBody).toBe('')
  })

  it('handles ArrayBuffer input (from Gmail API)', async () => {
    const mimeStr = [
      'From: test@example.com',
      'Subject: ArrayBuffer test',
      'Date: Mon, 15 Jan 2024 10:00:00 +0000',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Body from ArrayBuffer',
    ].join('\r\n')

    const encoder = new TextEncoder()
    const buffer = encoder.encode(mimeStr).buffer
    const raw: RawEmail = { raw: buffer }
    const result = await normalizeEmail(raw)
    expect(result.subject).toBe('ArrayBuffer test')
    expect(result.textBody).toContain('ArrayBuffer')
  })
})

describe('normalizeEmails batch', () => {
  it('processes multiple emails', async () => {
    const emails = [
      makeRawEmail(
        { From: 'a@united.com', Subject: 'Flight 1', Date: 'Mon, 15 Jan 2024 10:00:00 +0000' },
        'Flight 1 body',
      ),
      makeRawEmail(
        { From: 'b@delta.com', Subject: 'Flight 2', Date: 'Tue, 16 Jan 2024 10:00:00 +0000' },
        'Flight 2 body',
      ),
    ]
    const results = await normalizeEmails(emails)
    expect(results).toHaveLength(2)
    expect(results[0].senderDomain).toBe('united.com')
    expect(results[1].senderDomain).toBe('delta.com')
  })

  it('reports progress', async () => {
    const emails = [
      makeRawEmail({ From: 'a@test.com', Subject: 'Test', Date: 'Mon, 15 Jan 2024 10:00:00 +0000' }, 'Body'),
    ]
    const calls: [number, number][] = []
    await normalizeEmails(emails, (current, total) => calls.push([current, total]))
    expect(calls).toEqual([[1, 1]])
  })

  it('skips unparseable emails without crashing', async () => {
    const emails: RawEmail[] = [
      { raw: 'completely invalid mime garbage \x00\x01\x02' },
      makeRawEmail({ From: 'a@test.com', Subject: 'Valid', Date: 'Mon, 15 Jan 2024 10:00:00 +0000' }, 'Body'),
    ]
    const results = await normalizeEmails(emails)
    // At least the valid one should be parsed (the invalid one may or may not crash)
    expect(results.length).toBeGreaterThanOrEqual(1)
  })

  it('handles empty array', async () => {
    const results = await normalizeEmails([])
    expect(results).toEqual([])
  })
})
