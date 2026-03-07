import { forwardRef } from 'react'
import type { FlightStats, FunStats, Archetype, Flight } from '@/lib/types'

interface Props {
  stats: FlightStats
  funStats: FunStats
  archetype: Archetype
  flights: Flight[]
}

const ShareCard = forwardRef<HTMLDivElement, Props>(
  ({ stats, funStats, archetype, flights }, ref) => {
    const statItems = [
      { label: 'Flights', value: stats.totalFlights.toLocaleString() },
      { label: 'Miles', value: stats.totalMiles.toLocaleString() },
      { label: 'Airports', value: stats.uniqueAirports.toLocaleString() },
      { label: 'Countries', value: stats.uniqueCountries.toLocaleString() },
      { label: 'Hours', value: Math.round(stats.estimatedHours).toLocaleString() },
      { label: 'CO₂ Tons', value: stats.co2Tons.toFixed(1) },
    ]

    const yearRange =
      flights.length > 0
        ? (() => {
            const years = flights.map((f) => f.date.slice(0, 4))
            const min = Math.min(...years.map(Number))
            const max = Math.max(...years.map(Number))
            return min === max ? `${min}` : `${min}–${max}`
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
            background: 'linear-gradient(135deg, #030712 0%, #0f172a 50%, #030712 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 64px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: '#fff',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
            <span style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.02em' }}>
              MyFlights
            </span>
          </div>

          {/* Archetype pill */}
          <div
            style={{
              background: 'rgba(59, 130, 246, 0.2)',
              color: '#93c5fd',
              borderRadius: '9999px',
              padding: '6px 20px',
              fontSize: '16px',
              fontWeight: 500,
              marginBottom: '36px',
            }}
          >
            {archetype.icon} {archetype.name}
          </div>

          {/* Stats grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '20px 48px',
              marginBottom: '36px',
              width: '100%',
              maxWidth: '720px',
            }}
          >
            {statItems.map((item) => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '40px',
                    fontWeight: 700,
                    lineHeight: 1.2,
                    background: 'linear-gradient(to right, #60a5fa, #a78bfa)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {item.value}
                </div>
                <div style={{ fontSize: '14px', color: '#9ca3af', marginTop: '4px' }}>
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
              marginBottom: '24px',
              fontStyle: 'italic',
            }}
          >
            {funStats.earthOrbits.toFixed(1)} Earth orbits &middot;{' '}
            {funStats.daysInAir.toFixed(1)} days in the air
          </div>

          {/* Footer */}
          <div style={{ fontSize: '13px', color: '#6b7280' }}>
            {stats.totalFlights} flights{yearRange ? ` · ${yearRange}` : ''}
          </div>
        </div>
      </div>
    )
  },
)

ShareCard.displayName = 'ShareCard'

export default ShareCard
