import type { FunStats } from '@/lib/types'

interface Props {
  funStats: FunStats
}

export default function FunStatsRow({ funStats }: Props) {
  const pills = [
    { emoji: '🌍', label: 'Earth Orbits', value: funStats.earthOrbits.toFixed(1) },
    { emoji: '🌙', label: 'Moon Journey', value: `${funStats.moonPercent.toFixed(1)}%` },
    { emoji: '🕐', label: 'Days in Air', value: funStats.daysInAir.toFixed(1) },
  ]

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {pills.map((pill) => (
        <div
          key={pill.label}
          className="flex-1 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3"
        >
          <span className="text-2xl">{pill.emoji}</span>
          <div>
            <p className="text-xl font-bold text-blue-300">{pill.value}</p>
            <p className="text-sm text-gray-400">{pill.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
