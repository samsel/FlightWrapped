import type { ParseProgress } from '@/lib/types'

interface ParsingProgressProps {
  progress: ParseProgress
  onReset?: () => void
}

const PHASES = ['loading-model', 'scanning', 'extracting', 'deduplicating'] as const

const phaseLabels: Record<ParseProgress['phase'], string> = {
  'loading-model': 'Loading AI model',
  scanning: 'Scanning emails',
  extracting: 'Extracting flight data',
  deduplicating: 'Deduplicating flights',
  done: 'Complete',
  error: 'Error',
}

function StepIndicator({ phase }: { phase: ParseProgress['phase'] }) {
  if (phase === 'done' || phase === 'error') return null

  const currentIndex = PHASES.indexOf(phase as typeof PHASES[number])

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {PHASES.map((p, i) => {
        const isActive = i === currentIndex
        const isComplete = i < currentIndex

        return (
          <div key={p} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                isComplete
                  ? 'bg-blue-500 text-white'
                  : isActive
                  ? 'bg-blue-500/20 text-blue-400 border-2 border-blue-500'
                  : 'bg-gray-800 text-gray-600 border border-gray-700'
              }`}
            >
              {isComplete ? (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              ) : (
                i + 1
              )}
            </div>
            {i < PHASES.length - 1 && (
              <div className={`w-6 h-px transition-colors duration-300 ${i < currentIndex ? 'bg-blue-500' : 'bg-gray-700'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function ParsingProgress({ progress, onReset }: ParsingProgressProps) {
  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  const isIndeterminate = progress.total === 0 && progress.phase !== 'done' && progress.phase !== 'error'
  const isStuck = progress.phase === 'done' && progress.flightsFound === 0
  const isProcessing = progress.phase !== 'done' && progress.phase !== 'error'

  return (
    <div className="w-full max-w-md mx-auto">
      <StepIndicator phase={progress.phase} />

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

      <div className="w-full bg-gray-800 h-2.5 overflow-hidden">
        {isIndeterminate ? (
          <div className="h-full w-full bg-blue-500 animate-pulse-bar" />
        ) : (
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        )}
      </div>

      {!isIndeterminate && (
        <p className="text-xs text-gray-500 text-center mt-2">{percent}%</p>
      )}

      {/* Flights found counter */}
      {isProcessing && progress.flightsFound > 0 && (
        <div className="mt-4 text-center">
          <span className="inline-flex items-center gap-1.5 text-sm text-blue-300 bg-blue-500/10 border border-blue-500/20 px-4 py-1.5">
            <span className="font-bold">{progress.flightsFound}</span> flights found so far
          </span>
        </div>
      )}

      {/* Cancel / retry button */}
      {isProcessing && onReset && (
        <div className="text-center mt-6">
          <button
            onClick={onReset}
            className="text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 bg-gray-800/50 hover:bg-gray-800 px-5 py-2.5 transition-all"
          >
            Cancel
          </button>
        </div>
      )}

      {(isStuck || progress.phase === 'error') && onReset && (
        <div className="text-center mt-6">
          <button
            onClick={onReset}
            className="text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-5 py-3 transition-colors border border-gray-700"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
