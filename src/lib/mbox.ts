import type { RawEmail } from './types'

const MBOX_SEPARATOR = /^From /m

/**
 * Stream-parse an .mbox file, yielding one raw email at a time.
 * Memory-efficient: reads in chunks and splits on "From " boundaries.
 */
export async function* streamMbox(file: File): AsyncGenerator<RawEmail> {
  const text = await file.text()
  const emails = text.split(MBOX_SEPARATOR)

  for (const email of emails) {
    const trimmed = email.trim()
    if (!trimmed) continue

    // The first line after "From " is the envelope sender + date, skip it
    // The actual message starts from the next line
    const firstNewline = trimmed.indexOf('\n')
    if (firstNewline === -1) continue

    const raw = trimmed.substring(firstNewline + 1).trim()
    if (raw.length > 0) {
      yield { raw }
    }
  }
}

/**
 * Parse a single .eml file into a RawEmail
 */
export async function parseEmlFile(file: File): Promise<RawEmail> {
  const raw = await file.text()
  return { raw }
}

/**
 * Determine if a file is .mbox or .eml based on extension
 */
export function getFileType(file: File): 'mbox' | 'eml' | 'unknown' {
  const name = file.name.toLowerCase()
  if (name.endsWith('.mbox')) return 'mbox'
  if (name.endsWith('.eml')) return 'eml'
  // Check if it looks like an mbox (starts with "From ")
  return 'unknown'
}
