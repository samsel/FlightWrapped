import type { Flight, NormalizedEmail } from '@/lib/types'
import { isValidIATA } from '@/lib/airports'

/**
 * Local LLM flight extraction. The sole extraction method.
 * Runs Qwen3-4B (4-bit quantized) entirely in the browser via WebGPU/WASM.
 * No data leaves the device. Model is cached in IndexedDB after first download.
 */

let enginePromise: Promise<LlmEngine> | null = null

interface LlmEngine {
  chat: {
    completions: {
      create: (params: {
        messages: { role: string; content: string }[]
        temperature: number
        max_tokens: number
      }) => Promise<{ choices: { message: { content: string } }[] }>
    }
  }
}

const MODEL_ID = 'Qwen3-4B-q4f16_1-MLC'

export async function initLlm(
  onProgress?: (progress: { text: string; progress: number }) => void,
): Promise<void> {
  if (enginePromise) {
    await enginePromise
    return
  }

  enginePromise = (async () => {
    try {
      // Check available storage before attempting ~2GB model download
      if (navigator.storage?.estimate) {
        try {
          const { quota = 0, usage = 0 } = await navigator.storage.estimate()
          const availableGB = (quota - usage) / (1024 * 1024 * 1024)
          if (availableGB < 3) {
            const availableMB = Math.round(availableGB * 1024)
            const warningMsg = `Low storage: ~${availableMB}MB available. The AI model needs ~2GB. Download may fail.`
            console.warn(warningMsg)
            onProgress?.({ text: warningMsg, progress: 0 })
          }
        } catch {
          // storage.estimate() can fail in some contexts; proceed anyway
        }
      }
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm')
      const engine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report: { text: string; progress: number }) => {
          onProgress?.({ text: report.text, progress: report.progress })
        },
      })
      return engine as unknown as LlmEngine
    } catch (err) {
      enginePromise = null // allow retry on failure
      throw err
    }
  })()

  await enginePromise
}

export function isLlmReady(): boolean {
  return enginePromise !== null
}

export async function extractFromLlm(email: NormalizedEmail): Promise<Flight[]> {
  if (!enginePromise) {
    throw new Error('LLM not initialized. Call initLlm() first')
  }

  const engine = await enginePromise
  const text = stripToPlainText(email)

  if (!text || text.length < 20) return []

  // Truncate to save tokens; flight info is usually near the top
  const truncated = text.slice(0, 2000)

  const prompt = `Extract confirmed flight bookings from this email. Return ONLY valid JSON, no other text.

Format:
{"flights":[{"origin":"<IATA>","destination":"<IATA>","date":"<YYYY-MM-DD>","airline":"<full airline name>","flightNumber":"<code number>"}]}

Rules:
- Only extract flights from booking confirmations or itinerary receipts
- Do NOT extract flights from cancellation notices, delay notifications, baggage claims, promotional deals, loyalty account summaries, credit card statements, or other non-booking emails
- origin is the departure airport, destination is the arrival airport (3-letter IATA codes)
- date must be YYYY-MM-DD only, no time (e.g. "March 15, 2024" becomes "2024-03-15", "15/06/2024" becomes "2024-06-15", "20MAR2024" becomes "2024-03-20")
- airline must be the full name (e.g. "American Airlines" not "AA")
- flightNumber must include airline code prefix (e.g. "UA 1234" not just "1234")
- Put ALL flights in ONE "flights" array — do not repeat the "flights" key
- Only include flights explicitly stated with a specific route and date — do not infer or fabricate flights
- If no confirmed flight bookings found, return: {"flights":[]}

Email:
${truncated} /no_think`

  try {
    const response = await engine.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
    })

    const content = response.choices[0]?.message?.content ?? ''
    return parseLlmResponse(content, email.date)
  } catch {
    return []
  }
}

export function validateFlightItems(items: unknown[], emailDate: string): Flight[] {
  const flights: Flight[] = []

  for (const item of items) {
    if (!item || typeof item !== 'object') continue

    const r = item as Record<string, unknown>
    const origin = String(r.origin ?? r.from ?? '').toUpperCase().trim()
    const destination = String(r.destination ?? r.to ?? '').toUpperCase().trim()

    if (!origin || !destination) continue
    if (!isValidIATA(origin) || !isValidIATA(destination)) continue
    if (origin === destination) continue

    const date = parseFlightDate(String(r.date ?? r.departure_date ?? ''), emailDate)
    if (!date) continue

    flights.push({
      origin,
      destination,
      date,
      airline: String(r.airline ?? r.carrier ?? '').trim(),
      flightNumber: String(r.flightNumber ?? r.flight_number ?? r.flight ?? '').trim(),
      confidence: 0.85,
    })
  }

  return flights
}

