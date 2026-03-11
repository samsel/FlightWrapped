import { useState, useEffect, useCallback, useRef, useMemo, type MutableRefObject } from 'react'
import InputScreen from '@/components/InputScreen'
import ParsingProgress from '@/components/ParsingProgress'
import { calculateStats } from '@/lib/stats'
import { calculateFunStats } from '@/lib/funStats'
import { generateInsights } from '@/lib/insights'
import { determineArchetype } from '@/lib/archetypes'
import { loadCachedData, saveSyncData, clearAllData, type SyncData } from '@/lib/storage'
import { deduplicateFlights } from '@/worker/dedup'
import Dashboard from '@/components/dashboard/Dashboard'
import RevealSequence from '@/components/dashboard/RevealSequence'
import ErrorBoundary from '@/components/ErrorBoundary'
import { DEMO_FLIGHTS } from '@/components/landing/demoFlights'
import type { Flight, ParseProgress, WorkerOutMessage } from '@/lib/types'

type AppState = 'landing' | 'parsing' | 'reveal' | 'results'

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
  const [cachedData, setCachedData] = useState<SyncData | null>(null)
  const [lastImportAt, setLastImportAt] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const generationRef = useRef(0) as MutableRefObject<number>
  // Existing flights for merging with new imports
  const existingFlightsRef = useRef<Flight[]>([])

  // Create a worker and wire up its message handler
  const createWorker = useCallback(() => {
    const worker = new Worker(new URL('./worker/parser.worker.ts', import.meta.url), {
      type: 'module',
    })
    const gen = generationRef.current

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      if (generationRef.current !== gen) return
      const msg = e.data
      switch (msg.type) {
        case 'progress':
          setProgress(msg.data)
          break
        case 'result': {
          // Merge new flights with any existing cached flights, then dedup
          const merged = deduplicateFlights([
            ...existingFlightsRef.current,
            ...msg.data,
          ])
          setFlights(merged)
          // Persist to IndexedDB
          saveSyncData({
            flights: merged,
            lastImportAt: new Date().toISOString(),
          }).then(() => {
            setLastImportAt(new Date().toISOString())
          })
          setAppState(merged.length > 0 ? 'reveal' : 'results')
          break
        }
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

    workerRef.current = worker
    worker.postMessage({ type: 'init-llm' })
    return worker
  }, [])

  // Load cached data + initialize worker on mount
  useEffect(() => {
    loadCachedData().then((cached) => {
      if (cached && cached.flights.length > 0) {
        setCachedData(cached)
        setLastImportAt(cached.lastImportAt)
      }
    })
    createWorker()
    return () => workerRef.current?.terminate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileUpload = useCallback((files: File[]) => {
    setAppState('parsing')
    setError(null)
    setProgress({ phase: 'scanning', current: 0, total: 0, flightsFound: 0, message: 'Preparing files...' })

    // Preserve existing flights for merge
    if (cachedData) {
      existingFlightsRef.current = cachedData.flights
    }

    navigator.storage?.persist?.().then((granted) => {
      if (!granted) console.warn('Durable storage not granted. Model cache may be evicted')
    })

    // Send File objects directly to worker (structured-cloneable)
    // No FileReader needed -- the worker streams them with File.stream()
    workerRef.current?.postMessage({ type: 'parse-mbox-files', data: files })
  }, [cachedData])

  const handleDemoClick = useCallback(() => {
    setFlights(DEMO_FLIGHTS)
    setAppState('results')
  }, [])

  const handleViewCached = useCallback(() => {
    if (cachedData) {
      setFlights(cachedData.flights)
      setLastImportAt(cachedData.lastImportAt)
      setAppState('results')
    }
  }, [cachedData])

  const handleError = useCallback((message: string) => {
    setError(message)
  }, [])

  const stats = useMemo(() => calculateStats(flights), [flights])
  const funStats = useMemo(() => calculateFunStats(stats), [stats])
  const insights = useMemo(() => generateInsights(flights, stats), [flights, stats])
  const archetype = useMemo(() => determineArchetype(flights, stats), [flights, stats])

  const resetToLanding = useCallback(async () => {
    generationRef.current++
    workerRef.current?.terminate()
    createWorker()
    await clearAllData()
    setCachedData(null)
    setLastImportAt(null)
    setAppState('landing')
    setFlights([])
    setError(null)
    setProgress({ phase: 'scanning', current: 0, total: 0, flightsFound: 0 })
    existingFlightsRef.current = []
  }, [createWorker])

  if (appState === 'landing') {
    return (
      <div className="animate-fade-in">
        <InputScreen
          onError={handleError}
          onDemoClick={handleDemoClick}
          onFileUpload={handleFileUpload}
          cachedData={cachedData}
          onViewCached={handleViewCached}
        />
        {error && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-900/90 text-red-200 px-6 py-3 max-w-[90vw] text-sm z-50">
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
      <div className="min-h-screen glass-bg text-white flex flex-col items-center justify-center px-4 animate-fade-in">
        <h1 className="text-3xl font-bold mb-8">FlightWrapped</h1>
        <ParsingProgress progress={progress} onReset={resetToLanding} />
      </div>
    )
  }

  if (appState === 'reveal') {
    return (
      <RevealSequence
        stats={stats}
        funStats={funStats}
        archetype={archetype}
        onComplete={() => setAppState('results')}
      />
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
          lastSyncAt={lastImportAt}
          onFileUpload={handleFileUpload}
        />
      </div>
    </ErrorBoundary>
  )
}

export default App
