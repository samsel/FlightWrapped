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
    return <span className="text-xs px-2 py-0.5 rounded-full bg-[#E8F0E4] text-[#2D5A27]">High</span>
  }
  if (confidence >= 0.5) {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-[#FFF3CD] text-[#8B6914]">Medium</span>
  }
  return <span className="text-xs px-2 py-0.5 rounded-full bg-[#FDDDD5] text-[#9B3A2A]">Low</span>
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

  const headerClass = 'text-left text-xs text-[#6B6960] font-medium px-3 py-3 cursor-pointer hover:text-[#1A1A1A] select-none'
  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '')

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-[#1A1A1A]" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>All Flights</h2>
        <span className="text-xs text-[#9A9690]">{sorted.length} total</span>
      </div>
      <div className="overflow-x-auto border border-[#E5E0D5] rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-[#F5F1EB]">
            <tr>
              <th className={headerClass} onClick={() => toggleSort('date')}>Date{arrow('date')}</th>
              <th className={headerClass} onClick={() => toggleSort('origin')}>Origin{arrow('origin')}</th>
              <th className={headerClass} onClick={() => toggleSort('destination')}>Destination{arrow('destination')}</th>
              <th className={headerClass} onClick={() => toggleSort('airline')}>Airline{arrow('airline')}</th>
              <th className="text-left text-xs text-[#6B6960] font-medium px-3 py-3">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E0D5]/60 bg-white">
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[#9A9690]">
                  No flights extracted
                </td>
              </tr>
            )}
            {visible.map((f, i) => (
              <tr key={`${f.flightNumber}-${f.date}-${i}`} className="hover:bg-[#F5F1EB]/60 transition-colors">
                <td className="px-3 py-2.5 whitespace-nowrap font-medium tabular-nums text-[#1A1A1A]">{f.date}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-[#1A1A1A]">{airportLabel(f.origin)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-[#1A1A1A]">{airportLabel(f.destination)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-[#6B6960]">{f.airline || '-'}</td>
                <td className="px-3 py-2.5">{confidenceBadge(f.confidence)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCount < sorted.length && (
        <div className="text-center mt-4">
          <button
            onClick={() => setShowCount((c) => c + 50)}
            className="text-sm text-[#2D5A27] hover:text-[#1B3409] px-5 py-2 border border-[#2D5A27]/20 hover:border-[#2D5A27]/40 hover:bg-[#E8F0E4] transition-all rounded-full"
          >
            Show more ({sorted.length - showCount} remaining)
          </button>
        </div>
      )}
    </div>
  )
}
