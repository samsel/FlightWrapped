import { useState, useEffect, useCallback, useRef, useMemo, type MutableRefObject } from 'react'
import InputScreen from '@/components/InputScreen'
import ParsingProgress from '@/components/ParsingProgress'
import { getCallbackCode, clearCallbackParams, handleCallback, searchFlightEmails, batchFetchMessages, configureGmail, type RateLimitInfo } from '@/lib/gmail'
import { calculateStats } from '@/lib/stats'
import { calculateFunStats } from '@/lib/funStats'
import { generateInsights } from '@/lib/insights'
import { determineArchetype } from '@/lib/archetypes'
import Dashboard from '@/components/dashboard/Dashboard'
import ErrorBoundary from '@/components/ErrorBoundary'
import { DEMO_FLIGHTS } from '@/components/landing/demoFlights'
import type { Flight, ParseProgress, WorkerOutMessage } from '@/lib/types'

type AppState = 'landing' | 'parsing' | 'results'

// Configure Gmail OAuth — replace with your own client ID for production
const GMAIL_CLIENT_ID = import.meta.env.VITE_GMAIL_CLIENT_ID ?? ''
const GMAIL_REDIRECT_URI = import.meta.env.VITE_GMAIL_REDIRECT_URI ?? window.location.origin

configureGmail({ clientId: GMAIL_CLIENT_ID, redirectUri: GMAIL_REDIRECT_URI })

function App() {
  const [appState, setAppState] = useState<AppState>('landing')
  const [progress, setProgress] = useState<ParseProgress>({
    phase: 'scanning',
    current: 0,
    total: 0,
    flightsFound: 0,
  })
  const [flights, setFlights] = useState<Flight[]>([])
  const [error, setError] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const generationRef = useRef(0) as MutableRefObject<number>
  const processingRef = useRef(false) as MutableRefObject<boolean>

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(new URL('./worker/parser.worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker
    // Pre-warm LLM model so download starts while emails are being fetched
    worker.postMessage({ type: 'init-llm' })
    const gen = generationRef.current

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      // Ignore messages from stale worker generations (e.g. after reset)
      if (generationRef.current !== gen) return

      const msg = e.data
      switch (msg.type) {
        case 'progress':
          setProgress(msg.data)
          break
        case 'result':
          setFlights(msg.data)
          setAppState('results')
          break
        case 'error':
          setError(msg.data.message)
          setProgress((p) => ({ ...p, phase: 'error', message: msg.data.message }))
          break
      }
    }

    worker.onerror = (e) => {
      if (generationRef.current !== gen) return
      setError(`Worker failed: ${e.message}`)
      setAppState('landing')
    }

    return () => worker.terminate()
  }, [])

  // Handle Gmail OAuth callback
  useEffect(() => {
    const result = getCallbackCode()
    if (result) {
      // Guard against double invocation (StrictMode, back button)
      if (processingRef.current) return
      processingRef.current = true
      clearCallbackParams()
      handleGmailCallback(result.code, result.state)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGmailCallback = async (code: string, state: string | null) => {
    try {
      setAppState('parsing')
      // Request durable storage now that user has initiated the flow
      navigator.storage?.persist?.()
      setProgress({ phase: 'scanning', current: 0, total: 0, flightsFound: 0, message: 'Exchanging auth code...' })

      const token = await handleCallback(code, state)

      const handleRateLimit = (info: RateLimitInfo) => {
        setProgress((p) => ({ ...p, message: `Rate limited by Gmail — retrying in ${info.retryAfter}s...` }))
      }

      setProgress({ phase: 'scanning', current: 0, total: 0, flightsFound: 0, message: 'Searching for flight emails...' })
      const messageIds = await searchFlightEmails(token, (fetched) => {
        setProgress((p) => ({ ...p, current: fetched, message: `Found ${fetched} potential flight emails...` }))
      }, handleRateLimit)

      if (messageIds.length === 0) {
        setError('No flight-related emails found in your inbox.')
        setAppState('landing')
        return
      }

      setProgress({ phase: 'scanning', current: 0, total: messageIds.length, flightsFound: 0, message: 'Fetching emails...' })
      const rawEmails = await batchFetchMessages(messageIds, token, (fetched, total) => {
        setProgress({ phase: 'scanning', current: fetched, total, flightsFound: 0, message: `Fetching email ${fetched.toLocaleString()} of ${total.toLocaleString()}...` })
      }, handleRateLimit)

      // Send raw emails to worker — normalization + extraction happen off main thread
      const buffers = rawEmails.map((e) => e.raw).filter((r): r is ArrayBuffer => r instanceof ArrayBuffer)
      workerRef.current?.postMessage(
        { type: 'parse-raw-emails', data: rawEmails },
        buffers, // transfer ArrayBuffers for zero-copy
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gmail auth failed')
      setAppState('landing')
    }
  }

  const handleDemoClick = useCallback(() => {
    setFlights(DEMO_FLIGHTS)
    setAppState('results')
  }, [])

  const handleError = useCallback((message: string) => {
    setError(message)
  }, [])

  const stats = useMemo(() => calculateStats(flights), [flights])
  const funStats = useMemo(() => calculateFunStats(stats), [stats])
  const insights = useMemo(() => generateInsights(flights, stats), [flights, stats])
  const archetype = useMemo(() => determineArchetype(flights, stats), [flights, stats])

  const resetToLanding = useCallback(() => {
    // Bump generation so in-flight worker messages are ignored
    generationRef.current++
    processingRef.current = false
    // Terminate the running worker to stop any in-progress processing
    workerRef.current?.terminate()
    // Create a fresh worker
    const worker = new Worker(new URL('./worker/parser.worker.ts', import.meta.url), {
      type: 'module',
    })
    const gen = generationRef.current
    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      if (generationRef.current !== gen) return
      const msg = e.data
      switch (msg.type) {
        case 'progress': setProgress(msg.data); break
        case 'result': setFlights(msg.data); setAppState('results'); break
        case 'error': setError(msg.data.message); setProgress((p) => ({ ...p, phase: 'error', message: msg.data.message })); break
      }
    }
    worker.onerror = (e) => {
      if (generationRef.current !== gen) return
      setError(`Worker failed: ${e.message}`)
      setAppState('landing')
    }
    workerRef.current = worker

    setAppState('landing')
    setFlights([])
    setError(null)
    setProgress({ phase: 'scanning', current: 0, total: 0, flightsFound: 0 })
  }, [])

  if (appState === 'landing') {
    return (
      <div className="animate-fade-in">
        <InputScreen onError={handleError} onDemoClick={handleDemoClick} />
        {error && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-900/90 text-red-200 px-6 py-3 rounded-lg shadow-lg max-w-[90vw] text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-300">
              Dismiss
            </button>
          </div>
        )}
      </div>
    )
  }

  if (appState === 'parsing') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4 animate-fade-in">
        <h1 className="text-3xl font-bold mb-8">MyFlights</h1>
        <ParsingProgress progress={progress} onReset={resetToLanding} />
      </div>
    )
  }

  return (
    <ErrorBoundary onReset={resetToLanding}>
      <div className="animate-fade-in">
        <Dashboard
          flights={flights}
          stats={stats}
          funStats={funStats}
          insights={insights}
          archetype={archetype}
          onReset={resetToLanding}
        />
      </div>
    </ErrorBoundary>
  )
}

export default App
