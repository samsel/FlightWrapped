import type { WorkerInMessage, WorkerOutMessage, Flight, NormalizedEmail, RawEmail, ParseProgress } from '@/lib/types'
import { normalizeEmails, normalizeEmail, extractSenderDomainFast } from '@/lib/email-normalizer'
import { isAirlineDomain } from '@/lib/domains'
import { parseMbox, parseMboxStream } from '@/lib/mbox-parser'
import { extractFlightsFromEmail } from './extract'
import { extractFromLlm } from './extractors/llm'
import { deduplicateFlights } from './dedup'
import { initLlm, isLlmReady } from './extractors/llm'
import {
  createMboxProfiler,
  createEmailProfiler,
  buildProfilerReport,
  type MboxProfiler,
  type EmailProfiler,
} from '@/lib/profiler'

let profilerEnabled = false

function postMsg(msg: WorkerOutMessage) {
  postMessage(msg)
}

function reportProgress(progress: ParseProgress) {
  postMsg({ type: 'progress', data: progress })
}

async function ensureLlmReady(mboxProfiler?: MboxProfiler): Promise<void> {
  if (isLlmReady()) return

  reportProgress({
    phase: 'loading-model',
    current: 0,
    total: 100,
    flightsFound: 0,
    message: 'Loading AI model...',
  })

  mboxProfiler?.start('model-load')

  await initLlm((progress) => {
    reportProgress({
      phase: 'loading-model',
      current: Math.round(progress.progress * 100),
      total: 100,
      flightsFound: 0,
      message: progress.text,
    })
  })

  mboxProfiler?.end('model-load')
}

async function normalizeRawEmails(
  rawEmails: RawEmail[],
  mboxProfiler?: MboxProfiler,
): Promise<NormalizedEmail[]> {
  reportProgress({
    phase: 'scanning',
    current: 0,
    total: rawEmails.length,
    flightsFound: 0,
    message: 'Normalizing emails...',
  })

  mboxProfiler?.start('normalize-all')

  const result = await normalizeEmails(rawEmails, (current, total) => {
    reportProgress({
      phase: 'scanning',
      current,
      total,
      flightsFound: 0,
      message: `Normalizing email ${current} of ${total}...`,
    })
  })

  mboxProfiler?.end('normalize-all')
  return result
}

async function processEmails(
  emails: NormalizedEmail[],
  mboxProfiler?: MboxProfiler,
  emailProfiler?: EmailProfiler,
): Promise<Flight[]> {
  await ensureLlmReady(mboxProfiler)

  const allFlights: Flight[] = []

  mboxProfiler?.start('extract-all')

  for (let i = 0; i < emails.length; i++) {
    emailProfiler?.startEmail(i, emails[i].subject, emails[i].senderDomain)

    const flights = await extractFlightsFromEmail(emails[i], emailProfiler)
    allFlights.push(...flights)

    emailProfiler?.endEmail()

    reportProgress({
      phase: 'extracting',
      current: i + 1,
      total: emails.length,
      flightsFound: allFlights.length,
    })
  }

  mboxProfiler?.end('extract-all')

  reportProgress({
    phase: 'deduplicating',
    current: emails.length,
    total: emails.length,
    flightsFound: allFlights.length,
  })

  mboxProfiler?.start('dedup')
  const deduplicated = deduplicateFlights(allFlights)
  mboxProfiler?.end('dedup')

  reportProgress({
    phase: 'done',
    current: emails.length,
    total: emails.length,
    flightsFound: deduplicated.length,
  })

  return deduplicated
}

/** Send profiler report if profiling is enabled */
function emitProfilerReport(mboxProfiler?: MboxProfiler, emailProfiler?: EmailProfiler) {
  if (!profilerEnabled || !mboxProfiler || !emailProfiler) return
  const report = buildProfilerReport(mboxProfiler.report(), emailProfiler.report())
  postMsg({ type: 'profiler-report', data: report })
}

