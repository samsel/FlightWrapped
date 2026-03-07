import { useState, useRef, useCallback } from 'react'
import { toPng } from 'html-to-image'
import type { FlightStats, FunStats, Archetype, Flight } from '@/lib/types'
import ShareCard from './ShareCard'

interface Props {
  stats: FlightStats
  funStats: FunStats
  archetype: Archetype
  flights: Flight[]
}

type Status = 'idle' | 'generating' | 'ready' | 'error'

export default function ShareButton({ stats, funStats, archetype, flights }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const generate = useCallback(async () => {
    if (!cardRef.current) return
    setStatus('generating')
    try {
      const url = await toPng(cardRef.current, {
        width: 1200,
        height: 630,
        pixelRatio: 2,
      })
      setImageUrl(url)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  const close = useCallback(() => {
    setStatus('idle')
    setImageUrl(null)
  }, [])

  return (
    <>
      <ShareCard
        ref={cardRef}
        stats={stats}
        funStats={funStats}
        archetype={archetype}
        flights={flights}
      />

      <button
        onClick={generate}
        disabled={status === 'generating'}
        className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 px-3 py-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4"
        >
          <path d="M13.75 7h-3V3.66l1.95 2.1a.75.75 0 1 0 1.1-1.02l-3.25-3.5a.75.75 0 0 0-1.1 0L6.2 4.74a.75.75 0 0 0 1.1 1.02l1.95-2.1V7h-3A2.25 2.25 0 0 0 4 9.25v7.5A2.25 2.25 0 0 0 6.25 19h7.5A2.25 2.25 0 0 0 16 16.75v-7.5A2.25 2.25 0 0 0 13.75 7Z" />
        </svg>
        {status === 'generating' ? 'Generating…' : 'Share'}
      </button>

      {/* Modal */}
      {(status === 'ready' || status === 'error') && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={close}
        >
          <div
            className="bg-gray-900 rounded-xl border border-gray-700 max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Your Flight Stats</h2>
              <button onClick={close} className="text-gray-400 hover:text-white text-xl leading-none p-2">
                &times;
              </button>
            </div>

            {status === 'error' && (
              <div className="text-red-400 text-sm">
                Failed to generate image.{' '}
                <button onClick={generate} className="underline hover:text-red-300">
                  Try again.
                </button>
              </div>
            )}

            {status === 'ready' && imageUrl && (
              <>
                <img
                  src={imageUrl}
                  alt="MyFlights stats card"
                  className="w-full rounded-lg border border-gray-700"
                />
                <a
                  href={imageUrl}
                  download="myflights.png"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                    <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                  </svg>
                  Download PNG
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
