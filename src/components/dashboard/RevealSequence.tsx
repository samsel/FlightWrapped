import { useState, useEffect, useCallback, useMemo } from 'react'
import type { FlightStats, FunStats, Archetype } from '@/lib/types'
import { getArchetypeColors } from '@/lib/archetypeColors'
import { useCountUp } from '@/hooks/useCountUp'

interface Props {
  stats: FlightStats
  funStats: FunStats
  archetype: Archetype
  onComplete: () => void
}

interface Slide {
  key: string
  render: (active: boolean) => React.ReactNode
  duration: number // ms before auto-advance
}

function BigNumber({ value, suffix, started }: { value: number; suffix?: string; started: boolean }) {
  const count = useCountUp(value, 2000, started)
  return (
    <span className="reveal-gradient-text" style={{ fontSize: 'clamp(3rem, 12vw, 7rem)', fontWeight: 800, lineHeight: 1 }}>
      {started ? count.toLocaleString() : '0'}{suffix ?? ''}
    </span>
  )
}

export default function RevealSequence({ stats, funStats, archetype, onComplete }: Props) {
  const [slideIndex, setSlideIndex] = useState(0)
  const [active, setActive] = useState(false)
  const [exiting, setExiting] = useState(false)

  const colors = getArchetypeColors(archetype.id)

  const slides: Slide[] = useMemo(() => [
    {
      key: 'flights',
      duration: 3200,
      render: (a) => (
        <div className="reveal-slide">
          <BigNumber value={stats.totalFlights} started={a} />
          <p className="reveal-label">flights taken</p>
        </div>
      ),
    },
    {
      key: 'miles',
      duration: 3200,
      render: (a) => (
        <div className="reveal-slide">
          <BigNumber value={stats.totalMiles} started={a} />
          <p className="reveal-label">miles flown</p>
          {funStats.earthOrbits > 0 && (
            <p className="reveal-sublabel">{funStats.earthOrbits.toFixed(1)} orbits around the Earth</p>
          )}
        </div>
      ),
    },
    {
      key: 'places',
      duration: 3200,
      render: (a) => (
        <div className="reveal-slide">
          <div className="flex items-center gap-8 sm:gap-16">
            <div className="text-center">
              <BigNumber value={stats.uniqueAirports} started={a} />
              <p className="reveal-label">airports</p>
            </div>
            <div className="text-center">
              <BigNumber value={stats.uniqueCountries} started={a} />
              <p className="reveal-label">countries</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'archetype',
      duration: 4000,
      render: () => (
        <div className="reveal-slide">
          <p className="reveal-label">you are</p>
          <p className={`text-3xl sm:text-5xl font-bold mt-2 ${colors.text}`}>
            {archetype.name}
          </p>
          <p className="reveal-sublabel max-w-md mt-4">{archetype.description}</p>
        </div>
      ),
    },
  ], [stats, funStats, archetype, colors])

  const advance = useCallback(() => {
    setExiting(true)
    setTimeout(() => {
      setExiting(false)
      setActive(false)
      if (slideIndex < slides.length - 1) {
        setSlideIndex((i) => i + 1)
      } else {
        onComplete()
      }
    }, 400) // exit animation duration
  }, [slideIndex, slides.length, onComplete])

  // Activate slide on mount / index change
  useEffect(() => {
    const timer = setTimeout(() => setActive(true), 100)
    return () => clearTimeout(timer)
  }, [slideIndex])

  // Auto-advance
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(advance, slides[slideIndex].duration)
    return () => clearTimeout(timer)
  }, [active, slideIndex, slides, advance])

  const handleClick = () => {
    if (active && !exiting) advance()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 glass-bg flex flex-col items-center justify-center px-4 cursor-pointer select-none"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      {/* Slide content */}
      <div className={`reveal-content ${active && !exiting ? 'reveal-enter' : ''} ${exiting ? 'reveal-exit' : ''}`}>
        {slides[slideIndex].render(active)}
      </div>

      {/* Progress dots */}
      <div className="absolute bottom-8 flex gap-2">
        {slides.map((s, i) => (
          <div
            key={s.key}
            className={`h-1 transition-all duration-300 ${
              i === slideIndex ? 'bg-white w-6' : i < slideIndex ? 'bg-gray-500 w-2' : 'bg-gray-700 w-2'
            }`}
          />
        ))}
      </div>

      {/* Skip hint */}
      <p className="absolute bottom-16 text-xs text-gray-600">
        tap to continue
      </p>
    </div>
  )
}
