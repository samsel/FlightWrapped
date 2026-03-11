import { useMemo, useState } from 'react'
import type { FlightStats } from '@/lib/types'

interface Props {
  stats: FlightStats
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f97316', '#84cc16']

export default function AirlineDonut({ stats }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const { segments, total, offsets } = useMemo(() => {
    const entries = Object.entries(stats.airlineBreakdown).sort(([, a], [, b]) => b - a)
    const top7 = entries.slice(0, 7)
    const otherCount = entries.slice(7).reduce((sum, [, c]) => sum + c, 0)
    const all = otherCount > 0 ? [...top7, ['Other', otherCount] as [string, number]] : top7
    const total = all.reduce((sum, [, c]) => sum + c, 0)

    const circumference = 2 * Math.PI * 60
    const offsets: number[] = []
    let acc = 0
    for (const [, count] of all) {
      offsets.push(acc)
      acc += (count / total) * circumference
    }

    return { segments: all, total, offsets }
  }, [stats.airlineBreakdown])

  if (segments.length === 0) return null

  const size = 160
  const cx = size / 2
  const cy = size / 2
  const radius = 60
  const circumference = 2 * Math.PI * radius

  return (
    <div className="bg-gray-900 border border-gray-800 p-4">
      <h3 className="text-sm font-semibold text-gray-400 mb-3">Airlines</h3>
      <div className="flex flex-col items-center gap-4">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {segments.map(([name, count], i) => {
            const dash = (count / total) * circumference
            const isHovered = hoveredIndex === i

            return (
              <circle
                key={name}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={isHovered ? 24 : 20}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offsets[i]}
                transform={`rotate(-90, ${cx}, ${cy})`}
                opacity={hoveredIndex !== null && !isHovered ? 0.4 : 1}
                className="donut-animated"
                style={{ animationDelay: `${i * 150}ms`, transition: 'stroke-width 0.15s ease, opacity 0.15s ease', cursor: 'default' }}
                onMouseEnter={() => setHoveredIndex(i)}
              >
                <title>{name}: {count} flight{count !== 1 ? 's' : ''} ({Math.round((count / total) * 100)}%)</title>
              </circle>
            )
          })}
          <text x={cx} y={cy - 6} textAnchor="middle" fill="white" fontSize={22} fontWeight="bold">
            {hoveredIndex !== null ? segments[hoveredIndex][1] : total}
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fill="#9ca3af" fontSize={11}>
            {hoveredIndex !== null ? segments[hoveredIndex][0] : 'flights'}
          </text>
        </svg>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm w-full">
          {segments.map(([name, count], i) => (
            <div
              key={name}
              className="flex items-center gap-2 py-0.5 px-1 -mx-1 transition-colors cursor-default"
              style={{ backgroundColor: hoveredIndex === i ? 'rgba(255,255,255,0.05)' : 'transparent' }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span
                className="w-3 h-3 flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-gray-400 truncate">{name}</span>
              <span className="text-gray-400 ml-auto">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
