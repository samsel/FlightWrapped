import type { Flight, FlightStats, Insight } from './types'
import { lookupAirport } from './airports'

export function generateInsights(flights: Flight[], stats: FlightStats): Insight[] {
  const insights: Insight[] = []

  if (flights.length === 0) return insights

  // Weekend Warrior: >50% flights on Fri/Sat/Sun
  const datedFlights = flights.filter((f) => f.date && f.date.length >= 10)
  const weekendCount = datedFlights.filter((f) => {
    const day = new Date(f.date + 'T00:00:00').getDay()
    return day === 0 || day === 5 || day === 6 // Sun, Fri, Sat
  }).length
  if (datedFlights.length > 0 && weekendCount / datedFlights.length > 0.5) {
    insights.push({
      id: 'weekend-warrior',
      title: 'Weekend Warrior',
      description: `${Math.round((weekendCount / datedFlights.length) * 100)}% of your flights are on weekends. You make the most of your time off!`,
      icon: 'calendar',
    })
  }

  // Loyalty King: >60% on one airline
  if (stats.uniqueAirlines > 0) {
    const topAirline = Object.entries(stats.airlineBreakdown).sort((a, b) => b[1] - a[1])[0]
    if (topAirline && topAirline[1] / flights.length > 0.6) {
      insights.push({
        id: 'loyalty-king',
        title: 'Loyalty King',
        description: `${Math.round((topAirline[1] / flights.length) * 100)}% of your flights are with ${topAirline[0]}. You know where your loyalty lies!`,
        icon: 'crown',
      })
    }
  }

  // Globe Trotter: 5+ unique countries
  if (stats.uniqueCountries >= 5) {
    insights.push({
      id: 'globe-trotter',
      title: 'Globe Trotter',
      description: `You've flown to ${stats.uniqueCountries} different countries. A true world traveler!`,
      icon: 'globe',
    })
  }

  // Domestic Flyer: >80% domestic
  if (stats.domesticRatio > 0.8) {
    insights.push({
      id: 'domestic-flyer',
      title: 'Domestic Flyer',
      description: `${Math.round(stats.domesticRatio * 100)}% of your flights stay within the same country. There's plenty to explore at home!`,
      icon: 'home',
    })
  }

  // International Jet-Setter: >50% international
  if (1 - stats.domesticRatio > 0.5) {
    insights.push({
      id: 'international-jet-setter',
      title: 'International Jet-Setter',
      description: `${Math.round((1 - stats.domesticRatio) * 100)}% of your flights cross borders. You love going international!`,
      icon: 'passport',
    })
  }

  // Frequent Flyer: 20+ flights/year in any year
  for (const [year, count] of Object.entries(stats.flightsByYear)) {
    if (count >= 20) {
      insights.push({
        id: 'frequent-flyer',
        title: 'Frequent Flyer',
        description: `You took ${count} flights in ${year}. That's serious frequent flyer status!`,
        icon: 'zap',
      })
      break
    }
  }

  // Seasonal Traveler: >40% flights in one quarter
  const quarterCounts: Record<string, number> = {}
  for (const flight of flights) {
    if (!flight.date || flight.date.length < 7) continue
    const month = parseInt(flight.date.slice(5, 7), 10)
    if (isNaN(month)) continue
    const quarter = `Q${Math.ceil(month / 3)}`
    quarterCounts[quarter] = (quarterCounts[quarter] ?? 0) + 1
  }
  const topQuarter = Object.entries(quarterCounts).sort((a, b) => b[1] - a[1])[0]
  if (topQuarter && topQuarter[1] / flights.length > 0.4) {
    insights.push({
      id: 'seasonal-traveler',
      title: 'Seasonal Traveler',
      description: `${Math.round((topQuarter[1] / flights.length) * 100)}% of your flights are in ${topQuarter[0]}. You have a favorite travel season!`,
      icon: 'sun',
    })
  }

  // Hub Hugger: >30% flights through one airport
  if (stats.mostVisitedAirport && stats.mostVisitedAirport.count / (flights.length * 2) > 0.3) {
    const ap = lookupAirport(stats.mostVisitedAirport.iata)
    const name = ap ? `${ap.city} (${stats.mostVisitedAirport.iata})` : stats.mostVisitedAirport.iata
    insights.push({
      id: 'hub-hugger',
      title: 'Hub Hugger',
      description: `${name} is your home base. It appears in ${Math.round((stats.mostVisitedAirport.count / (flights.length * 2)) * 100)}% of your flights!`,
      icon: 'hub',
    })
  }

  // Coast-to-Coast: has airports from both US coasts
  const eastCoast = new Set(['JFK', 'EWR', 'LGA', 'BOS', 'DCA', 'IAD', 'PHL', 'MIA', 'FLL', 'ATL'])
  const westCoast = new Set(['LAX', 'SFO', 'SEA', 'PDX', 'SAN', 'SJC', 'OAK', 'LAS'])
  const allCodes = new Set(flights.flatMap((f) => [f.origin, f.destination]))
  const hasEast = [...allCodes].some((c) => eastCoast.has(c))
  const hasWest = [...allCodes].some((c) => westCoast.has(c))
  if (hasEast && hasWest) {
    insights.push({
      id: 'coast-to-coast',
      title: 'Coast to Coast',
      description: "You've flown both coasts. From sea to shining sea!",
      icon: 'map',
    })
  }

  return insights
}
