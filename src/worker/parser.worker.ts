import type { WorkerInMessage, WorkerOutMessage, Flight, NormalizedEmail, ParseProgress } from '@/lib/types'
import { normalizeEmail, extractSenderDomainFast } from '@/lib/email-normalizer'
import { isAirlineDomain } from '@/lib/domains'
import { parseMboxStream } from '@/lib/mbox-parser'
import { extractFromLlm, extractFromLlmBatch, EXTRACT_BATCH_SIZE } from './extractors/llm'
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
let multiWorkerMode = false

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

        // In multi-worker mode, send airline emails to coordinator for distribution
        if (multiWorkerMode) {
          mp?.end('pipeline-total')
          emitProfilerReport(mp, ep)
          const scanData = { airlineEmails: airlineRawEmails, totalScanned: emailsScanned }
          ;(postMessage as (msg: unknown, transfer: Transferable[]) => void)(
            { type: 'scan-complete', data: scanData } as WorkerOutMessage,
            airlineRawEmails,
          )
          break
        }

        // Wait for LLM to be ready (likely already loaded during scan)
        await llmLoadPromise

        const allFlights: Flight[] = []

        mp?.start('extract-all')

        // Process emails in batches of EXTRACT_BATCH_SIZE for fewer LLM calls
        for (let i = 0; i < airlineRawEmails.length; i += EXTRACT_BATCH_SIZE) {
          const batchEnd = Math.min(i + EXTRACT_BATCH_SIZE, airlineRawEmails.length)

          // Normalize all emails in this batch
          const batchData: Array<{
            normalized: NormalizedEmail
            rawIdx: number
            normalizeMs: number
          }> = []

          for (let j = i; j < batchEnd; j++) {
            try {
              const start = performance.now()
              const normalized = await normalizeEmail({ raw: airlineRawEmails[j] })
              batchData.push({ normalized, rawIdx: j, normalizeMs: performance.now() - start })
            } catch {
              if (ep) {
                ep.startEmail(emailsScanned + j, '', '')
                ep.endEmail()
              }
            }
          }

          if (batchData.length === 0) {
            reportProgress({
              phase: 'extracting',
              current: batchEnd,
              total: airlineRawEmails.length,
              flightsFound: allFlights.length,
              message: `Extracting flights: ${batchEnd}/${airlineRawEmails.length} airline emails processed`,
            })
            continue
          }

          // Batch LLM extraction — one call for up to EXTRACT_BATCH_SIZE emails
          const llmStart = performance.now()
          const batchFlights = await extractFromLlmBatch(batchData.map(d => d.normalized))
          const llmMs = performance.now() - llmStart
          const llmPerEmail = llmMs / batchData.length

          // Record results and profiler data for each email in batch
          for (let j = 0; j < batchData.length; j++) {
            const { normalized, rawIdx, normalizeMs } = batchData[j]
            const flights = batchFlights[j] || []
            if (flights.length > 0) allFlights.push(...flights)

            if (ep) {
              ep.startEmail(emailsScanned + rawIdx, normalized.subject, normalized.senderDomain)
              ep.addSegment('normalize', normalizeMs)
              ep.addSegment('llm-extract', llmPerEmail)
              ep.markFlights(flights.length)
              ep.endEmail()
            }
          }

          reportProgress({
            phase: 'extracting',
            current: batchEnd,
            total: airlineRawEmails.length,
            flightsFound: allFlights.length,
            message: `Extracting flights: ${batchEnd}/${airlineRawEmails.length} airline emails processed`,
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

    case 'set-multi-worker':
      multiWorkerMode = msg.data
      break

    case 'extract-emails':
      try {
        await ensureLlmReady()
        const rawEmails = msg.data
        const extractedFlights: Flight[] = []

        for (let i = 0; i < rawEmails.length; i += EXTRACT_BATCH_SIZE) {
          const batchEnd = Math.min(i + EXTRACT_BATCH_SIZE, rawEmails.length)
          const batchNormalized: NormalizedEmail[] = []

          for (let j = i; j < batchEnd; j++) {
            try {
              batchNormalized.push(await normalizeEmail({ raw: rawEmails[j] }))
            } catch { /* skip unparseable */ }
          }

          if (batchNormalized.length > 0) {
            const batchFlights = await extractFromLlmBatch(batchNormalized)
            for (const flights of batchFlights) {
              extractedFlights.push(...flights)
            }
          }

          reportProgress({
            phase: 'extracting',
            current: batchEnd,
            total: rawEmails.length,
            flightsFound: extractedFlights.length,
            message: `Extracting flights: ${batchEnd}/${rawEmails.length} airline emails processed`,
          })
        }

        postMsg({ type: 'extract-result', data: extractedFlights })
      } catch (err) {
        postMsg({
          type: 'error',
          data: { message: err instanceof Error ? err.message : 'Extraction failed' },
        })
      }
      break
  }
}
