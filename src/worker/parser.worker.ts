import type { WorkerInMessage, WorkerOutMessage, Flight, NormalizedEmail, RawEmail, ParseProgress } from '@/lib/types'
import { normalizeEmails, normalizeEmail } from '@/lib/email-normalizer'
import { parseMbox, parseMboxStream } from '@/lib/mbox-parser'
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

async function normalizeRawEmails(rawEmails: RawEmail[]): Promise<NormalizedEmail[]> {
  reportProgress({
    phase: 'scanning',
    current: 0,
    total: rawEmails.length,
    flightsFound: 0,
    message: 'Normalizing emails...',
  })

  return normalizeEmails(rawEmails, (current, total) => {
    reportProgress({
      phase: 'scanning',
      current,
      total,
      flightsFound: 0,
      message: `Normalizing email ${current} of ${total}...`,
    })
  })
}

async function processEmails(emails: NormalizedEmail[]): Promise<Flight[]> {
  await ensureLlmReady()

  const allFlights: Flight[] = []

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

// ─── Message handler ───

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

    case 'parse-mbox':
      try {
        reportProgress({
          phase: 'scanning',
          current: 0,
          total: 0,
          flightsFound: 0,
          message: 'Parsing .mbox file...',
        })

        const rawEmails = parseMbox(msg.data)

        reportProgress({
          phase: 'scanning',
          current: 0,
          total: rawEmails.length,
          flightsFound: 0,
          message: `Found ${rawEmails.length} emails in .mbox file`,
        })

        const asRaw: RawEmail[] = rawEmails.map((buf) => ({ raw: buf }))
        const normalized = await normalizeRawEmails(asRaw)
        const flights = await processEmails(normalized)
        postMsg({ type: 'result', data: flights })
      } catch (err) {
        postMsg({
          type: 'error',
          data: { message: err instanceof Error ? err.message : 'Failed to parse .mbox file' },
        })
      }
      break

    case 'parse-raw-emails':
      try {
        const normalized = await normalizeRawEmails(msg.data)
        const flights = await processEmails(normalized)
        postMsg({ type: 'result', data: flights })
      } catch (err) {
        postMsg({
          type: 'error',
          data: { message: err instanceof Error ? err.message : 'Unknown error' },
        })
      }
      break

    case 'parse-mbox-files':
      try {
        await ensureLlmReady()

        const files = msg.data
        const allFlights: Flight[] = []
        let emailsScanned = 0

        for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
          const file = files[fileIdx]
          const fileLabel = files.length > 1
            ? `File ${fileIdx + 1}/${files.length}: ${file.name}`
            : file.name

          reportProgress({
            phase: 'scanning',
            current: 0,
            total: 0,
            flightsFound: allFlights.length,
            message: `Reading ${fileLabel}...`,
          })

          await parseMboxStream(file.stream(), async (rawBuffer: ArrayBuffer) => {
            emailsScanned++

            // Normalize the email
            let normalized: NormalizedEmail
            try {
              normalized = await normalizeEmail({ raw: rawBuffer })
            } catch {
              return // skip unparseable emails
            }

            // Report scanning progress
            if (emailsScanned % 50 === 0 || emailsScanned < 10) {
              reportProgress({
                phase: 'scanning',
                current: emailsScanned,
                total: 0,
                flightsFound: allFlights.length,
                message: `${fileLabel} - ${emailsScanned.toLocaleString()} emails scanned, ${allFlights.length} flights found`,
              })
            }

            // Extract flights (domain filter + LLM)
            const flights = await extractFlightsFromEmail(normalized)
            if (flights.length > 0) {
              allFlights.push(...flights)
            }
          })
        }

        reportProgress({
          phase: 'extracting',
          current: emailsScanned,
          total: emailsScanned,
          flightsFound: allFlights.length,
          message: `Scanned ${emailsScanned.toLocaleString()} emails, found ${allFlights.length} flights`,
        })

        reportProgress({
          phase: 'deduplicating',
          current: emailsScanned,
          total: emailsScanned,
          flightsFound: allFlights.length,
        })

        const deduplicated = deduplicateFlights(allFlights)

        reportProgress({
          phase: 'done',
          current: emailsScanned,
          total: emailsScanned,
          flightsFound: deduplicated.length,
        })

        postMsg({ type: 'result', data: deduplicated })
      } catch (err) {
        postMsg({
          type: 'error',
          data: { message: err instanceof Error ? err.message : 'Failed to parse .mbox files' },
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
