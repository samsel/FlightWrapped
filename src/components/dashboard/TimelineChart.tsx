import { useMemo, useState } from 'react'
import type { Flight } from '@/lib/types'

interface Props {
  flights: Flight[]
}

export default function TimelineChart({ flights }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const { months, maxCount } = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const f of flights) {
      if (f.date) {
        const key = f.date.slice(0, 7)
        counts[key] = (counts[key] ?? 0) + 1
      }
    }

    const keys = Object.keys(counts).sort()
    if (keys.length === 0) return { months: [], maxCount: 0 }

    // Fill in missing months between first and last
    const allMonths: [string, number][] = []
    const [startYear, startMonth] = keys[0].split('-').map(Number)
    const [endYear, endMonth] = keys[keys.length - 1].split('-').map(Number)

    let y = startYear, m = startMonth
    while (y < endYear || (y === endYear && m <= endMonth)) {
      const key = `${y}-${String(m).padStart(2, '0')}`
      allMonths.push([key, counts[key] ?? 0])
      m++
      if (m > 12) { m = 1; y++ }
    }

    const max = Math.max(...allMonths.map(([, c]) => c), 1)
    return { months: allMonths, maxCount: max }
  }, [flights])

  if (months.length === 0) return null

  const barWidth = 28
  const gap = 6
  const chartWidth = months.length * (barWidth + gap)
  const chartHeight = 160
  const topPad = 24
  const bottomPad = 40

  return (
    <div className="bg-white border border-[#E5E0D5] p-4 rounded-lg">
      <h3 className="text-sm font-semibold text-[#6B6960] mb-3">Flights Over Time</h3>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight + topPad + bottomPad}`}
          width="100%"
          style={{ minWidth: chartWidth }}
          className="text-[#1A1A1A]"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* Baseline */}
          <line
            x1={0}
            x2={chartWidth}
            y1={topPad + chartHeight}
            y2={topPad + chartHeight}
            stroke="#E5E0D5"
            strokeWidth={1}
          />

          {months.map(([month, count], i) => {
            const x = i * (barWidth + gap) + gap / 2
            const barHeight = (count / maxCount) * chartHeight
            const y = topPad + chartHeight - barHeight
            const isHovered = hoveredIndex === i

            return (
              <g
                key={month}
                onMouseEnter={() => setHoveredIndex(i)}
                style={{ cursor: 'default' }}
              >
                {/* Hover highlight background */}
                {isHovered && (
                  <rect
                    x={x - 2}
                    y={topPad}
                    width={barWidth + 4}
                    height={chartHeight}
                    fill="rgba(45, 90, 39, 0.04)"
                    rx={4}
                  />
                )}

                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={isHovered ? '#3A7233' : '#2D5A27'}
                  rx={3}
                  className="bar-animated"
                  style={{ animationDelay: `${i * 60}ms`, transition: 'fill 0.15s ease' }}
                >
                  <title>{month}: {count} flight{count !== 1 ? 's' : ''}</title>
                </rect>

                {/* Count label */}
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize={isHovered ? 11 : 10}
                  fill={isHovered ? '#1B3409' : '#2D5A27'}
                  fontWeight={isHovered ? 600 : 400}
                  style={{ transition: 'all 0.15s ease' }}
                >
                  {count}
                </text>

                {/* Month label */}
                <text
                  x={x + barWidth / 2}
                  y={topPad + chartHeight + 16}
                  textAnchor="middle"
                  fontSize={10}
                  fill={isHovered ? '#6B6960' : '#9A9690'}
                  transform={`rotate(45, ${x + barWidth / 2}, ${topPad + chartHeight + 16})`}
                  style={{ transition: 'fill 0.15s ease' }}
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
