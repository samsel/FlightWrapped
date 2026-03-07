import { useState, useEffect } from 'react'
import type { FlightStats } from '@/lib/types'
import { lookupAirport } from '@/lib/airports'
import { useCountUp } from '@/hooks/useCountUp'

interface Props {
  stats: FlightStats
}

interface StatCard {
  emoji: string
  value: number
  displayValue?: string
  label: string
  subtitle?: string
  suffix?: string
  accent: string // tailwind border color class
}

function AnimatedStat({ card, started }: { card: StatCard; started: boolean }) {
  const count = useCountUp(card.value, 1500, started)

  return (
    <div className={`bg-gray-900 border border-gray-800 p-4 border-l-2 ${card.accent}`}>
      <span className="text-lg">{card.emoji}</span>
      <p className="text-2xl sm:text-3xl font-bold mt-1">
        {card.displayValue ?? (started ? count.toLocaleString() : '0')}{card.suffix ?? ''}
      </p>
      <p className="text-sm text-gray-400">{card.label}</p>
      {card.subtitle && <p className="text-xs text-gray-500 mt-1 truncate">{card.subtitle}</p>}
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
    { emoji: '✈️', value: stats.totalFlights, label: 'Total Flights', accent: 'border-l-blue-500' },
    { emoji: '🌍', value: stats.totalMiles, label: 'Miles Flown', accent: 'border-l-purple-500' },
    { emoji: '📍', value: stats.uniqueAirports, label: 'Airports', accent: 'border-l-amber-500' },
    { emoji: '🏳️', value: stats.uniqueCountries, label: 'Countries', accent: 'border-l-emerald-500' },
    { emoji: '🏢', value: stats.uniqueAirlines, label: 'Airlines', accent: 'border-l-pink-500' },
    { emoji: '🕐', value: Math.round(stats.estimatedHours), label: 'Hours in Air', accent: 'border-l-cyan-500' },
    { emoji: '🍃', value: 0, displayValue: stats.co2Tons.toFixed(1), label: 'CO₂ Tonnes', accent: 'border-l-green-500' },
    {
      emoji: '🛫',
      value: stats.longestRoute?.miles ?? 0,
      label: 'Longest Route',
      suffix: stats.longestRoute ? ' mi' : '',
      subtitle: longestCities || longestLabel,
      accent: 'border-l-indigo-500',
    },
    ...(stats.mostFlownRoute ? [{
      emoji: '🔁',
      value: stats.mostFlownRoute.count,
      label: 'Most Flown Route',
      suffix: '×',
      subtitle: mostFlownLabel,
      accent: 'border-l-orange-500',
    }] : []),
    ...(stats.mostVisitedAirport ? [{
      emoji: '🏠',
      value: stats.mostVisitedAirport.count,
      label: 'Most Visited Airport',
      suffix: ' visits',
      subtitle: mostVisitedLabel,
      accent: 'border-l-rose-500',
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
