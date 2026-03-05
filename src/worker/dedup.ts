import type { Flight } from '@/lib/types'

/**
 * Deduplicate flights extracted from multiple emails.
 *
 * The same flight appears in confirmation, itinerary update, check-in
 * reminder, boarding pass, etc. We merge duplicates and keep the
 * highest-confidence extraction.
 *
 * Strategy:
 * - Primary key: flightNumber + date
 * - Fallback key: origin + destination + date (when flight number is missing)
 * - Merge: keep highest confidence, prefer more complete data
 */
export function deduplicateFlights(flights: Flight[]): Flight[] {
  const byFlightNumber = new Map<string, Flight>()
  const byRoute = new Map<string, Flight>()

  for (const flight of flights) {
    const hasFlightNumber = flight.flightNumber.trim().length > 0

    if (hasFlightNumber) {
      const key = normalizeFlightKey(flight.flightNumber, flight.date)
      const existing = byFlightNumber.get(key)
      byFlightNumber.set(key, mergeFlight(existing, flight))
    } else {
      const key = `${flight.origin}-${flight.destination}-${flight.date}`
      const existing = byRoute.get(key)
      byRoute.set(key, mergeFlight(existing, flight))
    }
  }

  // Check if any route-only entries match a flight-number entry
  const result = [...byFlightNumber.values()]

  for (const [, routeFlight] of byRoute) {
    const isDuplicate = result.some(
      (f) =>
        f.origin === routeFlight.origin &&
        f.destination === routeFlight.destination &&
        f.date === routeFlight.date,
    )

    if (!isDuplicate) {
      result.push(routeFlight)
    }
  }

  // Sort by date
  result.sort((a, b) => a.date.localeCompare(b.date))

  return result
}

/**
 * Normalize a flight number for dedup key generation.
 * "UA 1234", "UA1234", "ua 1234" all become "UA1234"
 */
function normalizeFlightKey(flightNumber: string, date: string): string {
  const normalized = flightNumber.replace(/\s+/g, '').toUpperCase()
  return `${normalized}-${date}`
}

/**
 * Merge two flight records, preferring the higher-confidence one
 * but filling in missing fields from the lower-confidence one.
 */
function mergeFlight(existing: Flight | undefined, incoming: Flight): Flight {
  if (!existing) return incoming

  const base = incoming.confidence >= existing.confidence ? incoming : existing
  const other = incoming.confidence >= existing.confidence ? existing : incoming

  return {
    ...base,
    airline: base.airline || other.airline,
    flightNumber: base.flightNumber || other.flightNumber,
  }
}
