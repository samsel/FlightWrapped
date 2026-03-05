import type { ParseProgress } from '@/lib/types'

interface ParsingProgressProps {
  progress: ParseProgress
}

const phaseLabels: Record<ParseProgress['phase'], string> = {
  'loading-model': 'Loading AI model',
  scanning: 'Scanning emails',
  extracting: 'Extracting flight data',
  deduplicating: 'Deduplicating flights',
  done: 'Complete',
  error: 'Error',
}

export default function ParsingProgress({ progress }: ParsingProgressProps) {
  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-4 text-center">
        <p className="text-lg font-medium text-gray-200">
          {phaseLabels[progress.phase]}
        </p>
        <p className="text-sm text-gray-400 mt-1">
          {progress.phase === 'done' ? (
            `Found ${progress.flightsFound.toLocaleString()} flights`
          ) : progress.phase === 'error' ? (
            progress.message ?? 'An error occurred'
          ) : progress.phase === 'loading-model' ? (
            progress.message ?? 'Downloading model (cached after first use)...'
          ) : (
            <>
              {progress.current.toLocaleString()} of {progress.total.toLocaleString()} emails
              {progress.flightsFound > 0 && (
                <span className="ml-2 text-blue-400">
                  ({progress.flightsFound} flights found)
                </span>
              )}
            </>
          )}
        </p>
      </div>

      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="text-xs text-gray-500 text-center mt-2">{percent}%</p>
    </div>
  )
}
