import { useMemo } from 'react'
import type { Flight } from '@/lib/types'

interface Props {
  flights: Flight[]
}

export default function TimelineChart({ flights }: Props) {
  const { months, maxCount } = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const f of flights) {
      if (f.date) {
        const key = f.date.slice(0, 7)
        counts[key] = (counts[key] ?? 0) + 1
      }
    }

    const sorted = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
    const max = Math.max(...sorted.map(([, c]) => c), 1)
    return { months: sorted, maxCount: max }
  }, [flights])

  if (months.length === 0) return null

  const barWidth = 28
  const gap = 6
  const chartWidth = months.length * (barWidth + gap)
  const chartHeight = 160
  const topPad = 24
  const bottomPad = 40

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <h3 className="text-sm font-semibold text-gray-400 mb-3">Flights Over Time</h3>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight + topPad + bottomPad}`}
          width="100%"
          style={{ minWidth: chartWidth }}
          className="text-gray-300"
        >
          {/* Baseline */}
          <line
            x1={0}
            x2={chartWidth}
            y1={topPad + chartHeight}
            y2={topPad + chartHeight}
            stroke="#374151"
            strokeWidth={1}
          />

          {months.map(([month, count], i) => {
            const x = i * (barWidth + gap) + gap / 2
            const barHeight = (count / maxCount) * chartHeight
            const y = topPad + chartHeight - barHeight

            return (
              <g key={month}>
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={4}
                  ry={4}
                  fill="#3b82f6"
                  className="bar-animated hover:opacity-80 transition-opacity cursor-default"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <title>{month}: {count} flight{count !== 1 ? 's' : ''}</title>
                </rect>

                {/* Count label */}
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#93c5fd"
                >
                  {count}
                </text>

                {/* Month label */}
                <text
                  x={x + barWidth / 2}
                  y={topPad + chartHeight + 16}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#6b7280"
                  transform={`rotate(45, ${x + barWidth / 2}, ${topPad + chartHeight + 16})`}
                >
                  {month}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
