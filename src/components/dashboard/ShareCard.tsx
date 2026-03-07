import { forwardRef } from 'react'
import type { FlightStats, FunStats, Archetype, Flight } from '@/lib/types'
import { getIcon } from '@/lib/icons'

// Inline color map for share card (can't use Tailwind classes in inline styles)
const ARCHETYPE_ACCENT: Record<string, { gradient: string; pill: string; pillText: string }> = {
  'commuter':        { gradient: '#f59e0b', pill: 'rgba(245,158,11,0.2)', pillText: '#fcd34d' },
  'explorer':        { gradient: '#10b981', pill: 'rgba(16,185,129,0.2)', pillText: '#6ee7b7' },
  'road-warrior':    { gradient: '#ef4444', pill: 'rgba(239,68,68,0.2)',  pillText: '#fca5a5' },
  'long-hauler':     { gradient: '#a855f7', pill: 'rgba(168,85,247,0.2)', pillText: '#d8b4fe' },
  'weekender':       { gradient: '#06b6d4', pill: 'rgba(6,182,212,0.2)',  pillText: '#67e8f9' },
  'occasional-flyer':{ gradient: '#3b82f6', pill: 'rgba(59,130,246,0.2)', pillText: '#93c5fd' },
}

const DEFAULT_ACCENT = { gradient: '#3b82f6', pill: 'rgba(59,130,246,0.2)', pillText: '#93c5fd' }

interface Props {
  stats: FlightStats
  funStats: FunStats
  archetype: Archetype
  flights: Flight[]
}

const ShareCard = forwardRef<HTMLDivElement, Props>(
  ({ stats, funStats, archetype, flights }, ref) => {
    const accent = ARCHETYPE_ACCENT[archetype.id] ?? DEFAULT_ACCENT

    const statItems = [
      { label: 'Flights', value: stats.totalFlights.toLocaleString() },
      { label: 'Miles', value: stats.totalMiles.toLocaleString() },
      { label: 'Airports', value: stats.uniqueAirports.toLocaleString() },
      { label: 'Countries', value: stats.uniqueCountries.toLocaleString() },
      { label: 'Hours', value: Math.round(stats.estimatedHours).toLocaleString() },
      { label: 'CO\u2082 Tons', value: stats.co2Tons.toFixed(1) },
    ]

    const yearRange =
      flights.length > 0
        ? (() => {
            const years = flights
              .map((f) => f.date?.slice(0, 4))
              .map(Number)
              .filter((y) => y > 0 && !isNaN(y))
            if (years.length === 0) return ''
            const min = Math.min(...years)
            const max = Math.max(...years)
            return min === max ? `${min}` : `${min}\u2013${max}`
          })()
        : ''

    return (
      <div
        ref={ref}
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: '1200px',
          height: '630px',
        }}
      >
        <div
          style={{
            width: '1200px',
            height: '630px',
            background: '#0f172a',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 64px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: '#fff',
            boxSizing: 'border-box',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px', position: 'relative' }}>
            <span style={{ fontSize: '40px', fontWeight: 800, letterSpacing: '-0.03em' }}>
              MyFlights
            </span>
          </div>

          {/* Archetype pill */}
          <div
            style={{
              background: accent.pill,
              color: accent.pillText,
              borderRadius: '9999px',
              padding: '10px 28px',
              fontSize: '20px',
              fontWeight: 600,
              marginBottom: '40px',
              position: 'relative',
            }}
          >
            {getIcon(archetype.icon)} {archetype.name}
          </div>

          {/* Stats grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '24px 56px',
              marginBottom: '40px',
              width: '100%',
              maxWidth: '760px',
              position: 'relative',
            }}
          >
            {statItems.map((item) => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '44px',
                    fontWeight: 800,
                    lineHeight: 1.1,
                    color: accent.pillText,
                  }}
                >
                  {item.value}
                </div>
                <div style={{ fontSize: '14px', color: '#9ca3af', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {/* Fun stat tagline */}
          <div
            style={{
              fontSize: '18px',
              color: '#d1d5db',
              marginBottom: '28px',
              fontStyle: 'italic',
              position: 'relative',
            }}
          >
            {funStats.earthOrbits.toFixed(1)} Earth orbits &middot;{' '}
            {funStats.daysInAir.toFixed(1)} days in the air
          </div>

          {/* Footer */}
          <div style={{ fontSize: '13px', color: '#6b7280', position: 'relative' }}>
            {stats.totalFlights} flights{yearRange ? ` \u00B7 ${yearRange}` : ''} \u00B7 myflights.app
          </div>
        </div>
      </div>
    )
  },
)

ShareCard.displayName = 'ShareCard'

export default ShareCard
