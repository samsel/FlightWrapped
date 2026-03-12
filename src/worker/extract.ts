import type { Flight, NormalizedEmail } from '@/lib/types'
import { isAirlineDomain } from '@/lib/domains'
import { extractFromLlm } from './extractors/llm'
import type { EmailProfiler } from '@/lib/profiler'

/**
 * Extraction orchestrator: filters by domain, then runs every matching
 * email through the local LLM for flight data extraction.
 *
 * All processing happens on-device. Nothing leaves the browser.
 */
export async function extractFlightsFromEmail(
  email: NormalizedEmail,
  profiler?: EmailProfiler,
): Promise<Flight[]> {
  // Pre-filter: only process emails from airline/booking domains
  profiler?.startSegment('domain-filter')
  const isAirline = isAirlineDomain(email.senderDomain)
  profiler?.endSegment('domain-filter')

  if (!isAirline) {
    profiler?.markFiltered()
    return []
  }

  profiler?.startSegment('llm-extract')
  const flights = await extractFromLlm(email)
  profiler?.endSegment('llm-extract')

  profiler?.markFlights(flights.length)
  return flights
}
