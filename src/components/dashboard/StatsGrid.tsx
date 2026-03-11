import { useState, useEffect } from 'react'
import type { FlightStats } from '@/lib/types'
import { lookupAirport } from '@/lib/airports'
import { useCountUp } from '@/hooks/useCountUp'

interface Props {
  stats: FlightStats
}

interface StatCard {
  value: number
  displayValue?: string
  label: string
  subtitle?: string
  suffix?: string
}

function AnimatedStat({ card, started }: { card: StatCard; started: boolean }) {
  const count = useCountUp(card.value, 1500, started)

  return (
    <div className="bg-gray-900 border border-gray-800 p-4">
      <p className="text-2xl sm:text-3xl font-bold">
        {card.displayValue ?? (started ? count.toLocaleString() : '0')}{card.suffix ?? ''}
      </p>
      <p className="text-sm text-gray-400">{card.label}</p>
      {card.subtitle && <p className="text-xs text-gray-400 mt-1 truncate">{card.subtitle}</p>}
    </div>
  )
}

export default function StatsGrid({ stats }: Props) {
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setStarted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const longestLabel = stats.longestRoute
    ? `${stats.longestRoute.origin}–${stats.longestRoute.destination}`
    : undefined

  const longestCities =
    stats.longestRoute
      ? [lookupAirport(stats.longestRoute.origin)?.city, lookupAirport(stats.longestRoute.destination)?.city]
          .filter(Boolean)
          .join(' → ')
      : undefined

  const mostFlownLabel = stats.mostFlownRoute
    ? `${stats.mostFlownRoute.origin}–${stats.mostFlownRoute.destination} (${stats.mostFlownRoute.count}×)`
    : undefined

  const mostVisitedLabel = stats.mostVisitedAirport
    ? (() => {
        const ap = lookupAirport(stats.mostVisitedAirport.iata)
        return ap ? `${ap.city} (${stats.mostVisitedAirport.iata})` : stats.mostVisitedAirport.iata
      })()
    : undefined

  const cards: StatCard[] = [
    { value: stats.totalFlights, label: 'Total Flights' },
    { value: stats.totalMiles, label: 'Miles Flown' },
    { value: stats.uniqueAirports, label: 'Airports' },
    { value: stats.uniqueCountries, label: 'Countries' },
    { value: stats.uniqueAirlines, label: 'Airlines' },
    { value: Math.round(stats.estimatedHours), label: 'Hours in Air' },
    { value: 0, displayValue: stats.co2Tons.toFixed(1), label: 'CO₂ Tonnes' },
    {
      value: stats.longestRoute?.miles ?? 0,
      label: 'Longest Route',
      suffix: stats.longestRoute ? ' mi' : '',
      subtitle: longestCities || longestLabel,
    },
    ...(stats.mostFlownRoute ? [{
      value: stats.mostFlownRoute.count,
      label: 'Most Flown Route',
      suffix: '×',
      subtitle: mostFlownLabel,
    }] : []),
    ...(stats.mostVisitedAirport ? [{
      value: stats.mostVisitedAirport.count,
      label: 'Most Visited Airport',
      suffix: ' visits',
      subtitle: mostVisitedLabel,
    }] : []),
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <AnimatedStat key={card.label} card={card} started={started} />
      ))}
    </div>
  )
}
