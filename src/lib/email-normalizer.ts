import PostalMime from 'postal-mime'
import type { NormalizedEmail, RawEmail } from './types'

/**
 * Normalize a raw email (from .mbox file) into a
 * structured format suitable for the extraction pipeline.
 */
export async function normalizeEmail(raw: RawEmail): Promise<NormalizedEmail> {
  const parser = new PostalMime()
  const parsed = await parser.parse(raw.raw)

  const fromAddress = parsed.from?.address ?? ''
  // Extract domain from the last '@' to handle malformed addresses like "user@sub@domain.com"
  const atIdx = fromAddress.lastIndexOf('@')
  const domain = atIdx >= 0 ? fromAddress.slice(atIdx + 1).toLowerCase().trim() : ''

  return {
    senderAddress: fromAddress,
    senderDomain: domain,
    subject: parsed.subject ?? '',
    date: parsed.date ?? '',
    htmlBody: parsed.html ?? '',
    textBody: parsed.text ?? '',
  }
}

/**
 * Normalize a batch of raw emails, reporting progress.
 */
export async function normalizeEmails(
  rawEmails: RawEmail[],
  onProgress?: (current: number, total: number) => void,
): Promise<NormalizedEmail[]> {
  const results: NormalizedEmail[] = []

  for (let i = 0; i < rawEmails.length; i++) {
    try {
      const normalized = await normalizeEmail(rawEmails[i])
      results.push(normalized)
    } catch {
      // Skip emails that can't be parsed
    }
    onProgress?.(i + 1, rawEmails.length)
  }

  return results
}
