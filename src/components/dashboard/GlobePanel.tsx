import { useRef, useState, useEffect, useMemo, Suspense, lazy } from 'react'
import { lookupAirport } from '@/lib/airports'
import type { Flight } from '@/lib/types'

const GlobeInner = lazy(() => import('./GlobeInner'))

interface Props {
  flights: Flight[]
}

export default function GlobePanel({ flights }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let timeout: ReturnType<typeof setTimeout>
    const observer = new ResizeObserver(([entry]) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        const { width } = entry.contentRect
        setDimensions({ width, height: Math.min(width < 640 ? width * 0.85 : width * 0.65, 600) })
      }, 150)
    })

    observer.observe(el)
    return () => { clearTimeout(timeout); observer.disconnect() }
  }, [])

  const { arcsData, pointsData } = useMemo(() => {
    const seenRoutes = new Set<string>()
    const seenAirports = new Set<string>()
    const arcs: { startLat: number; startLng: number; endLat: number; endLng: number }[] = []
    const points: { lat: number; lng: number; label: string }[] = []

    for (const f of flights) {
      const orig = lookupAirport(f.origin)
      const dest = lookupAirport(f.destination)
      if (!orig || !dest) continue

      const rk = [f.origin, f.destination].sort().join('-')
      if (!seenRoutes.has(rk)) {
        seenRoutes.add(rk)
        arcs.push({ startLat: orig.lat, startLng: orig.lng, endLat: dest.lat, endLng: dest.lng })
      }

      for (const ap of [orig, dest]) {
        if (!seenAirports.has(ap.iata)) {
          seenAirports.add(ap.iata)
          points.push({ lat: ap.lat, lng: ap.lng, label: `${ap.iata} · ${ap.city}` })
        }
      }
    }

    return { arcsData: arcs, pointsData: points }
  }, [flights])

  return (
    <div ref={containerRef} className="w-full flex justify-center bg-gray-950 overflow-hidden" aria-hidden="true">
      {dimensions ? (
        <Suspense
          fallback={
            <div
              className="bg-gray-900 animate-pulse rounded-full"
              style={{ width: dimensions.height, height: dimensions.height }}
            />
          }
        >
          <GlobeInner
            width={dimensions.width}
            height={dimensions.height}
            arcsData={arcsData}
            pointsData={pointsData}
          />
        </Suspense>
      ) : (
        <div className="bg-gray-900 animate-pulse rounded-full" style={{ width: 300, height: 300 }} />
      )}
    </div>
  )
}
