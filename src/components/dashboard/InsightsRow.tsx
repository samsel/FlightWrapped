import type { Insight } from '@/lib/types'
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
              className="flex-shrink-0 w-64 glass-card p-4 snap-start"
            >
              <p className="font-medium">{insight.title}</p>
              <p className="text-sm text-gray-400 mt-1">{insight.description}</p>
            </div>
          ))}
        </div>
        {insights.length > 3 && (
          <div className="absolute right-0 top-0 bottom-2 w-12 pointer-events-none" style={{ background: 'linear-gradient(to left, rgba(3,7,18,0.9), transparent)' }} />
        )}
      </div>
    </div>
  )
}
