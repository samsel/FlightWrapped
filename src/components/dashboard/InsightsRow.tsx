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
      <div className="flex gap-3 overflow-x-auto pb-2">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="flex-shrink-0 w-64 bg-gray-900 rounded-xl border border-gray-800 p-4"
          >
            <span className="text-2xl">{getIcon(insight.icon)}</span>
            <p className="font-medium mt-2">{insight.title}</p>
            <p className="text-sm text-gray-400 mt-1">{insight.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
