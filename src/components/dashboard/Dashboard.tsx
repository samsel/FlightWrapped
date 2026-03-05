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

export default function Dashboard({ flights, stats, funStats, insights, archetype, onReset }: Props) {
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
        <StatsGrid stats={stats} />
        <FunStatsRow funStats={funStats} />
        <InsightsRow insights={insights} />
        <ChartsRow stats={stats} flights={flights} />
        <FlightList flights={flights} />
      </main>
    </div>
  )
}
