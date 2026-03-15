import type { ParseProgress } from '@/lib/types'

interface ParsingProgressProps {
  progress: ParseProgress
  onReset?: () => void
}

const PHASES = ['loading-model', 'scanning', 'extracting', 'deduplicating'] as const

const STEP_LABELS: Record<typeof PHASES[number], string> = {
  'loading-model': 'Load model',
  scanning: 'Scan',
  extracting: 'Extract',
  deduplicating: 'Dedup',
}

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
    <div className="flex items-center justify-center gap-1 mb-6">
      {PHASES.map((p, i) => {
        const isActive = i === currentIndex
        const isComplete = i < currentIndex

        return (
          <div key={p} className="flex items-center gap-1">
            <div className="flex items-center gap-1.5">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                  isComplete
                    ? 'bg-[#2D5A27] text-white'
                    : isActive
                    ? 'bg-[#E8F0E4] text-[#2D5A27] border-2 border-[#2D5A27]'
                    : 'bg-[#E5E0D5] text-[#9A9690] border border-[#D5D0C8]'
                }`}
              >
                {isComplete && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                )}
              </div>
              <span
                className={`text-xs font-medium transition-colors duration-300 ${
                  isComplete
                    ? 'text-[#2D5A27]'
                    : isActive
                    ? 'text-[#1A1A1A]'
                    : 'text-[#9A9690]'
                }`}
              >
                {STEP_LABELS[p]}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div className={`w-5 h-px mx-1 transition-colors duration-300 ${i < currentIndex ? 'bg-[#2D5A27]' : 'bg-[#E5E0D5]'}`} />
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
        <p className="text-lg font-medium text-[#1A1A1A]">
          {phaseLabels[progress.phase]}
        </p>
        <p className="text-sm text-[#6B6960] mt-1">
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
                <span className="ml-2 text-[#2D5A27]">
                  ({progress.flightsFound} flights found)
                </span>
              )}
            </>
          ) : (
            <>
              {progress.current.toLocaleString()} of {progress.total.toLocaleString()} emails
              {progress.flightsFound > 0 && (
                <span className="ml-2 text-[#2D5A27]">
                  ({progress.flightsFound} flights found)
                </span>
              )}
            </>
          )}
        </p>
      </div>

      <div className="w-full bg-[#E5E0D5] h-2.5 overflow-hidden rounded-full">
        {isIndeterminate ? (
          <div className="h-full w-full bg-[#2D5A27] animate-pulse-bar rounded-full" />
        ) : (
          <div
            className="h-full bg-gradient-to-r from-[#2D5A27] to-[#4A8B42] transition-all duration-300 rounded-full"
            style={{ width: `${percent}%` }}
          />
        )}
      </div>

      {!isIndeterminate && (
        <p className="text-xs text-[#9A9690] text-center mt-2">{percent}%</p>
      )}

      {/* Flights found counter */}
      {isProcessing && progress.flightsFound > 0 && (
        <div className="mt-4 text-center">
          <span className="inline-flex items-center gap-1.5 text-sm text-[#2D5A27] bg-[#E8F0E4] border border-[#C8DCC2] px-4 py-1.5 rounded-full">
            <span className="font-bold">{progress.flightsFound}</span> flights found so far
          </span>
        </div>
      )}

      {/* Cancel / retry button */}
      {isProcessing && onReset && (
        <div className="text-center mt-6">
          <button
            onClick={onReset}
            className="text-sm text-[#6B6960] hover:text-[#1A1A1A] border border-[#E5E0D5] hover:border-[#D5D0C8] bg-white hover:bg-[#F5F1EB] px-5 py-2.5 transition-all rounded-full"
          >
            Cancel
          </button>
        </div>
      )}

      {(isStuck || progress.phase === 'error') && onReset && (
        <div className="text-center mt-6">
          <button
            onClick={onReset}
            className="text-sm bg-[#2D5A27] hover:bg-[#3A7233] text-white px-5 py-3 transition-colors rounded-full"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
