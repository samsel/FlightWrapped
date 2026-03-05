import type { Archetype } from '@/lib/types'

interface Props {
  archetype: Archetype
  onReset: () => void
}

export default function DashboardHeader({ archetype, onReset }: Props) {
  return (
    <header className="sticky top-0 z-20 bg-gray-950/90 backdrop-blur-sm border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
        <span className="text-lg font-bold tracking-tight">MyFlights</span>

        <span className="bg-blue-500/20 text-blue-300 rounded-full px-4 py-1 text-sm font-medium order-3 sm:order-none">
          {archetype.icon} {archetype.name}
        </span>

        <button
          onClick={onReset}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Start Over
        </button>
      </div>
    </header>
  )
}
