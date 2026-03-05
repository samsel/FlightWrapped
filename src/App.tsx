import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import InputScreen from '@/components/InputScreen'
import ParsingProgress from '@/components/ParsingProgress'
import { getCallbackCode, clearCallbackParams, handleCallback, searchFlightEmails, batchFetchMessages, configureGmail } from '@/lib/gmail'
import { normalizeEmails } from '@/lib/email-normalizer'
import { streamMbox, parseEmlFile, getFileType } from '@/lib/mbox'
import { calculateStats } from '@/lib/stats'
import { calculateFunStats } from '@/lib/funStats'
import { generateInsights } from '@/lib/insights'
import { determineArchetype } from '@/lib/archetypes'
import type { Flight, ParseProgress, WorkerOutMessage, RawEmail } from '@/lib/types'

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

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(new URL('./worker/parser.worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
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

    return () => worker.terminate()
  }, [])

  // Handle Gmail OAuth callback
  useEffect(() => {
    const code = getCallbackCode()
    if (code) {
      clearCallbackParams()
      handleGmailCallback(code)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGmailCallback = async (code: string) => {
    try {
      setAppState('parsing')
      setProgress({ phase: 'scanning', current: 0, total: 0, flightsFound: 0, message: 'Exchanging auth code...' })

      const token = await handleCallback(code)

      setProgress({ phase: 'scanning', current: 0, total: 0, flightsFound: 0, message: 'Searching for flight emails...' })
      const messageIds = await searchFlightEmails(token, (fetched) => {
        setProgress((p) => ({ ...p, current: fetched, message: `Found ${fetched} potential flight emails...` }))
      })

      if (messageIds.length === 0) {
        setProgress({ phase: 'done', current: 0, total: 0, flightsFound: 0, message: 'No flight emails found' })
        return
      }

      setProgress({ phase: 'scanning', current: 0, total: messageIds.length, flightsFound: 0, message: 'Fetching emails...' })
      const rawEmails = await batchFetchMessages(messageIds, token, (fetched, total) => {
        setProgress({ phase: 'scanning', current: fetched, total, flightsFound: 0, message: `Fetching email ${fetched.toLocaleString()} of ${total.toLocaleString()}...` })
      })

      await sendToWorker(rawEmails)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gmail auth failed')
      setAppState('landing')
    }
  }

  const sendToWorker = async (rawEmails: RawEmail[]) => {
    setProgress({ phase: 'extracting', current: 0, total: rawEmails.length, flightsFound: 0, message: 'Normalizing emails...' })
    const normalized = await normalizeEmails(rawEmails, (current, total) => {
      setProgress({ phase: 'extracting', current, total, flightsFound: 0, message: `Normalizing email ${current} of ${total}...` })
    })

    workerRef.current?.postMessage({ type: 'parse-emails', data: normalized })
  }

  const handleFilesSelected = useCallback(async (files: File[]) => {
    setAppState('parsing')
    setError(null)

    try {
      const rawEmails: RawEmail[] = []
      let totalProcessed = 0

      for (const file of files) {
        const type = getFileType(file)

        if (type === 'mbox') {
          setProgress({ phase: 'scanning', current: 0, total: 0, flightsFound: 0, message: `Reading ${file.name}...` })
          for await (const email of streamMbox(file)) {
            rawEmails.push(email)
            totalProcessed++
            setProgress({ phase: 'scanning', current: totalProcessed, total: 0, flightsFound: 0, message: `Found ${totalProcessed} emails in ${file.name}...` })
          }
        } else if (type === 'eml') {
          const email = await parseEmlFile(file)
          rawEmails.push(email)
          totalProcessed++
        } else {
          // Try to parse as mbox for unknown types
          setProgress({ phase: 'scanning', current: 0, total: 0, flightsFound: 0, message: `Reading ${file.name}...` })
          for await (const email of streamMbox(file)) {
            rawEmails.push(email)
            totalProcessed++
          }
        }
      }

      if (rawEmails.length === 0) {
        setProgress({ phase: 'done', current: 0, total: 0, flightsFound: 0, message: 'No emails found in uploaded files' })
        return
      }

      await sendToWorker(rawEmails)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process files')
      setProgress((p) => ({ ...p, phase: 'error', message: err instanceof Error ? err.message : 'Failed to process files' }))
    }
  }, [])

  const handleError = useCallback((message: string) => {
    setError(message)
  }, [])

  const stats = useMemo(() => calculateStats(flights), [flights])
  const funStats = useMemo(() => calculateFunStats(stats), [stats])
  const insights = useMemo(() => generateInsights(flights, stats), [flights, stats])
  const archetype = useMemo(() => determineArchetype(flights, stats), [flights, stats])

  if (appState === 'landing') {
    return (
      <>
        <InputScreen onFilesSelected={handleFilesSelected} onError={handleError} />
        {error && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-900/90 text-red-200 px-6 py-3 rounded-lg shadow-lg">
            {error}
            <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-300">
              Dismiss
            </button>
          </div>
        )}
      </>
    )
  }

  if (appState === 'parsing') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
        <h1 className="text-3xl font-bold mb-8">MyFlights</h1>
        <ParsingProgress progress={progress} />
      </div>
    )
  }

  // Results state — placeholder until Part 5
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
      <h1 className="text-3xl font-bold mb-4">MyFlights</h1>

      <div className="max-w-lg w-full space-y-4 text-sm">
        <div className="bg-gray-900 rounded-lg p-4 space-y-2">
          <p className="text-lg font-semibold">{archetype.icon} {archetype.name}</p>
          <p className="text-gray-400">{archetype.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900 rounded-lg p-3">
            <p className="text-gray-400">Flights</p>
            <p className="text-xl font-bold">{stats.totalFlights}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-3">
            <p className="text-gray-400">Miles</p>
            <p className="text-xl font-bold">{stats.totalMiles.toLocaleString()}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-3">
            <p className="text-gray-400">Airports</p>
            <p className="text-xl font-bold">{stats.uniqueAirports}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-3">
            <p className="text-gray-400">Countries</p>
            <p className="text-xl font-bold">{stats.uniqueCountries}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-3">
            <p className="text-gray-400">Earth Orbits</p>
            <p className="text-xl font-bold">{funStats.earthOrbits}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-3">
            <p className="text-gray-400">Days in Air</p>
            <p className="text-xl font-bold">{funStats.daysInAir}</p>
          </div>
        </div>

        {insights.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-4">
            <p className="font-semibold mb-2">Insights</p>
            <ul className="space-y-1 text-gray-400">
              {insights.map((i) => (
                <li key={i.id}>{i.title}: {i.description}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-gray-500 text-center text-xs">Full dashboard coming in Part 5</p>
      </div>

      <button
        onClick={() => {
          setAppState('landing')
          setFlights([])
          setProgress({ phase: 'scanning', current: 0, total: 0, flightsFound: 0 })
        }}
        className="mt-6 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
      >
        Start Over
      </button>
    </div>
  )
}

export default App
