export interface Airport {
  iata: string
  name: string
  city: string
  country: string
  lat: number
  lng: number
  timezone: string
}

export interface Flight {
  origin: string
  destination: string
  date: string // ISO date string YYYY-MM-DD
  airline: string
  flightNumber: string
  extractionTier: ExtractionTier
  confidence: number
}

export type ExtractionTier = 'jsonld' | 'regex' | 'llm'

export interface FlightStats {
  totalFlights: number
  totalMiles: number
  uniqueAirports: number
  uniqueCities: number
  uniqueCountries: number
  uniqueAirlines: number
  airlineBreakdown: Record<string, number>
  mostFlownRoute: { origin: string; destination: string; count: number } | null
  mostVisitedAirport: { iata: string; count: number } | null
  busiestMonth: { month: string; count: number } | null
  firstFlight: Flight | null
  lastFlight: Flight | null
  longestRoute: { origin: string; destination: string; miles: number } | null
  shortestRoute: { origin: string; destination: string; miles: number } | null
  domesticRatio: number
  flightsByYear: Record<string, number>
  estimatedHours: number
  co2Tons: number
}

export interface ParseProgress {
  phase: 'scanning' | 'extracting' | 'deduplicating' | 'done' | 'error'
  current: number
  total: number
  flightsFound: number
  message?: string
}

export type WorkerInMessage =
  | { type: 'parse-emails'; data: NormalizedEmail[] }
  | { type: 'ping' }

export type WorkerOutMessage =
  | { type: 'progress'; data: ParseProgress }
  | { type: 'result'; data: Flight[] }
  | { type: 'error'; data: { message: string } }
  | { type: 'pong' }

export interface NormalizedEmail {
  senderAddress: string
  senderDomain: string
  subject: string
  date: string
  htmlBody: string
  textBody: string
}

export interface RawEmail {
  raw: string // raw MIME content
}
