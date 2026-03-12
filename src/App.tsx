import { useState, useEffect, useCallback, useRef, useMemo, type MutableRefObject } from 'react'
import InputScreen from '@/components/InputScreen'
import ParsingProgress from '@/components/ParsingProgress'
import ProfilerOverlay from '@/components/ProfilerOverlay'
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
import type { ProfilerReport } from '@/lib/profiler'

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
  const [profilerEnabled, setProfilerEnabled] = useState(false)
  const [profilerReport, setProfilerReport] = useState<ProfilerReport | null>(null)
  const [profilerPanelOpen, setProfilerPanelOpen] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const generationRef = useRef(0) as MutableRefObject<number>
  const profilerEnabledRef = useRef(false)
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
        case 'profiler-report':
          setProfilerReport(msg.data)
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

    workerRef.current = worker
    worker.postMessage({ type: 'set-profiler', data: profilerEnabledRef.current })
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

  const handleProfilerToggle = useCallback(() => {
    const next = !profilerEnabledRef.current
    profilerEnabledRef.current = next
    setProfilerEnabled(next)
    if (!next) setProfilerReport(null)
    workerRef.current?.postMessage({ type: 'set-profiler', data: next })
  }, [])

  const handleFileUpload = useCallback((files: File[]) => {
    setAppState('parsing')
    setError(null)
    setProfilerReport(null)
    setProgress({ phase: 'scanning', current: 0, total: 0, flightsFound: 0, message: 'Preparing files...' })

    // Preserve existing flights for merge
    if (cachedData) {
      existingFlightsRef.current = cachedData.flights
    }

    navigator.storage?.persist?.().then((granted) => {
      if (!granted) console.warn('Durable storage not granted. Model cache may be evicted')
    })

    // Ensure worker has latest profiler state
    workerRef.current?.postMessage({ type: 'set-profiler', data: profilerEnabledRef.current })
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

  const topNav = (
    <div className="fixed top-5 right-5 z-[9999] flex items-center gap-1">
      {/* Profiler toggle */}
      <button
        onClick={() => {
          if (!profilerEnabled) {
            handleProfilerToggle()
          } else {
            setProfilerPanelOpen(!profilerPanelOpen)
          }
        }}
        className={`relative p-2 transition-colors duration-200 ${
          profilerEnabled
            ? 'text-green-400 hover:text-green-300'
            : 'text-gray-500 hover:text-white'
        }`}
        title={profilerEnabled
          ? profilerReport
            ? `Pipeline profiler — click to ${profilerPanelOpen ? 'close' : 'open'} details`
            : 'Profiler on — process a file to see timings'
          : 'Enable pipeline profiler — measures timing for each processing step'
        }
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2 2" />
          <path d="M10 2h4" />
          <path d="M12 2v2" />
        </svg>
        {profilerEnabled && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full" />
        )}
      </button>
      {/* Blog post */}
      <a
        href="https://samselvanathan.com/posts/flightwrapped-on-device-ai-flight-visualizer"
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 text-gray-500 hover:text-white transition-colors duration-200"
        aria-label="Read the blog post"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20" />
        </svg>
      </a>
      {/* GitHub */}
      <a
        href="https://github.com/samsel/FlightWrapped"
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 text-gray-500 hover:text-white transition-colors duration-200"
        aria-label="View source on GitHub"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
      </a>
    </div>
  )

  const profilerPanel = (
    <ProfilerOverlay
      enabled={profilerEnabled}
      onToggle={handleProfilerToggle}
      report={profilerReport}
      panelOpen={profilerPanelOpen}
      onPanelToggle={() => setProfilerPanelOpen(false)}
    />
  )

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
        {topNav}
        {profilerPanel}
      </div>
    )
  }

  if (appState === 'parsing') {
    return (
      <div className="min-h-screen glass-bg text-white flex flex-col items-center justify-center px-4 animate-fade-in">
        <h1 className="text-3xl font-bold mb-8">FlightWrapped</h1>
        <ParsingProgress progress={progress} onReset={resetToLanding} />
        {topNav}
        {profilerPanel}
      </div>
    )
  }

  if (appState === 'reveal') {
    return (
      <>
        <RevealSequence
          stats={stats}
          funStats={funStats}
          archetype={archetype}
          onComplete={() => setAppState('results')}
        />
        {topNav}
        {profilerPanel}
      </>
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
      {topNav}
      {profilerPanel}
    </ErrorBoundary>
  )
}

export default App
