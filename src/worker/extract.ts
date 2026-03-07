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