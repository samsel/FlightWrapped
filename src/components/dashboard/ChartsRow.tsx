import type { FlightStats, Flight } from '@/lib/types'
import TimelineChart from './TimelineChart'
import AirlineDonut from './AirlineDonut'

interface Props {
  stats: FlightStats
  flights: Flight[]
}

export default function ChartsRow({ stats, flights }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <TimelineChart flights={flights} />
      <AirlineDonut stats={stats} />
    </div>
  )
}