// ─── Message handler ───

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data

  switch (msg.type) {
    case 'ping':
      postMsg({ type: 'pong' })
      break

    case 'set-profiler':
      profilerEnabled = msg.data
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
        const mp = profilerEnabled ? createMboxProfiler() : undefined
        const ep = profilerEnabled ? createEmailProfiler() : undefined

        reportProgress({
          phase: 'scanning',
          current: 0,
          total: 0,
          flightsFound: 0,
          message: 'Parsing .mbox file...',
        })

        mp?.start('mbox-parse')
        const rawEmails = parseMbox(msg.data)
        mp?.end('mbox-parse')

        reportProgress({
          phase: 'scanning',
          current: 0,
          total: rawEmails.length,
          flightsFound: 0,
          message: `Found ${rawEmails.length} emails in .mbox file`,
        })

        const asRaw: RawEmail[] = rawEmails.map((buf) => ({ raw: buf }))
        const normalized = await normalizeRawEmails(asRaw, mp)
        const flights = await processEmails(normalized, mp, ep)

        emitProfilerReport(mp, ep)
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
        const mp = profilerEnabled ? createMboxProfiler() : undefined
        const ep = profilerEnabled ? createEmailProfiler() : undefined

        const normalized = await normalizeRawEmails(msg.data, mp)
        const flights = await processEmails(normalized, mp, ep)

        emitProfilerReport(mp, ep)
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
        const mp = profilerEnabled ? createMboxProfiler() : undefined
        const ep = profilerEnabled ? createEmailProfiler() : undefined

        const files = msg.data

        // ── Phase 1: Fast scan ──
        // Stream through the mbox and use a cheap header scan to filter
        // by airline/booking domain BEFORE doing any expensive MIME parsing.
        // For a typical Gmail export, this skips 99%+ of emails instantly.
        const airlineRawEmails: ArrayBuffer[] = []
        let emailsScanned = 0
        let emailsSkipped = 0

        mp?.start('pipeline-total')

        // Start loading the LLM in parallel with the scan phase so it's
        // ready (or nearly ready) by the time we need it for extraction.
        const llmLoadPromise = ensureLlmReady(mp)

        mp?.start('fast-scan')

        for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
          const file = files[fileIdx]
          const fileLabel = files.length > 1
            ? `File ${fileIdx + 1}/${files.length}: ${file.name}`
            : file.name

          reportProgress({
            phase: 'scanning',
            current: 0,
            total: 0,
            flightsFound: 0,
            message: `Scanning ${fileLabel}...`,
          })

          mp?.start(`file-${fileIdx}-stream`)

          await parseMboxStream(file.stream(), async (rawBuffer: ArrayBuffer) => {
            emailsScanned++

            // Fast domain pre-filter: extract From header cheaply (~100x faster
            // than a full MIME parse) and check against the airline domain set.
            const domain = extractSenderDomainFast(rawBuffer)
            const isAirline = domain !== '' && isAirlineDomain(domain)

            if (!isAirline) {
              emailsSkipped++
              // Record filtered-out emails in profiler
              if (ep) {
                ep.startEmail(emailsScanned - 1, '', domain)
                ep.startSegment('domain-filter')
                ep.endSegment('domain-filter')
                ep.markFiltered()
                ep.endEmail()
              }
              // Report progress periodically during scan
              if (emailsScanned % 500 === 0) {
                reportProgress({
                  phase: 'scanning',
                  current: emailsScanned,
                  total: 0,
                  flightsFound: airlineRawEmails.length,
                  message: `${fileLabel} — ${emailsScanned.toLocaleString()} emails scanned, ${airlineRawEmails.length} from airlines`,
                })
              }
              return // skip — not an airline email
            }

            // This email is from an airline/booking domain — keep it for phase 2
            airlineRawEmails.push(rawBuffer)

            reportProgress({
              phase: 'scanning',
              current: emailsScanned,
              total: 0,
              flightsFound: airlineRawEmails.length,
              message: `${fileLabel} — ${emailsScanned.toLocaleString()} emails scanned, ${airlineRawEmails.length} from airlines`,
            })
          })

          mp?.end(`file-${fileIdx}-stream`)
        }

        mp?.end('fast-scan')

        reportProgress({
          phase: 'scanning',
          current: emailsScanned,
          total: emailsScanned,
          flightsFound: airlineRawEmails.length,
          message: `Scan complete: ${emailsScanned.toLocaleString()} emails scanned, ${airlineRawEmails.length} airline emails found (${emailsSkipped.toLocaleString()} skipped)`,
        })

        // ── Phase 2: Extract flights from airline emails only ──
        // Wait for LLM to be ready (likely already loaded during scan)
        await llmLoadPromise

        const allFlights: Flight[] = []

        mp?.start('extract-all')

        for (let i = 0; i < airlineRawEmails.length; i++) {
          // Now do the full MIME parse — but only for the small set of airline emails
          let normalized: NormalizedEmail

          // Profiler: track this airline email through normalize + extract
          ep?.startEmail(emailsScanned + i, '', '')

          try {
            ep?.startSegment('normalize')
            normalized = await normalizeEmail({ raw: airlineRawEmails[i] })
            ep?.endSegment('normalize')
            ep?.updateEmail(normalized.subject, normalized.senderDomain)
          } catch {
            ep?.endEmail()
            continue // skip unparseable emails
          }

          // Call extractFromLlm directly — domain was already verified in
          // Phase 1 via extractSenderDomainFast, no need to re-check.
          ep?.startSegment('llm-extract')
          const flights = await extractFromLlm(normalized)
          ep?.endSegment('llm-extract')

          if (flights.length > 0) {
            allFlights.push(...flights)
          }
          ep?.markFlights(flights.length)
          ep?.endEmail()

          reportProgress({
            phase: 'extracting',
            current: i + 1,
            total: airlineRawEmails.length,
            flightsFound: allFlights.length,
            message: `Extracting flights: ${i + 1}/${airlineRawEmails.length} airline emails processed`,
          })
        }

        mp?.end('extract-all')

        reportProgress({
          phase: 'deduplicating',
          current: airlineRawEmails.length,
          total: airlineRawEmails.length,
          flightsFound: allFlights.length,
        })

        mp?.start('dedup')
        const deduplicated = deduplicateFlights(allFlights)
        mp?.end('dedup')

        mp?.end('pipeline-total')

        reportProgress({
          phase: 'done',
          current: airlineRawEmails.length,
          total: airlineRawEmails.length,
          flightsFound: deduplicated.length,
        })

        emitProfilerReport(mp, ep)
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
        const mp = profilerEnabled ? createMboxProfiler() : undefined
        const ep = profilerEnabled ? createEmailProfiler() : undefined

        const flights = await processEmails(msg.data, mp, ep)

        emitProfilerReport(mp, ep)
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