export function parseLlmResponse(content: string, emailDate: string): Flight[] {
  // Strip Qwen3 thinking tags if present (should be suppressed by /no_think)
  content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  const openIdx = content.indexOf('{')
  if (openIdx === -1) return []

  let parsed: { flights?: unknown; flight?: unknown } | null = null
  for (let i = content.lastIndexOf('}'); i > openIdx; i = content.lastIndexOf('}', i - 1)) {
    try {
      parsed = JSON.parse(content.slice(openIdx, i + 1))
      break
    } catch {
      // try a shorter slice
    }
  }
  if (!parsed) return []

  try {
    const rawFlights = parsed.flights ?? parsed.flight ?? []
    const items = Array.isArray(rawFlights) ? rawFlights : [rawFlights]
    return validateFlightItems(items, emailDate)
  } catch {
    return []
  }
}

function parseDateToIso(str: string): string | null {
  // Try direct YYYY-MM-DD match first to avoid timezone issues with new Date()
  const isoMatch = str.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    const y = parseInt(year, 10)
    if (y >= 1990 && y <= 2100) return `${year}-${month}-${day}`
  }

  // Fallback: use Date with UTC methods to avoid local timezone shift
  try {
    const d = new Date(str)
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear()
      if (year >= 1990 && year <= 2100) {
        return `${year}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      }
    }
  } catch {
    // fall through
  }

  return null
}

function parseFlightDate(dateStr: string, fallbackDate: string): string | null {
  if (dateStr) {
    const result = parseDateToIso(dateStr)
    if (result) return result
  }

  if (fallbackDate) {
    const result = parseDateToIso(fallbackDate)
    if (result) return result
  }

  return null
}

export function stripToPlainText(email: NormalizedEmail): string {
  if (email.textBody) return email.textBody
  if (!email.htmlBody) return ''

  return email.htmlBody
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Batch extraction ───

export const EXTRACT_BATCH_SIZE = 3

export async function extractFromLlmBatch(emails: NormalizedEmail[]): Promise<Flight[][]> {
  if (!enginePromise) throw new Error('LLM not initialized. Call initLlm() first')
  if (emails.length === 0) return []
  if (emails.length === 1) return [await extractFromLlm(emails[0])]

  const engine = await enginePromise
  const results: Flight[][] = new Array(emails.length).fill(null).map(() => [])

  const emailTexts = emails.map(email => {
    const text = stripToPlainText(email)
    return text && text.length >= 20 ? text.slice(0, 2000) : ''
  })

  if (emailTexts.every(t => !t)) return results

  const emailBlocks = emailTexts.map((text, i) =>
    `=== EMAIL ${i + 1} ===\n${text || '(no content)'}`
  ).join('\n\n')

  const formatEntries = emails.map((_, i) =>
    `"email_${i + 1}":{"flights":[]}`
  ).join(',')

  const prompt = `Extract flight information from each email below. Return ONLY valid JSON, no other text.

Format: {${formatEntries}}

For each email, list flights with: origin (3-letter IATA), destination (3-letter IATA), date (YYYY-MM-DD), airline, flightNumber (with airline prefix).
If no flights found for an email, return empty flights array.
Include ALL flights mentioned (outbound + return).

${emailBlocks} /no_think`

  try {
    const response = await engine.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500 * emails.length,
    })
    const content = response.choices[0]?.message?.content ?? ''
    return parseBatchLlmResponse(content, emails)
  } catch {
    // Fallback: extract each email individually
    const fallback: Flight[][] = []
    for (const email of emails) {
      try { fallback.push(await extractFromLlm(email)) } catch { fallback.push([]) }
    }
    return fallback
  }
}

export function parseBatchLlmResponse(content: string, emails: NormalizedEmail[]): Flight[][] {
  const results: Flight[][] = new Array(emails.length).fill(null).map(() => [])

  // Strip Qwen3 thinking tags if present (should be suppressed by /no_think)
  content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  const openIdx = content.indexOf('{')
  if (openIdx === -1) return results

  let parsed: Record<string, unknown> | null = null
  for (let i = content.lastIndexOf('}'); i > openIdx; i = content.lastIndexOf('}', i - 1)) {
    try {
      parsed = JSON.parse(content.slice(openIdx, i + 1))
      break
    } catch {
      // try shorter
    }
  }
  if (!parsed) return results

  for (let idx = 0; idx < emails.length; idx++) {
    const key = `email_${idx + 1}`
    const emailData = parsed[key] ?? parsed[`Email ${idx + 1}`] ?? parsed[`Email_${idx + 1}`]
    if (!emailData || typeof emailData !== 'object') continue

    const record = emailData as Record<string, unknown>
    const rawFlights = record.flights ?? record.flight ?? []
    const items = Array.isArray(rawFlights) ? rawFlights : [rawFlights]
    results[idx] = validateFlightItems(items, emails[idx].date)
  }

  // Fallback: if no per-email keys found but there's a top-level flights array,
  // treat as results for the first email (LLM ignored batch format)
  if (results.every(r => r.length === 0) && (parsed.flights || parsed.flight)) {
    const rawFlights = (parsed.flights ?? parsed.flight) as unknown
    const items = Array.isArray(rawFlights) ? rawFlights : [rawFlights]
    results[0] = validateFlightItems(items, emails[0].date)
  }

  return results
}
