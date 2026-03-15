import { useMemo, useState } from 'react'
import type { FlightStats } from '@/lib/types'

interface Props {
  stats: FlightStats
}

// Nature-inspired palette matching Seed aesthetic
const COLORS = ['#2D5A27', '#6B8E5A', '#8B6914', '#7B4B3A', '#4A7C59', '#9B7B3A', '#5D6B4A', '#3A6B6B']

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
    <div className="bg-white border border-[#E5E0D5] p-4 rounded-lg">
      <h3 className="text-sm font-semibold text-[#6B6960] mb-3">Airlines</h3>
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
          <text x={cx} y={cy - 6} textAnchor="middle" fill="#1A1A1A" fontSize={22} fontWeight="bold">
            {hoveredIndex !== null ? segments[hoveredIndex][1] : total}
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fill="#9A9690" fontSize={11}>
            {hoveredIndex !== null ? segments[hoveredIndex][0] : 'flights'}
          </text>
        </svg>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm w-full">
          {segments.map(([name, count], i) => (
            <div
              key={name}
              className="flex items-center gap-2 py-0.5 px-1 -mx-1 rounded transition-colors cursor-default"
              style={{ backgroundColor: hoveredIndex === i ? 'rgba(45, 90, 39, 0.05)' : 'transparent' }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-[#6B6960] truncate">{name}</span>
              <span className="text-[#6B6960] ml-auto">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
