import type { Flight, FlightStats, Archetype } from './types'
import { calculateDistance } from './airports'

export function determineArchetype(flights: Flight[], stats: FlightStats): Archetype {
  if (flights.length === 0) {
    return {
      id: 'occasional-flyer',
      name: 'The Occasional Flyer',
      description: 'No flights yet. Your journey is just beginning!',
      icon: 'seedling',
    }
  }

  // The Commuter: top route >40% of flights
  if (stats.mostFlownRoute && stats.mostFlownRoute.count / flights.length > 0.4) {
    return {
      id: 'commuter',
      name: 'The Commuter',
      description: `The ${stats.mostFlownRoute.origin}-${stats.mostFlownRoute.destination} route is practically your second driveway.`,
      icon: 'briefcase',
    }
  }

  // The Explorer: 10+ unique airports, no route >20% of flights
  const maxRouteRatio = stats.mostFlownRoute ? stats.mostFlownRoute.count / flights.length : 0
  if (stats.uniqueAirports >= 10 && maxRouteRatio <= 0.2) {
    return {
      id: 'explorer',
      name: 'The Explorer',
      description: `${stats.uniqueAirports} airports and counting. You never visit the same place twice!`,
      icon: 'compass',
    }
  }

  // The Road Warrior: 30+ flights total
  if (flights.length >= 30) {
    return {
      id: 'road-warrior',
      name: 'The Road Warrior',
      description: `${flights.length} flights and still going strong. The sky is your office.`,
      icon: 'rocket',
    }
  }

  // The Long Hauler: avg distance > 2000 miles
  const avgDistance = flights.length > 0
    ? flights.reduce((sum, f) => sum + calculateDistance(f.origin, f.destination), 0) / flights.length
    : 0
  if (avgDistance > 2000) {
    return {
      id: 'long-hauler',
      name: 'The Long Hauler',
      description: `Your average flight is ${Math.round(avgDistance).toLocaleString()} miles. You don't do short trips.`,
      icon: 'globe',
    }
  }

  // The Weekender: >60% weekend flights, <15 total
  const datedFlights = flights.filter((f) => f.date && f.date.length >= 10)
  const weekendCount = datedFlights.filter((f) => {
    const day = new Date(f.date + 'T00:00:00').getDay()
    return day === 0 || day === 5 || day === 6
  }).length
  if (datedFlights.length > 0 && weekendCount / datedFlights.length > 0.6 && flights.length < 15) {
    return {
      id: 'weekender',
      name: 'The Weekender',
      description: "You fly for fun on the weekends. That's the way to do it!",
      icon: 'palmtree',
    }
  }

  // Default: The Occasional Flyer
  return {
    id: 'occasional-flyer',
    name: 'The Occasional Flyer',
    description: 'You fly when the occasion calls for it. Every trip is special!',
    icon: 'plane',
  }
}
