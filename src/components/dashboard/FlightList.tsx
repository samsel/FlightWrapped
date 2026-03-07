import { useState, useMemo } from 'react'
import { lookupAirport } from '@/lib/airports'
import type { Flight } from '@/lib/types'

interface Props {
  flights: Flight[]
}

type SortKey = 'date' | 'origin' | 'destination' | 'airline'
type SortDir = 'asc' | 'desc'

function airportLabel(code: string): string {
  const ap = lookupAirport(code)
  return ap ? `${code} · ${ap.city}` : code
}

function confidenceBadge(confidence: number) {
  if (confidence >= 0.8) {
    return <span className="rounded-full text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400">High</span>
  }
  if (confidence >= 0.5) {
    return <span className="rounded-full text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400">Medium</span>
  }
  return <span className="rounded-full text-xs px-2 py-0.5 bg-red-500/20 text-red-400">Low</span>
}

export default function FlightList({ flights }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showCount, setShowCount] = useState(50)

  const sorted = useMemo(() => {
    const arr = [...flights]
    arr.sort((a, b) => {
      const va = a[sortKey] ?? ''
      const vb = b[sortKey] ?? ''
      const cmp = va.localeCompare(vb)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [flights, sortKey, sortDir])

  const visible = sorted.slice(0, showCount)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'date' ? 'desc' : 'asc')
    }
  }

  const headerClass = 'text-left text-xs text-gray-400 font-medium px-3 py-2 cursor-pointer hover:text-gray-200 select-none'
  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '')

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">All Flights</h2>
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-900">
            <tr>
              <th className={headerClass} onClick={() => toggleSort('date')}>Date{arrow('date')}</th>
              <th className={headerClass} onClick={() => toggleSort('origin')}>Origin{arrow('origin')}</th>
              <th className={headerClass} onClick={() => toggleSort('destination')}>Destination{arrow('destination')}</th>
              <th className={headerClass} onClick={() => toggleSort('airline')}>Airline{arrow('airline')}</th>
              <th className="text-left text-xs text-gray-400 font-medium px-3 py-2">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {visible.map((f, i) => (
              <tr key={`${f.flightNumber}-${f.date}-${i}`} className="hover:bg-gray-900/50">
                <td className="px-3 py-2 whitespace-nowrap">{f.date}</td>
                <td className="px-3 py-2 whitespace-nowrap">{airportLabel(f.origin)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{airportLabel(f.destination)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-400">{f.airline || '—'}</td>
                <td className="px-3 py-2">{confidenceBadge(f.confidence)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCount < sorted.length && (
        <div className="text-center mt-3">
          <button
            onClick={() => setShowCount((c) => c + 50)}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Show more ({sorted.length - showCount} remaining)
          </button>
        </div>
      )}
    </div>
  )
}
