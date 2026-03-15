import HeroSection from './landing/HeroSection'
import type { SyncData } from '@/lib/storage'

interface InputScreenProps {
  onError: (message: string) => void
  onDemoClick: () => void
  onFileUpload: (files: File[]) => void
  cachedData: SyncData | null
  onViewCached: () => void
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

export default function InputScreen({ onError, onDemoClick, onFileUpload, cachedData, onViewCached }: InputScreenProps) {
  return (
    <div className="min-h-screen glass-bg text-[#1A1A1A]">
      {cachedData && cachedData.flights.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 glass-header">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-[#6B6960]">
                {cachedData.flights.length} flights saved
                {cachedData.lastImportAt && <> &middot; imported {formatTimeAgo(cachedData.lastImportAt)}</>}
              </span>
            </div>
            <button
              onClick={onViewCached}
              className="text-sm font-medium text-[#2D5A27] hover:text-[#1B3409] transition-colors px-4 py-1.5 bg-[#E8F0E4] hover:bg-[#D8E8D2] rounded-full"
            >
              View Dashboard
            </button>
          </div>
        </div>
      )}
      <HeroSection onError={onError} onDemoClick={onDemoClick} onFileUpload={onFileUpload} />
    </div>
  )
}
