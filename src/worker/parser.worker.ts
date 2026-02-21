import type { WorkerInMessage, WorkerOutMessage, Flight, NormalizedEmail, ParseProgress } from '@/lib/types'

function postMsg(msg: WorkerOutMessage) {
  postMessage(msg)
}

function reportProgress(progress: ParseProgress) {
  postMsg({ type: 'progress', data: progress })
}

async function processEmails(emails: NormalizedEmail[]): Promise<Flight[]> {
  const flights: Flight[] = []

  reportProgress({
    phase: 'scanning',
    current: 0,
    total: emails.length,
    flightsFound: 0,
  })

  // Placeholder: extraction pipeline will be wired in Part 3
  for (let i = 0; i < emails.length; i++) {
    reportProgress({
      phase: 'extracting',
      current: i + 1,
      total: emails.length,
      flightsFound: flights.length,
    })
  }

  reportProgress({
    phase: 'done',
    current: emails.length,
    total: emails.length,
    flightsFound: flights.length,
  })

  return flights
}

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data

  switch (msg.type) {
    case 'ping':
      postMsg({ type: 'pong' })
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
