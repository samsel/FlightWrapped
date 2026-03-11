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
  lastSyncAt: string | null
  onFileUpload?: (files: File[]) => void
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-800/50 animate-pulse ${className}`} />
}

export default function Dashboard({ flights, stats, funStats, insights, archetype, onReset, lastSyncAt, onFileUpload }: Props) {
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
    <div className="min-h-screen glass-bg text-white">
      <DashboardHeader
        archetype={archetype}
        onReset={onReset}
        lastSyncAt={lastSyncAt}
        onFileUpload={onFileUpload}
      />

      <div className="relative">
        <GlobePanel flights={filteredFlights} />
        <button
          onClick={() => document.getElementById('dashboard-stats')?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute right-6 bottom-6 text-gray-500 hover:text-gray-300 transition-colors animate-bounce"
          aria-label="Scroll to stats"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" /></svg>
        </button>
      </div>

      <main id="dashboard-stats" className="max-w-6xl mx-auto px-4 py-8 space-y-8">
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
              <div className="animate-fade-in flex items-center gap-2 flex-wrap glass-card px-4 py-3">
                <span className="text-sm text-gray-400 font-medium mr-1">Filter</span>
                <button
                  onClick={() => setSelectedYear('all')}
                  className={`text-sm px-4 py-1.5 transition-all duration-200 font-medium ${
                    selectedYear === 'all'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : 'bg-gray-800/80 text-gray-400 hover:text-white hover:bg-gray-700/80'
                  }`}
                >
                  All Time
                </button>
                {years.map((year) => (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={`text-sm px-4 py-1.5 transition-all duration-200 font-medium ${
                      selectedYear === year
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                        : 'bg-gray-800/80 text-gray-400 hover:text-white hover:bg-gray-700/80'
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
            <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-center gap-3 mb-1">
                <div className="h-px flex-1 bg-gray-800" />
                <span className="text-xs text-gray-500 font-medium uppercase tracking-widest">Charts</span>
                <div className="h-px flex-1 bg-gray-800" />
              </div>
              <ChartsRow stats={filteredStats} flights={filteredFlights} />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-center gap-3 mb-1">
                <div className="h-px flex-1 bg-gray-800" />
                <span className="text-xs text-gray-500 font-medium uppercase tracking-widest">Flight Log</span>
                <div className="h-px flex-1 bg-gray-800" />
              </div>
              <FlightList flights={filteredFlights} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
