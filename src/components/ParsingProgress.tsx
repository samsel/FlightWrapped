import type { ParseProgress } from '@/lib/types'

interface ParsingProgressProps {
  progress: ParseProgress
  onReset?: () => void
}

const phaseLabels: Record<ParseProgress['phase'], string> = {
  'loading-model': 'Loading AI model',
  scanning: 'Scanning emails',
  extracting: 'Extracting flight data',
  deduplicating: 'Deduplicating flights',
  done: 'Complete',
  error: 'Error',
}

export default function ParsingProgress({ progress, onReset }: ParsingProgressProps) {
  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  const isIndeterminate = progress.total === 0 && progress.phase !== 'done' && progress.phase !== 'error'
  const isStuck = progress.phase === 'done' && progress.flightsFound === 0

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-4 text-center">
        <p className="text-lg font-medium text-gray-200">
          {phaseLabels[progress.phase]}
        </p>
        <p className="text-sm text-gray-400 mt-1">
          {progress.phase === 'done' ? (
            progress.flightsFound > 0
              ? `Found ${progress.flightsFound.toLocaleString()} flights`
              : (progress.message ?? 'No flights found')
          ) : progress.phase === 'error' ? (
            progress.message ?? 'An error occurred'
          ) : progress.phase === 'loading-model' ? (
            progress.message ?? 'Downloading model (cached after first use)...'
          ) : progress.message ? (
            <>
              {progress.message}
              {progress.flightsFound > 0 && (
                <span className="ml-2 text-blue-400">
                  ({progress.flightsFound} flights found)
                </span>
              )}
            </>
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
        {isIndeterminate ? (
          <div className="h-full w-full bg-blue-500 rounded-full animate-pulse-bar" />
        ) : (
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        )}
      </div>

      {!isIndeterminate && (
        <p className="text-xs text-gray-500 text-center mt-2">{percent}%</p>
      )}

      {(isStuck || progress.phase === 'error') && onReset && (
        <div className="text-center mt-6">
          <button
            onClick={onReset}
            className="text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-5 py-3 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
