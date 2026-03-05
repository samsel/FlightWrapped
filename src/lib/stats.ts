import type { Flight, FlightStats } from './types'
import { calculateDistance, lookupAirport } from './airports'

function routeKey(origin: string, dest: string): string {
  return [origin, dest].sort().join('-')
}

export function calculateStats(flights: Flight[]): FlightStats {
  if (flights.length === 0) {
    return {
      totalFlights: 0,
      totalMiles: 0,
      uniqueAirports: 0,
      uniqueCities: 0,
      uniqueCountries: 0,
      uniqueAirlines: 0,
      airlineBreakdown: {},
      mostFlownRoute: null,
      mostVisitedAirport: null,
      busiestMonth: null,
      firstFlight: null,
      lastFlight: null,
      longestRoute: null,
      shortestRoute: null,
      domesticRatio: 0,
      flightsByYear: {},
      estimatedHours: 0,
      co2Tons: 0,
      flightsByMonth: {},
    }
  }

  const airports = new Set<string>()
  const cities = new Set<string>()
  const countries = new Set<string>()
  const airlineCounts: Record<string, number> = {}
  const routeCounts: Record<string, { origin: string; destination: string; count: number }> = {}
  const airportCounts: Record<string, number> = {}
  const monthCounts: Record<string, number> = {}
  const yearCounts: Record<string, number> = {}

  let totalMiles = 0
  let domesticCount = 0
  let longestRoute: { origin: string; destination: string; miles: number } | null = null
  let shortestRoute: { origin: string; destination: string; miles: number } | null = null
  let firstFlight: Flight = flights[0]
  let lastFlight: Flight = flights[0]

  for (const flight of flights) {
    const { origin, destination, date, airline } = flight

    // Distance
    const miles = calculateDistance(origin, destination)
    totalMiles += miles

    // Airports, cities, countries
    for (const code of [origin, destination]) {
      airports.add(code)
      const ap = lookupAirport(code)
      if (ap) {
        cities.add(ap.city)
        countries.add(ap.country)
      }
    }

    // Airport visit counts
    airportCounts[origin] = (airportCounts[origin] ?? 0) + 1
    airportCounts[destination] = (airportCounts[destination] ?? 0) + 1

    // Airline breakdown
    if (airline) {
      airlineCounts[airline] = (airlineCounts[airline] ?? 0) + 1
    }

    // Route counts (undirected)
    const rk = routeKey(origin, destination)
    if (!routeCounts[rk]) {
      routeCounts[rk] = { origin, destination, count: 0 }
    }
    routeCounts[rk].count++

    // Longest/shortest route (per unique route)
    if (miles > 0) {
      if (!longestRoute || miles > longestRoute.miles) {
        longestRoute = { origin, destination, miles }
      }
      if (!shortestRoute || miles < shortestRoute.miles) {
        shortestRoute = { origin, destination, miles }
      }
    }

    // Domestic ratio
    const originAirport = lookupAirport(origin)
    const destAirport = lookupAirport(destination)
    if (originAirport && destAirport && originAirport.country === destAirport.country) {
      domesticCount++
    }

    // Month and year counts
    if (date) {
      const month = date.slice(0, 7) // YYYY-MM
      monthCounts[month] = (monthCounts[month] ?? 0) + 1
      const year = date.slice(0, 4)
      yearCounts[year] = (yearCounts[year] ?? 0) + 1
    }

    // First/last flight
    if (date < firstFlight.date) firstFlight = flight
    if (date > lastFlight.date) lastFlight = flight
  }

  // Find max route
  let mostFlownRoute: FlightStats['mostFlownRoute'] = null
  for (const r of Object.values(routeCounts)) {
    if (!mostFlownRoute || r.count > mostFlownRoute.count) {
      mostFlownRoute = r
    }
  }

  // Find most visited airport
  let mostVisitedAirport: FlightStats['mostVisitedAirport'] = null
  for (const [iata, count] of Object.entries(airportCounts)) {
    if (!mostVisitedAirport || count > mostVisitedAirport.count) {
      mostVisitedAirport = { iata, count }
    }
  }

  // Find busiest month
  let busiestMonth: FlightStats['busiestMonth'] = null
  for (const [month, count] of Object.entries(monthCounts)) {
    if (!busiestMonth || count > busiestMonth.count) {
      busiestMonth = { month, count }
    }
  }

  return {
    totalFlights: flights.length,
    totalMiles: Math.round(totalMiles),
    uniqueAirports: airports.size,
    uniqueCities: cities.size,
    uniqueCountries: countries.size,
    uniqueAirlines: Object.keys(airlineCounts).length,
    airlineBreakdown: airlineCounts,
    mostFlownRoute,
    mostVisitedAirport,
    busiestMonth,
    firstFlight,
    lastFlight,
    longestRoute,
    shortestRoute,
    domesticRatio: flights.length > 0 ? domesticCount / flights.length : 0,
    flightsByYear: yearCounts,
    estimatedHours: Math.round((totalMiles / 500) * 10) / 10,
    co2Tons: Math.round(totalMiles * 0.000255 * 1000) / 1000,
    flightsByMonth: monthCounts,
  }
}
