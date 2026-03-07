import { useState, useEffect } from 'react'
import type { Flight, FlightStats, FunStats, Insight, Archetype } from '@/lib/types'
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
  return <div className={`bg-gray-800/50 rounded-xl animate-pulse ${className}`} />
}

export default function Dashboard({ flights, stats, funStats, insights, archetype, onReset }: Props) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Let the first paint show skeletons, then reveal real content
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <DashboardHeader
        stats={stats}
        funStats={funStats}
        archetype={archetype}
        flights={flights}
        onReset={onReset}
      />

      <GlobePanel flights={flights} />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {!ready ? (
          <>
            {/* Stats skeleton: 8 cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
            {/* Fun stats skeleton */}
            <div className="flex flex-col sm:flex-row gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="flex-1 h-20" />
              ))}
            </div>
            {/* Charts skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-56" />
              <Skeleton className="h-56" />
            </div>
            {/* Flight list skeleton */}
            <Skeleton className="h-64" />
          </>
        ) : (
          <>
            <div className="animate-fade-in"><StatsGrid stats={stats} /></div>
            <div className="animate-fade-in" style={{ animationDelay: '0.05s' }}><FunStatsRow funStats={funStats} /></div>
            <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}><InsightsRow insights={insights} /></div>
            <div className="animate-fade-in" style={{ animationDelay: '0.15s' }}><ChartsRow stats={stats} flights={flights} /></div>
            <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}><FlightList flights={flights} /></div>
          </>
        )}
      </main>
    </div>
  )
}
