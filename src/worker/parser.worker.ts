import type { WorkerInMessage, WorkerOutMessage, Flight, NormalizedEmail, ParseProgress } from '@/lib/types'
import { extractFlightsFromEmail } from './extract'
import { deduplicateFlights } from './dedup'
import { initLlm, isLlmReady } from './extractors/llm'

function postMsg(msg: WorkerOutMessage) {
  postMessage(msg)
}

function reportProgress(progress: ParseProgress) {
  postMsg({ type: 'progress', data: progress })
}

async function ensureLlmReady(): Promise<void> {
  if (isLlmReady()) return

  reportProgress({
    phase: 'loading-model',
    current: 0,
    total: 100,
    flightsFound: 0,
    message: 'Loading AI model...',
  })

  await initLlm((progress) => {
    reportProgress({
      phase: 'loading-model',
      current: Math.round(progress.progress * 100),
      total: 100,
      flightsFound: 0,
      message: progress.text,
    })
  })
}

async function processEmails(emails: NormalizedEmail[]): Promise<Flight[]> {
  // Load the model first
  await ensureLlmReady()

  const allFlights: Flight[] = []

  reportProgress({
    phase: 'scanning',
    current: 0,
    total: emails.length,
    flightsFound: 0,
  })

  // Extract flights from each email via local LLM
  for (let i = 0; i < emails.length; i++) {
    const flights = await extractFlightsFromEmail(emails[i])
    allFlights.push(...flights)

    reportProgress({
      phase: 'extracting',
      current: i + 1,
      total: emails.length,
      flightsFound: allFlights.length,
    })
  }

  // Deduplicate
  reportProgress({
    phase: 'deduplicating',
    current: emails.length,
    total: emails.length,
    flightsFound: allFlights.length,
  })

  const deduplicated = deduplicateFlights(allFlights)

  reportProgress({
    phase: 'done',
    current: emails.length,
    total: emails.length,
    flightsFound: deduplicated.length,
  })

  return deduplicated
}

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data

  switch (msg.type) {
    case 'ping':
      postMsg({ type: 'pong' })
      break

    case 'init-llm':
      try {
        await ensureLlmReady()
        postMsg({ type: 'llm-ready' })
      } catch (err) {
        postMsg({
          type: 'error',
          data: { message: err instanceof Error ? err.message : 'Failed to load AI model' },
        })
      }
      break

    case 'parse-emails':
      try {
        const flights = await processEmails(msg.data)
        postMsg({ type: 'result', data: flights })
      } catch (err) {
        postMsg({
          type: 'error',
          data: { message: err instanceof Error ? err.message : 'Unknown error' },
        })
      }
      break
  }
}
