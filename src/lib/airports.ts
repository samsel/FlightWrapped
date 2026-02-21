import airportData from '@/data/airports.json'
import type { Airport } from './types'

const airportMap = new Map<string, Airport>()

for (const a of airportData as Airport[]) {
  airportMap.set(a.iata, a)
}

export function lookupAirport(iata: string): Airport | null {
  return airportMap.get(iata.toUpperCase()) ?? null
}

export function isValidIATA(code: string): boolean {
  return airportMap.has(code.toUpperCase())
}

const EARTH_RADIUS_MILES = 3958.8

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Haversine distance between two airports in miles */
export function calculateDistance(origin: string, dest: string): number {
  const a = lookupAirport(origin)
  const b = lookupAirport(dest)
  if (!a || !b) return 0

  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)

  const h =
    sinLat * sinLat +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinLng * sinLng

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h))
}

export function getAllAirports(): Airport[] {
  return [...airportMap.values()]
}

export function getAirportCount(): number {
  return airportMap.size
}
