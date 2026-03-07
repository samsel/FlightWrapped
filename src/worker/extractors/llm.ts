import type { Flight, NormalizedEmail } from '@/lib/types'
import { isValidIATA } from '@/lib/airports'

/**
 * Local LLM flight extraction — the sole extraction method.
 * Runs a small model (Phi-3.5-mini) entirely in the browser via WebGPU/WASM.
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

const MODEL_ID = 'Phi-3.5-mini-instruct-q4f16_1-MLC'

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
        const { quota = 0, usage = 0 } = await navigator.storage.estimate()
        const availableMB = Math.round((quota - usage) / 1024 / 1024)
        if (availableMB < 2048) {
          console.warn(`Low storage: ~${availableMB}MB available, model needs ~2GB`)
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
    throw new Error('LLM not initialized — call initLlm() first')
  }

  const engine = await enginePromise
  const text = stripToPlainText(email)

  if (!text || text.length < 20) return []

  // Truncate to save tokens — flight info is usually near the top
  const truncated = text.slice(0, 2000)

  const prompt = `Extract all flight information from this email. Return ONLY valid JSON, no other text.

Format:
{"flights":[{"origin":"JFK","destination":"LAX","date":"2024-01-15","airline":"United Airlines","flightNumber":"UA 1234"}]}

Rules:
- origin and destination must be 3-letter IATA airport codes
- date must be YYYY-MM-DD format
- flightNumber should include airline code prefix (e.g. "UA 1234" not just "1234")
- If no flights found, return: {"flights":[]}
- Include ALL flights mentioned (outbound + return)

Email:
${truncated}`

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

export function parseLlmResponse(content: string, emailDate: string): Flight[] {
  // Try progressively larger matches to find valid JSON
  const openIdx = content.indexOf('{')
  if (openIdx === -1) return []

  let parsed: { flights?: unknown; flight?: unknown } | null = null
  // Find the matching closing brace by trying JSON.parse at each `}` from the end
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

    const flights: Flight[] = []

    for (const item of items) {
      const origin = (item.origin ?? item.from ?? '').toUpperCase().trim()
      const destination = (item.destination ?? item.to ?? '').toUpperCase().trim()

      if (!origin || !destination) continue
      if (!isValidIATA(origin) || !isValidIATA(destination)) continue
      if (origin === destination) continue

      const date = parseFlightDate(item.date ?? item.departure_date ?? '', emailDate)
      if (!date) continue

      flights.push({
        origin,
        destination,
        date,
        airline: (item.airline ?? item.carrier ?? '').trim(),
        flightNumber: (item.flightNumber ?? item.flight_number ?? item.flight ?? '').trim(),
        confidence: 0.85,
      })
    }

    return flights
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
