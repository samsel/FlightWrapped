import PostalMime from 'postal-mime'
import type { NormalizedEmail, RawEmail } from './types'

/**
 * Cheaply extract the sender domain from raw email bytes by scanning for the
 * "From:" header line. This avoids a full MIME parse (postal-mime) and is
 * ~100x faster, making it suitable for pre-filtering large mbox files where
 * 99%+ of emails can be skipped.
 *
 * Returns the lowercase domain, or '' if not found.
 */
export function extractSenderDomainFast(raw: ArrayBuffer | string): string {
  // Decode only the first 16KB — the From header is always near the top.
  // This avoids decoding multi-MB emails with large attachments.
  const text =
    typeof raw === 'string'
      ? raw.slice(0, 16384)
      : new TextDecoder().decode(
          raw instanceof ArrayBuffer
            ? new Uint8Array(raw, 0, Math.min(raw.byteLength, 16384))
            : raw,
        )

  // Match "From:" header (case-insensitive), which may span continuation lines.
  // We look for an email address pattern: something@domain
  const fromMatch = text.match(/^From:\s*(.+)/im)
  if (!fromMatch) return ''

  // The header value may contain "Display Name <addr@domain>" or just "addr@domain"
  const headerValue = fromMatch[1]

  // Extract email address — prefer angle-bracket form, then bare address
  const angleMatch = headerValue.match(/<([^>]+)>/)
  const addrStr = angleMatch ? angleMatch[1] : headerValue.trim()

  const atIdx = addrStr.lastIndexOf('@')
  if (atIdx < 0) return ''

  // Extract domain, stripping any trailing ">" or whitespace
  const domain = addrStr
    .slice(atIdx + 1)
    .replace(/[>\s].*/g, '')
    .toLowerCase()
    .trim()

  return domain
}

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
