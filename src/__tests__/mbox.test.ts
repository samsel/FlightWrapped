import { describe, it, expect } from 'vitest'
import { streamMbox, parseEmlFile, getFileType } from '@/lib/mbox'

function createFile(content: string, name: string): File {
  return new File([content], name, { type: 'text/plain' })
}

describe('mbox parser', () => {
  it('parses an mbox file with multiple emails', async () => {
    const mbox = `From sender@example.com Mon Jan 1 00:00:00 2024
From: sender@example.com
To: user@example.com
Subject: First email

Body of first email

From sender2@example.com Tue Jan 2 00:00:00 2024
From: sender2@example.com
To: user@example.com
Subject: Second email

Body of second email
`
    const file = createFile(mbox, 'test.mbox')
    const emails = []
    for await (const email of streamMbox(file)) {
      emails.push(email)
    }

    expect(emails).toHaveLength(2)
    expect(emails[0].raw).toContain('Subject: First email')
    expect(emails[1].raw).toContain('Subject: Second email')
  })

  it('handles single email mbox', async () => {
    const mbox = `From sender@example.com Mon Jan 1 00:00:00 2024
From: sender@example.com
Subject: Only email

Body content
`
    const file = createFile(mbox, 'test.mbox')
    const emails = []
    for await (const email of streamMbox(file)) {
      emails.push(email)
    }

    expect(emails).toHaveLength(1)
    expect(emails[0].raw).toContain('Subject: Only email')
  })

  it('handles empty mbox', async () => {
    const file = createFile('', 'test.mbox')
    const emails = []
    for await (const email of streamMbox(file)) {
      emails.push(email)
    }

    expect(emails).toHaveLength(0)
  })
})

describe('eml parser', () => {
  it('reads a single eml file', async () => {
    const eml = `From: sender@airline.com
Subject: Your Flight Confirmation
Date: Mon, 1 Jan 2024 00:00:00 +0000

Your flight is confirmed.`

    const file = createFile(eml, 'confirmation.eml')
    const result = await parseEmlFile(file)

    expect(result.raw).toContain('Subject: Your Flight Confirmation')
    expect(result.raw).toContain('Your flight is confirmed.')
  })
})

describe('getFileType', () => {
  it('detects .mbox files', () => {
    expect(getFileType(createFile('', 'inbox.mbox'))).toBe('mbox')
  })

  it('detects .eml files', () => {
    expect(getFileType(createFile('', 'email.eml'))).toBe('eml')
  })

  it('returns unknown for other extensions', () => {
    expect(getFileType(createFile('', 'data.txt'))).toBe('unknown')
    expect(getFileType(createFile('', 'file.csv'))).toBe('unknown')
  })

  it('is case-insensitive', () => {
    expect(getFileType(createFile('', 'inbox.MBOX'))).toBe('mbox')
    expect(getFileType(createFile('', 'email.EML'))).toBe('eml')
  })
})
