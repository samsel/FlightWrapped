import type { FlightStats } from '@/lib/types'
import { lookupAirport } from '@/lib/airports'

interface Props {
  stats: FlightStats
}

interface StatCard {
  emoji: string
  value: string
  label: string
  subtitle?: string
}

export default function StatsGrid({ stats }: Props) {
  const longestLabel = stats.longestRoute
    ? `${stats.longestRoute.origin}–${stats.longestRoute.destination}`
    : undefined

  const longestCities =
    stats.longestRoute
      ? [lookupAirport(stats.longestRoute.origin)?.city, lookupAirport(stats.longestRoute.destination)?.city]
          .filter(Boolean)
          .join(' → ')
      : undefined

  const cards: StatCard[] = [
    { emoji: '✈️', value: stats.totalFlights.toLocaleString(), label: 'Total Flights' },
    { emoji: '🌍', value: stats.totalMiles.toLocaleString(), label: 'Miles Flown' },
    { emoji: '📍', value: stats.uniqueAirports.toLocaleString(), label: 'Airports' },
    { emoji: '🏳️', value: stats.uniqueCountries.toLocaleString(), label: 'Countries' },
    { emoji: '🏢', value: stats.uniqueAirlines.toLocaleString(), label: 'Airlines' },
    { emoji: '🕐', value: stats.estimatedHours.toLocaleString(), label: 'Hours in Air' },
    { emoji: '🍃', value: stats.co2Tons.toFixed(1), label: 'CO₂ Tonnes' },
    {
      emoji: '🛫',
      value: stats.longestRoute ? stats.longestRoute.miles.toLocaleString() + ' mi' : '—',
      label: 'Longest Route',
      subtitle: longestCities || longestLabel,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <span className="text-lg">{card.emoji}</span>
          <p className="text-3xl font-bold mt-1">{card.value}</p>
          <p className="text-sm text-gray-400">{card.label}</p>
          {card.subtitle && <p className="text-xs text-gray-500 mt-1 truncate">{card.subtitle}</p>}
        </div>
      ))}
    </div>
  )
}
