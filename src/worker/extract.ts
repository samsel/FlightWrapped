import type { Flight, NormalizedEmail } from '@/lib/types'
import { isAirlineDomain } from '@/lib/domains'
import { extractFromLlm } from './extractors/llm'

/**
 * Extraction orchestrator: filters by domain, then runs every matching
 * email through the local LLM for flight data extraction.
 *
 * All processing happens on-device — nothing leaves the browser.
 */
export async function extractFlightsFromEmail(email: NormalizedEmail): Promise<Flight[]> {
  // Pre-filter: only process emails from airline/booking domains
  if (!isAirlineDomain(email.senderDomain)) {
    return []
  }

  return extractFromLlm(email)
}

/**
 * Process a batch of emails through the extraction pipeline.
 */
export async function extractFlightsFromEmails(
  emails: NormalizedEmail[],
  onProgress?: (current: number, total: number, flightsFound: number) => void,
): Promise<Flight[]> {
  const allFlights: Flight[] = []

  for (let i = 0; i < emails.length; i++) {
    const flights = await extractFlightsFromEmail(emails[i])
    allFlights.push(...flights)
    onProgress?.(i + 1, emails.length, allFlights.length)
  }

  return allFlights
}
