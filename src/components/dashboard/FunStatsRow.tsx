import type { FunStats } from '@/lib/types'

interface Props {
  funStats: FunStats
}

export default function FunStatsRow({ funStats }: Props) {
  const pills = [
    { label: 'Earth Orbits', value: funStats.earthOrbits.toFixed(1) },
    { label: 'Moon Journey', value: `${funStats.moonPercent.toFixed(1)}%` },
    { label: 'Days in Air', value: funStats.daysInAir.toFixed(1) },
    ...(funStats.speedComparison > 0
      ? [{ label: 'vs Walking', value: `${funStats.speedComparison}×` }]
      : []),
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        {pills.map((pill) => (
          <div
            key={pill.label}
            className="flex-1 glass-card p-4"
          >
            <p className="text-xs text-[#9A9690] uppercase tracking-wide">{pill.label}</p>
            <p className="text-xl font-bold text-[#2D5A27] mt-1">{pill.value}</p>
          </div>
        ))}
      </div>
      {funStats.distanceLabel && (
        <p className="text-center text-[#6B6960] text-sm italic">
          {funStats.distanceLabel}
        </p>
      )}
    </div>
  )
}
