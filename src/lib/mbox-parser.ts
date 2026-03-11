/**
 * Parse an .mbox file into individual raw email buffers.
 *
 * The mbox format separates emails with a line starting with "From "
 * (the "mboxrd" envelope sender line). Within email bodies, lines
 * starting with "From " are escaped as ">From ".
 */
export function parseMbox(buffer: ArrayBuffer): ArrayBuffer[] {
  const text = new TextDecoder().decode(buffer)
  const encoder = new TextEncoder()
  const emails: ArrayBuffer[] = []

  // Split on mbox separator: "From " at start of line
  // The first entry may be empty if the file starts with "From "
  const parts = text.split(/^From /m)

  for (const part of parts) {
    if (!part.trim()) continue

    // The first line is the envelope sender (e.g., "user@example.com Thu Jan 1 00:00:00 2000")
    // The actual email content starts after the first newline
    const firstNewline = part.indexOf('\n')
    if (firstNewline === -1) continue

    const emailContent = part.substring(firstNewline + 1)
    if (!emailContent.trim()) continue

    // Un-escape ">From " back to "From " in the body (mboxrd format)
    const unescaped = emailContent.replace(/^>From /gm, 'From ')

    emails.push(encoder.encode(unescaped).buffer)
  }

  return emails
}

/**
 * Extract the email body from a raw mbox segment string.
 * Strips the envelope "From " header line and un-escapes ">From ".
 */
function extractEmailFromSegment(segment: string): ArrayBuffer | null {
  const firstNewline = segment.indexOf('\n')
  if (firstNewline === -1) return null

  const content = segment.substring(firstNewline + 1)
  if (!content.trim()) return null

  const unescaped = content.replace(/^>From /gm, 'From ')
  return new TextEncoder().encode(unescaped).buffer
}

/**
 * Stream-parse an .mbox file, calling onEmail for each email found.
 * Uses constant memory regardless of file size -- only one email's
 * worth of data is held in memory at a time.
 *
 * Algorithm: read chunks, accumulate text line-by-line, detect "From "
 * at the start of a line as an email boundary. When a boundary is found,
 * emit the accumulated segment as an email and start a new one.
 *
 * @param stream - ReadableStream from File.stream()
 * @param onEmail - async callback invoked for each email's raw ArrayBuffer
 * @returns total number of emails found
 */
export async function parseMboxStream(
  stream: ReadableStream<Uint8Array>,
  onEmail: (raw: ArrayBuffer) => Promise<void>,
): Promise<number> {
  const reader = stream.getReader()
  const decoder = new TextDecoder('utf-8')
  let emailCount = 0

  // Accumulates the current mbox segment (one "From ..." block)
  let currentSegment = ''
  // Leftover text that doesn't end with a newline
  let leftover = ''

  async function emitSegment(): Promise<void> {
    if (!currentSegment) return
    const buf = extractEmailFromSegment(currentSegment)
    if (buf) {
      await onEmail(buf)
      emailCount++
    }
    currentSegment = ''
  }

  while (true) {
    const { done, value } = await reader.read()
    const text = done ? decoder.decode() : decoder.decode(value, { stream: true })

    if (text.length === 0 && done) break

    // Combine leftover from previous chunk with new text
    const combined = leftover + text
    // Split into lines, keeping the delimiter
    const lines = combined.split('\n')

    // The last element might be incomplete (no trailing \n)
    // Keep it as leftover for the next chunk
    leftover = done ? '' : (lines.pop() ?? '')

    for (const line of lines) {
      const fullLine = line + '\n'

      // Check if this line starts a new mbox message.
      // Since we split on '\n', each line is naturally at a line boundary.
      // In mbox format, "From " in email bodies is escaped as ">From ",
      // so unescaped "From " always means a new message.
      if (fullLine.startsWith('From ')) {
        // Emit the previous segment before starting a new one
        await emitSegment()
        currentSegment = fullLine
      } else {
        currentSegment += fullLine
      }
    }

    if (done) break
  }

  // Handle any leftover that didn't end with newline
  if (leftover) {
    currentSegment += leftover
    leftover = ''
  }

  // Emit the final segment
  await emitSegment()

  return emailCount
}
