import type { Insight } from '@/lib/types'
import { getIcon } from '@/lib/icons'

interface Props {
  insights: Insight[]
}

export default function InsightsRow({ insights }: Props) {
  if (insights.length === 0) return null

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Your Travel Insights</h2>
      <div className="relative">
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="flex-shrink-0 w-64 bg-gray-900 rounded-xl border border-gray-800 p-4 snap-start"
            >
              <span className="text-2xl">{getIcon(insight.icon)}</span>
              <p className="font-medium mt-2">{insight.title}</p>
              <p className="text-sm text-gray-400 mt-1">{insight.description}</p>
            </div>
          ))}
        </div>
        {insights.length > 3 && (
          <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-gray-950 to-transparent pointer-events-none" />
        )}
      </div>
    </div>
  )
}
