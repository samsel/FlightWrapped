import { useRef } from 'react'
import type { Archetype } from '@/lib/types'
import { getArchetypeColors } from '@/lib/archetypeColors'

interface Props {
  archetype: Archetype
  onReset: () => void
  lastSyncAt: string | null
  onFileUpload?: (files: File[]) => void
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function DashboardHeader({ archetype, onReset, lastSyncAt, onFileUpload }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <header className="sticky top-0 z-20 glass-header">
      <div className="max-w-6xl mx-auto pl-4 pr-48 py-3 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
        <span className="text-lg font-bold tracking-tight text-[#1A1A1A]" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>FlightWrapped</span>

        <span className={`${getArchetypeColors(archetype.id).bg} ${getArchetypeColors(archetype.id).text} px-4 py-1 text-sm font-medium rounded-full order-3 sm:order-none truncate max-w-[200px] sm:max-w-none`}>
          {archetype.name}
        </span>

        <div className="flex items-center gap-3">
          {lastSyncAt && (
            <span className="text-xs text-[#9A9690] hidden sm:inline">
              Imported {formatTimeAgo(lastSyncAt)}
            </span>
          )}
          {onFileUpload && (
            <>
              <button
                onClick={() => inputRef.current?.click()}
                className="text-sm text-[#2D5A27] hover:text-[#1B3409] transition-colors px-3 py-2"
                title="Import more flights from another .mbox file"
              >
                Import
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".mbox"
                multiple
                onChange={(e) => {
                  const files = e.target.files
                  if (files && files.length > 0) onFileUpload(Array.from(files))
                }}
                className="hidden"
              />
            </>
          )}
          <button
            onClick={onReset}
            className="text-sm text-[#6B6960] hover:text-[#1A1A1A] transition-colors px-3 py-2"
          >
            Start Over
          </button>
        </div>
      </div>
    </header>
  )
}
