/**
 * Lightweight profiler for measuring pipeline segment timings.
 *
 * Usage:
 *   const p = createProfiler()
 *   p.start('mbox-parse')
 *   // … work …
 *   p.end('mbox-parse')
 *   const report = p.report()
 *
 * Email-level profiling tracks per-email timings across multiple steps.
 */

export interface SegmentTiming {
  name: string
  startMs: number
  endMs: number
  durationMs: number
}

export interface EmailTiming {
  index: number
  subject: string
  domain: string
  segments: SegmentTiming[]
  totalMs: number
  skipped: boolean
  /** Whether the domain filter rejected this email */
  filteredOut: boolean
  /** Number of flights extracted from this email */
  flightsFound: number
}

export interface ProfilerReport {
  /** High-level mbox pipeline segment timings */
  mboxSegments: SegmentTiming[]
  /** Per-email breakdown */
  emails: EmailTiming[]
  /** Wall-clock total from first start to last end */
  totalMs: number
  /** Summary counters */
  summary: {
    totalEmails: number
    filteredEmails: number
    processedEmails: number
    totalFlightsExtracted: number
    avgNormalizeMs: number
    avgDomainFilterMs: number
    avgLlmMs: number
    avgDedupMs: number | null
  }
}

// ─── Mbox-level profiler ───

interface PendingSegment {
  name: string
  startMs: number
}

export interface MboxProfiler {
  start(name: string): void
  end(name: string): void
  report(): SegmentTiming[]
}

export function createMboxProfiler(): MboxProfiler {
  const pending = new Map<string, PendingSegment>()
  const completed: SegmentTiming[] = []

  return {
    start(name: string) {
      pending.set(name, { name, startMs: performance.now() })
    },
    end(name: string) {
      const p = pending.get(name)
      if (!p) return
      pending.delete(name)
      const endMs = performance.now()
      completed.push({
        name,
        startMs: p.startMs,
        endMs,
        durationMs: endMs - p.startMs,
      })
    },
    report() {
      return completed
    },
  }
}

// ─── Email-level profiler ───

export interface EmailProfiler {
  startEmail(index: number, subject: string, domain: string): void
  updateEmail(subject: string, domain: string): void
  startSegment(name: string): void
  endSegment(name: string): void
  addSegment(name: string, durationMs: number): void
  markFiltered(): void
  markFlights(count: number): void
  endEmail(): void
  report(): EmailTiming[]
}

export function createEmailProfiler(): EmailProfiler {
  const emails: EmailTiming[] = []
  let current: {
    index: number
    subject: string
    domain: string
    segments: SegmentTiming[]
    pending: Map<string, number>
    startMs: number
    filteredOut: boolean
    flightsFound: number
  } | null = null

  return {
    startEmail(index, subject, domain) {
      current = {
        index,
        subject,
        domain,
        segments: [],
        pending: new Map(),
        startMs: performance.now(),
        filteredOut: false,
        flightsFound: 0,
      }
    },
    updateEmail(subject, domain) {
      if (current) {
        current.subject = subject
        current.domain = domain
      }
    },
    startSegment(name) {
      current?.pending.set(name, performance.now())
    },
    endSegment(name) {
      if (!current) return
      const startMs = current.pending.get(name)
      if (startMs === undefined) return
      current.pending.delete(name)
      const endMs = performance.now()
      current.segments.push({ name, startMs, endMs, durationMs: endMs - startMs })
    },
    addSegment(name: string, durationMs: number) {
      if (!current) return
      const endMs = performance.now()
      current.segments.push({ name, startMs: endMs - durationMs, endMs, durationMs })
    },
    markFiltered() {
      if (current) current.filteredOut = true
    },
    markFlights(count) {
      if (current) current.flightsFound = count
    },
    endEmail() {
      if (!current) return
      const endMs = performance.now()
      emails.push({
        index: current.index,
        subject: current.subject,
        domain: current.domain,
        segments: current.segments,
        totalMs: endMs - current.startMs,
        skipped: current.segments.length === 0 && !current.filteredOut,
        filteredOut: current.filteredOut,
        flightsFound: current.flightsFound,
      })
      current = null
    },
    report() {
      return emails
    },
  }
}

// ─── Build final report ───

export function buildProfilerReport(
  mboxSegments: SegmentTiming[],
  emailTimings: EmailTiming[],
): ProfilerReport {
  const firstStart = mboxSegments.length > 0
    ? Math.min(...mboxSegments.map((s) => s.startMs))
    : 0
  const lastEnd = mboxSegments.length > 0
    ? Math.max(...mboxSegments.map((s) => s.endMs))
    : 0

  const filtered = emailTimings.filter((e) => e.filteredOut)
  const processed = emailTimings.filter((e) => !e.filteredOut && !e.skipped)

  function avgSegment(name: string): number {
    const timings = processed
      .flatMap((e) => e.segments)
      .filter((s) => s.name === name)
    if (timings.length === 0) return 0
    return timings.reduce((sum, t) => sum + t.durationMs, 0) / timings.length
  }

  const dedupSegment = mboxSegments.find((s) => s.name === 'dedup')

  return {
    mboxSegments,
    emails: emailTimings,
    totalMs: lastEnd - firstStart,
    summary: {
      totalEmails: emailTimings.length,
      filteredEmails: filtered.length,
      processedEmails: processed.length,
      totalFlightsExtracted: emailTimings.reduce((sum, e) => sum + e.flightsFound, 0),
      avgNormalizeMs: avgSegment('normalize'),
      avgDomainFilterMs: avgSegment('domain-filter'),
      avgLlmMs: avgSegment('llm-extract'),
      avgDedupMs: dedupSegment ? dedupSegment.durationMs : null,
    },
  }
}
