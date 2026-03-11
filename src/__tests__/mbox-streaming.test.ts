// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { parseMboxStream } from '@/lib/mbox-parser'

/** Create a ReadableStream from a string, optionally with small chunk sizes */
function stringToStream(str: string, chunkSize = 1024): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(str)
  let offset = 0
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close()
        return
      }
      controller.enqueue(bytes.slice(offset, offset + chunkSize))
      offset += chunkSize
    },
  })
}

/** Decode ArrayBuffer to string */
function decode(buf: ArrayBuffer): string {
  return new TextDecoder().decode(buf)
}

const MBOX_TWO_EMAILS = [
  'From sender@example.com Thu Jan  1 00:00:00 2000',
  'Subject: First email',
  '',
  'Body of first email.',
  '',
  'From other@example.com Fri Jan  2 00:00:00 2000',
  'Subject: Second email',
  '',
  'Body of second email.',
].join('\n')

const MBOX_SINGLE = [
  'From sender@example.com Thu Jan  1 00:00:00 2000',
  'Subject: Only email',
  '',
  'Hello world.',
].join('\n')

const MBOX_ESCAPED = [
  'From sender@example.com Thu Jan  1 00:00:00 2000',
  'Subject: Escaped test',
  '',
  'Line before.',
  '>From someone in the body',
  'Line after.',
].join('\n')

describe('parseMboxStream', () => {
  it('parses two emails from a stream', async () => {
    const emails: string[] = []
    const count = await parseMboxStream(
      stringToStream(MBOX_TWO_EMAILS),
      async (buf) => { emails.push(decode(buf)) },
    )

    expect(count).toBe(2)
    expect(emails[0]).toContain('Subject: First email')
    expect(emails[0]).toContain('Body of first email.')
    expect(emails[1]).toContain('Subject: Second email')
    expect(emails[1]).toContain('Body of second email.')
  })

  it('parses a single email', async () => {
    const emails: string[] = []
    const count = await parseMboxStream(
      stringToStream(MBOX_SINGLE),
      async (buf) => { emails.push(decode(buf)) },
    )

    expect(count).toBe(1)
    expect(emails[0]).toContain('Hello world.')
  })

  it('handles empty stream', async () => {
    const emails: string[] = []
    const count = await parseMboxStream(
      stringToStream(''),
      async (buf) => { emails.push(decode(buf)) },
    )

    expect(count).toBe(0)
    expect(emails).toHaveLength(0)
  })

  it('un-escapes >From in email bodies', async () => {
    const emails: string[] = []
    await parseMboxStream(
      stringToStream(MBOX_ESCAPED),
      async (buf) => { emails.push(decode(buf)) },
    )

    expect(emails).toHaveLength(1)
    expect(emails[0]).toContain('From someone in the body')
    expect(emails[0]).not.toContain('>From someone')
  })

  it('works with very small chunk sizes (boundary split across chunks)', async () => {
    const emails: string[] = []
    // Use 10-byte chunks to ensure "From " boundaries are split across chunks
    const count = await parseMboxStream(
      stringToStream(MBOX_TWO_EMAILS, 10),
      async (buf) => { emails.push(decode(buf)) },
    )

    expect(count).toBe(2)
    expect(emails[0]).toContain('First email')
    expect(emails[1]).toContain('Second email')
  })

  it('does not include envelope From line in email content', async () => {
    const emails: string[] = []
    await parseMboxStream(
      stringToStream(MBOX_SINGLE),
      async (buf) => { emails.push(decode(buf)) },
    )

    expect(emails[0]).not.toContain('From sender@example.com')
  })

  it('awaits onEmail callback (backpressure)', async () => {
    const order: string[] = []
    await parseMboxStream(
      stringToStream(MBOX_TWO_EMAILS),
      async () => {
        order.push('start')
        await new Promise((r) => setTimeout(r, 10))
        order.push('end')
      },
    )

    // Each callback should complete before the next starts
    expect(order).toEqual(['start', 'end', 'start', 'end'])
  })

  it('handles mbox with trailing newlines', async () => {
    const mbox = MBOX_SINGLE + '\n\n\n'
    const emails: string[] = []
    const count = await parseMboxStream(
      stringToStream(mbox),
      async (buf) => { emails.push(decode(buf)) },
    )

    expect(count).toBe(1)
  })

  it('handles many emails', async () => {
    const lines: string[] = []
    for (let i = 0; i < 100; i++) {
      lines.push(`From user${i}@example.com Thu Jan  1 00:00:00 2000`)
      lines.push(`Subject: Email ${i}`)
      lines.push('')
      lines.push(`Body ${i}.`)
      lines.push('')
    }
    const emails: string[] = []
    const count = await parseMboxStream(
      stringToStream(lines.join('\n'), 64),
      async (buf) => { emails.push(decode(buf)) },
    )

    expect(count).toBe(100)
    expect(emails[0]).toContain('Body 0.')
    expect(emails[99]).toContain('Body 99.')
  })
})
