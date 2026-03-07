import type { FlightStats, FunStats } from './types'

const EARTH_CIRCUMFERENCE_MILES = 24901
const EARTH_TO_MOON_MILES = 238900
const WALKING_SPEED_MPH = 3.1

export function calculateFunStats(stats: FlightStats): FunStats {
  const earthOrbits = Math.round((stats.totalMiles / EARTH_CIRCUMFERENCE_MILES) * 100) / 100
  const moonPercent = Math.round((stats.totalMiles / EARTH_TO_MOON_MILES) * 10000) / 100
  const daysInAir = Math.round((stats.estimatedHours / 24) * 10) / 10
  const speedComparison = stats.estimatedHours > 0
    ? Math.round(stats.totalMiles / (stats.estimatedHours * WALKING_SPEED_MPH))
    : 0

  let distanceLabel: string
  if (stats.totalMiles >= EARTH_TO_MOON_MILES * 2) {
    distanceLabel = 'enough to fly to the Moon and back!'
  } else if (stats.totalMiles >= EARTH_TO_MOON_MILES) {
    distanceLabel = 'enough to fly to the Moon!'
  } else if (stats.totalMiles >= EARTH_CIRCUMFERENCE_MILES * 2) {
    distanceLabel = 'enough to circle the Earth twice!'
  } else if (stats.totalMiles >= EARTH_CIRCUMFERENCE_MILES) {
    distanceLabel = 'enough to circle the Earth!'
  } else if (stats.totalMiles >= 10000) {
    distanceLabel = `that's farther than flying from New York to Sydney!`
  } else {
    distanceLabel = `that's a lot of flying!`
  }

  return { earthOrbits, moonPercent, daysInAir, speedComparison, distanceLabel }
}
