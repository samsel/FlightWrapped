import { useState, useRef, useCallback } from 'react'
import type { Insight } from '@/lib/types'

interface Props {
  insights: Insight[]
}

export default function InsightsRow({ insights }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollPos, setScrollPos] = useState<'start' | 'middle' | 'end'>('start')

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    if (scrollLeft <= 4) {
      setScrollPos('start')
    } else if (scrollLeft + clientWidth >= scrollWidth - 4) {
      setScrollPos('end')
    } else {
      setScrollPos('middle')
    }
  }, [])

  if (insights.length === 0) return null

  const showFades = insights.length > 3

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Your Travel Insights</h2>
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
        >
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="flex-shrink-0 w-64 bg-gray-900 border border-gray-800 p-4 snap-start hover:border-gray-700 transition-colors"
            >
              <p className="font-medium">{insight.title}</p>
              <p className="text-sm text-gray-400 mt-1">{insight.description}</p>
            </div>
          ))}
        </div>
        {showFades && scrollPos !== 'end' && (
          <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-gray-950 to-transparent pointer-events-none" />
        )}
        {showFades && scrollPos !== 'start' && (
          <div className="absolute left-0 top-0 bottom-2 w-12 bg-gradient-to-r from-gray-950 to-transparent pointer-events-none" />
        )}
      </div>
    </div>
  )
}
