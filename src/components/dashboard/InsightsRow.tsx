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
      <h2 className="text-lg font-semibold mb-3 text-[#1A1A1A]" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>Your Travel Insights</h2>
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
        >
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="flex-shrink-0 w-64 bg-white border border-[#E5E0D5] p-4 rounded-lg snap-start hover:border-[#D5D0C8] transition-colors"
            >
              <p className="font-medium text-[#1A1A1A]">{insight.title}</p>
              <p className="text-sm text-[#6B6960] mt-1">{insight.description}</p>
            </div>
          ))}
        </div>
        {showFades && scrollPos !== 'end' && (
          <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-[#F5F1EB] to-transparent pointer-events-none" />
        )}
        {showFades && scrollPos !== 'start' && (
          <div className="absolute left-0 top-0 bottom-2 w-12 bg-gradient-to-r from-[#F5F1EB] to-transparent pointer-events-none" />
        )}
      </div>
    </div>
  )
}
