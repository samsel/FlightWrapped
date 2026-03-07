import { useState, useEffect, useMemo } from 'react'
import type { Flight, FlightStats, FunStats, Insight, Archetype } from '@/lib/types'
import { calculateStats } from '@/lib/stats'
import { calculateFunStats } from '@/lib/funStats'
import { generateInsights } from '@/lib/insights'
import DashboardHeader from './DashboardHeader'
import GlobePanel from './GlobePanel'
import StatsGrid from './StatsGrid'
import FunStatsRow from './FunStatsRow'
import InsightsRow from './InsightsRow'
import ChartsRow from './ChartsRow'
import FlightList from './FlightList'

interface Props {
  flights: Flight[]
  stats: FlightStats
  funStats: FunStats
  insights: Insight[]
  archetype: Archetype
  onReset: () => void
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-800/50 animate-pulse ${className}`} />
}

export default function Dashboard({ flights, stats, funStats, insights, archetype, onReset }: Props) {
  const [ready, setReady] = useState(false)
  const [selectedYear, setSelectedYear] = useState<string>('all')

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const years = useMemo(() => {
    const yrs = Object.keys(stats.flightsByYear).sort()
    return yrs.length > 1 ? yrs : []
  }, [stats.flightsByYear])

  const filteredFlights = useMemo(() => {
    if (selectedYear === 'all') return flights
    return flights.filter((f) => f.date?.startsWith(selectedYear))
  }, [flights, selectedYear])

  const filteredStats = useMemo(() => {
    if (selectedYear === 'all') return stats
    return calculateStats(filteredFlights)
  }, [selectedYear, filteredFlights, stats])

  const filteredFunStats = useMemo(() => {
    if (selectedYear === 'all') return funStats
    return calculateFunStats(filteredStats)
  }, [selectedYear, filteredStats, funStats])

  const filteredInsights = useMemo(() => {
    if (selectedYear === 'all') return insights
    return generateInsights(filteredFlights, filteredStats)
  }, [selectedYear, filteredFlights, filteredStats, insights])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <DashboardHeader
        stats={stats}
        funStats={funStats}
        archetype={archetype}
        flights={flights}
        onReset={onReset}
      />

      <GlobePanel flights={filteredFlights} />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {!ready ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="flex-1 h-20" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-56" />
              <Skeleton className="h-56" />
            </div>
            <Skeleton className="h-64" />
          </>
        ) : (
          <>
            {years.length > 0 && (
              <div className="animate-fade-in flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-400">Filter:</span>
                <button
                  onClick={() => setSelectedYear('all')}
                  className={`text-sm px-3 py-1 transition-colors ${
                    selectedYear === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  All Time
                </button>
                {years.map((year) => (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={`text-sm px-3 py-1 transition-colors ${
                      selectedYear === year
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
            <div className="animate-fade-in"><StatsGrid stats={filteredStats} /></div>
            <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}><FunStatsRow funStats={filteredFunStats} /></div>
            <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}><InsightsRow insights={filteredInsights} /></div>
            <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}><ChartsRow stats={filteredStats} flights={filteredFlights} /></div>
            <div className="animate-fade-in" style={{ animationDelay: '0.4s' }}><FlightList flights={filteredFlights} /></div>
          </>
        )}
      </main>
    </div>
  )
}
