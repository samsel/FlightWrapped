import type { FlightStats, FunStats, Archetype, Flight } from '@/lib/types'
import { getIcon } from '@/lib/icons'
import { getArchetypeColors } from '@/lib/archetypeColors'
import ShareButton from './ShareButton'

interface Props {
  stats: FlightStats
  funStats: FunStats
  archetype: Archetype
  flights: Flight[]
  onReset: () => void
}

export default function DashboardHeader({ stats, funStats, archetype, flights, onReset }: Props) {
  return (
    <header className="sticky top-0 z-20 bg-gray-950/90 backdrop-blur-sm border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
        <span className="text-lg font-bold tracking-tight">MyFlights</span>

        <span className={`${getArchetypeColors(archetype.id).bg} ${getArchetypeColors(archetype.id).text} px-4 py-1 text-sm font-medium order-3 sm:order-none truncate max-w-[200px] sm:max-w-none`}>
          {getIcon(archetype.icon)} {archetype.name}
        </span>

        <div className="flex items-center gap-3">
          <ShareButton
            stats={stats}
            funStats={funStats}
            archetype={archetype}
            flights={flights}
          />
          <button
            onClick={() => {
              const json = JSON.stringify(flights, null, 2)
              const blob = new Blob([json], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'myflights.json'
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-2"
            title="Export flight data as JSON"
          >
            Export
          </button>
          <button
            onClick={onReset}
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-2"
          >
            Start Over
          </button>
        </div>
      </div>
    </header>
  )
}
