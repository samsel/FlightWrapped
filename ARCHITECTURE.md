# FlightWrapped Architecture

## Overview

FlightWrapped is a privacy-first, browser-based flight analytics tool. Users export their Gmail via Google Takeout and upload the .mbox file. The app parses individual emails from the file, extracts flight data using a local LLM, deduplicates results, calculates stats, and displays interactive visualizations -- all in the browser with zero server dependency. No API access to email accounts is ever made.

## Why Google Takeout Instead of Gmail OAuth

FlightWrapped was originally designed with Gmail OAuth PKCE for direct API access. We pivoted to Google Takeout file upload because:

1. **Gmail `gmail.readonly` is a restricted scope.** Google requires apps using restricted scopes to pass a CASA Tier 2 security assessment ($4,500--$75,000+) before any user beyond the developer's test accounts can authenticate. This is prohibitive for a portfolio/open-source project.
2. **Truly zero external API calls.** The original OAuth approach required browser-to-Gmail-API calls. With Takeout, the only external network calls are for the LLM model download (Hugging Face CDN). Email data never leaves the device even temporarily.
3. **Drastically simpler architecture.** Eliminated: OAuth PKCE flow, code verifier/state management, sessionStorage for redirect, token exchange, Gmail API search/batch-fetch, rate limiting, retry logic with exponential backoff, callback URL handling, CSP allowlisting for Google domains. The entire `gmail.ts` module (~300 lines) was replaced by a ~20-line mbox parser + a file input component.
4. **Stronger privacy claim.** "We never connect to your email account" vs "We connect read-only."

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                                │
│                                                                        │
│  ┌───────────┐    File[]     ┌──────────────────────────────────────┐  │
│  │           │──────────────▶│          MAIN WORKER (W1)            │  │
│  │  App.tsx  │               │                                      │  │
│  │  (React)  │               │  ┌────────────────────────────────┐  │  │
│  │           │◀──progress────│  │  PHASE 1: FAST SCAN            │  │  │
│  │           │               │  │                                │  │  │
│  │           │               │  │  .mbox ──▶ Stream chunks       │  │  │
│  │           │               │  │           ──▶ "From " split    │  │  │
│  │           │               │  │           ──▶ 16KB header scan │  │  │
│  │           │               │  │           ──▶ domain filter    │  │  │
│  │           │               │  │                 │       │      │  │  │
│  │           │               │  │              skip     match    │  │  │
│  │           │               │  │              99%+   (airline)  │  │  │
│  │           │               │  │               │        │       │  │  │
│  │           │               │  │               ▼        ▼       │  │  │
│  │           │               │  │           (discard)  collect   │  │  │
│  │           │               │  │                    ArrayBuf[]  │  │  │
│  │           │               │  └────────────────────────────────┘  │  │
│  │           │               │                                      │  │
│  │           │               │  ┌────────────────────────────────┐  │  │
│  │           │◀──progress────│  │  PHASE 2: LLM EXTRACTION      │  │  │
│  │           │               │  │  (model loaded during Phase 1) │  │  │
│  │           │               │  │                                │  │  │
│  │           │               │  │  Batch emails (3 per LLM call) │  │  │
│  │           │               │  │  ──▶ normalize (postal-mime)   │  │  │
│  │           │               │  │  ──▶ strip to plain text       │  │  │
│  │           │               │  │  ──▶ LLM batch extraction      │  │  │
│  │           │               │  │  ──▶ IATA validation           │  │  │
│  │           │               │  └────────────────────────────────┘  │  │
│  │           │               │                                      │  │
│  │           │               │  ┌────────────────────────────────┐  │  │
│  │           │◀──result──────│  │  PHASE 3: DEDUP                │  │  │
│  │           │               │  │  flight#+date ──▶ route+date   │  │  │
│  │           │               │  │  ──▶ codeshare detection       │  │  │
│  │           │               │  └────────────────────────────────┘  │  │
│  │           │               └──────────────────────────────────────┘  │
│  │           │                                                        │
│  │           │──▶ Stats Engine (memoized)                             │
│  │           │    calculateStats()     ──▶ FlightStats                │
│  │           │    calculateFunStats()  ──▶ FunStats                   │
│  │           │    generateInsights()   ──▶ Insight[]                  │
│  │           │    determineArchetype() ──▶ Archetype                  │
│  │           │                                                        │
│  │           │──▶ IndexedDB ("flightwrapped")                        │
│  │           │    flights + lastImportAt                               │
│  │           │                                                        │
│  │           │──▶ Dashboard                                           │
│  │           │    3D Globe + Stats + Charts + Insights + Flight List  │
│  └───────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

## Multi-Worker Architecture

On capable devices, Phase 2 (LLM extraction) is parallelized across two workers. This is the most CPU/GPU-intensive phase, so splitting the workload can reduce total extraction time.

### Capability Detection

```
detectCapabilities()  (src/lib/capabilities.ts)
        │
        ▼
┌─────────────────────────────────┐
│  navigator.deviceMemory >= 8 ?  │──── no ───▶  Single-worker mode
│  navigator.hardwareConcurrency  │
│                >= 8 ?           │
└───────────────┬─────────────────┘
                │ yes
                ▼
       Multi-worker eligible
       (canMultiWorker = true)
```

At startup, `App.tsx` sends `set-multi-worker: true` to the main worker, which changes its Phase 2 behavior: instead of extracting locally, it emits a `scan-complete` message back to the coordinator.

### Single-Worker vs Multi-Worker Decision

```
                        Phase 1 scan completes
                    worker sends "scan-complete"
                    with ArrayBuffer[] of airline emails
                                │
                                ▼
                  ┌─────────────────────────────┐
                  │  canMultiWorker = true       │
                  │  AND airlineEmails.length    │
                  │      >= 6 ?                  │
                  └──────┬──────────────┬────────┘
                         │              │
                    yes  │              │  no
                         │              │
                         ▼              ▼
                  ┌─────────────┐  ┌──────────────┐
                  │ MULTI-WORKER│  │ SINGLE-WORKER│
                  │ Split in    │  │ Send all     │
                  │ half, spawn │  │ emails back  │
                  │ Worker W2   │  │ to W1 for    │
                  └──────┬──────┘  │ extraction   │
                         │         └──────┬───────┘
                         ▼                ▼
                   (see below)      extract-emails
                                    ──▶ extract-result
                                    ──▶ finalize
```

### Multi-Worker Coordination Flow

```
   App.tsx (Main Thread)          Worker W1               Worker W2
          │                          │                       │
          │  parse-mbox-files        │                       │
          │─────────────────────────▶│                       │
          │                          │                       │
          │  progress (scanning)     │  Phase 1:             │
          │◀─────────────────────────│  stream mbox          │
          │                          │  fast domain filter   │
          │                          │  collect airline      │
          │                          │  ArrayBuffers         │
          │                          │                       │
          │  scan-complete           │                       │
          │  { airlineEmails:        │                       │
          │    ArrayBuffer[N],       │                       │
          │    totalScanned }        │                       │
          │◀═════════════════════════│                       │
          │  (ArrayBuffers           │                       │
          │   transferred,           │                       │
          │   zero-copy)             │                       │
          │                          │                       │
          │──── split in half ───┐   │                       │
          │                      │   │                       │
          │  extract-emails      │   │                       │
          │  batch1 [0..N/2]     │   │                       │
          │═════════════════════▶│   │                       │
          │  (transfer)          │   │                       │
          │                      │   │                       │
          │  spawn W2 ──────────────────────────────────────▶│
          │                      │   │                       │
          │  extract-emails      │   │                       │
          │  batch2 [N/2..N]     │   │                       │
          │══════════════════════════════════════════════════▶│
          │  (transfer)          │   │                       │
          │                      │   │                       │
          │  progress            │   │  ensureLlmReady()     │
          │◀─────────────────────│   │  (model from cache)   │
          │                      │   │                       │
          │                      │   │  progress             │
          │◀─────────────────────────────────────────────────│
          │                      │   │                       │
          │  Phase 2 (parallel): │   │  Phase 2 (parallel):  │
          │  normalize + batch   │   │  normalize + batch    │
          │  LLM extract         │   │  LLM extract          │
          │                      │   │                       │
          │  extract-result      │   │                       │
          │  Flight[] (1st half) │   │                       │
          │◀─────────────────────│   │                       │
          │  remaining: 2 -> 1   │   │                       │
          │                      │   │  extract-result       │
          │                      │   │  Flight[] (2nd half)  │
          │◀─────────────────────────────────────────────────│
          │  remaining: 1 -> 0   │   │                       │
          │                      │   │                       │
          │──── merge all ──────▶│   │                       │
          │     flights          │   │                       │
          │──── dedup ──────────▶│   │                       │
          │──── finalize ───────▶│   │                       │
          │──── terminate W2 ────────────────────────────────│✕
          │                          │                       │
          │  save to IndexedDB       │                       │
          │  transition to reveal    │                       │
          ▼                          ▼

   Legend:  ───▶  structured clone (copy)
            ═══▶  transferable (zero-copy, ownership moves)
```

### ArrayBuffer Ownership Transfer

The pipeline uses `postMessage` transferables to avoid copying large email buffers:

```
  Worker W1 memory         Main Thread memory         Worker W2 memory
  ─────────────────        ──────────────────          ──────────────────
  airlineRawEmails[]
  [buf0][buf1]...[bufN]
         │
         │ scan-complete (transfer)
         │ buffers move to main thread
         ▼
  (detached)               [buf0][buf1]...[bufN]
                                    │
                           slice into halves
                           batch1 = [buf0..bufN/2]
                           batch2 = [bufN/2..bufN]
                                    │
                  ┌─────────────────┴──────────────────┐
                  │ extract-emails (transfer)           │ extract-emails (transfer)
                  ▼                                     ▼
  [buf0..bufN/2]           (all detached)                    [bufN/2..bufN]

  Each buffer is transferred exactly once per hop.
  No buffer is ever copied -- zero-copy throughout.
```

## Batch LLM Extraction

Instead of one LLM call per email, emails are grouped into batches of `EXTRACT_BATCH_SIZE = 3` and processed in a single inference call. This reduces LLM overhead (prompt parsing, KV cache setup) by ~3x.

### Batch Processing Flow

```
  airlineEmails (ArrayBuffer[])
          │
          │ group into batches of 3
          ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  Batch [i, i+1, i+2]                                           │
  │                                                                 │
  │  1. Normalize each email (postal-mime MIME parse)               │
  │     ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
  │     │ email[i] │  │email[i+1]│  │email[i+2]│                   │
  │     │ raw buf  │  │ raw buf  │  │ raw buf  │                   │
  │     └────┬─────┘  └────┬─────┘  └────┬─────┘                   │
  │          ▼             ▼             ▼                          │
  │     NormalizedEmail  NormEmail    NormEmail                     │
  │     { subject,       { ... }      { ... }                      │
  │       htmlBody,                                                 │
  │       textBody,                                                 │
  │       senderDomain,                                             │
  │       date }                                                    │
  │                                                                 │
  │  2. Strip to plain text (max 2000 chars each)                   │
  │                                                                 │
  │  3. Build combined prompt:                                      │
  │     ┌─────────────────────────────────────────────────────┐     │
  │     │ Extract flight information from each email below.   │     │
  │     │ Return ONLY valid JSON, no other text.              │     │
  │     │                                                     │     │
  │     │ Format: {"email_1":{"flights":[]},                  │     │
  │     │          "email_2":{"flights":[]},                  │     │
  │     │          "email_3":{"flights":[]}}                  │     │
  │     │                                                     │     │
  │     │ === EMAIL 1 ===                                     │     │
  │     │ <plain text of email[i], up to 2000 chars>          │     │
  │     │                                                     │     │
  │     │ === EMAIL 2 ===                                     │     │
  │     │ <plain text of email[i+1]>                          │     │
  │     │                                                     │     │
  │     │ === EMAIL 3 ===                                     │     │
  │     │ <plain text of email[i+2]> /no_think                │     │
  │     └─────────────────────────────────────────────────────┘     │
  │                                                                 │
  │  4. Single LLM inference call                                   │
  │     Qwen3-4B, temp=0.1, max_tokens = 500 * batch_size          │
  │                                                                 │
  │  5. Parse response: extract per-email flight arrays              │
  │     ┌────────────────────────────────────────┐                  │
  │     │ {"email_1":{"flights":[{...},{...}]},  │                  │
  │     │  "email_2":{"flights":[]},             │                  │
  │     │  "email_3":{"flights":[{...}]}}        │                  │
  │     └────────────────────────────────────────┘                  │
  │          │            │            │                             │
  │          ▼            ▼            ▼                             │
  │     Flight[]     Flight[]     Flight[]                          │
  │     (validated)  (validated)  (validated)                       │
  │                                                                 │
  │  6. Validate each flight:                                       │
  │     - IATA codes checked against 5,500+ airport DB              │
  │     - origin != destination                                     │
  │     - date parsed to YYYY-MM-DD (fallback: email date)          │
  │     - confidence = 0.85                                         │
  │                                                                 │
  │  7. Fallback: if batch call fails, retry each email             │
  │     individually via extractFromLlm()                           │
  └─────────────────────────────────────────────────────────────────┘
          │
          │ next batch
          ▼
  ┌─────────────────┐
  │ Batch [i+3, ...] │ ... repeat until all emails processed
  └─────────────────┘
```

## Worker Message Protocol

### Message Types

**Inbound (Main Thread -> Worker):**

| Type | Payload | Purpose |
|------|---------|---------|
| `init-llm` | -- | Start loading the LLM model |
| `parse-mbox-files` | `File[]` | Begin full pipeline (scan + extract + dedup) |
| `set-profiler` | `boolean` | Enable/disable pipeline timing profiler |
| `set-multi-worker` | `boolean` | Enable multi-worker mode (scan-only, no local extract) |
| `extract-emails` | `ArrayBuffer[]` | Extract flights from pre-scanned airline emails |
| `ping` | -- | Health check |

**Outbound (Worker -> Main Thread):**

| Type | Payload | Purpose |
|------|---------|---------|
| `progress` | `ParseProgress` | Phase + progress updates for UI |
| `result` | `Flight[]` | Final deduplicated flights (single-worker mode only) |
| `scan-complete` | `{ airlineEmails, totalScanned }` | Phase 1 done, hand off emails for distribution (multi-worker) |
| `extract-result` | `Flight[]` | This worker's extracted flights (multi-worker mode) |
| `profiler-report` | `ProfilerReport` | Timing data for profiler overlay |
| `llm-ready` | -- | Model loaded and ready |
| `error` | `{ message }` | Fatal error |
| `pong` | -- | Health check response |

### Message Flow: Single-Worker Mode

```
Main Thread                    Worker
     │                            │
     │── init-llm ───────────────▶│
     │                            │── start model download
     │◀── progress (loading) ─────│
     │◀── llm-ready ─────────────│
     │                            │
     │── parse-mbox-files ───────▶│
     │                            │── Phase 1: scan
     │◀── progress (scanning) ───│
     │                            │── Phase 2: batch extract
     │◀── progress (extracting) ─│
     │                            │── Phase 3: dedup
     │◀── progress (dedup) ──────│
     │◀── result (Flight[]) ─────│
     │                            │
```

### Message Flow: Multi-Worker Mode

```
Main Thread                    Worker W1                Worker W2
     │                            │
     │── set-multi-worker(true) ─▶│
     │── init-llm ───────────────▶│
     │◀── llm-ready ─────────────│
     │                            │
     │── parse-mbox-files ───────▶│
     │◀── progress (scanning) ───│── Phase 1 only
     │◀── scan-complete ═════════│   (transfers ArrayBuffers)
     │                            │
     │── extract-emails(half1) ══▶│
     │                            │── Phase 2: batch extract
     │                   ┌────────────────────────────▶│ (spawned)
     │── extract-emails(half2) ══════════════════════▶│
     │                            │                    │── ensureLlmReady
     │◀── progress ──────────────│                    │── Phase 2: extract
     │◀── progress ──────────────────────────────────│
     │◀── extract-result ────────│                    │
     │◀── extract-result ───────────────────────────│
     │                            │                    │
     │── merge + dedup            │                    │
     │── terminate W2 ───────────────────────────────▶│✕
     │                            │
```

### Progress Phases

```
loading-model ──▶ scanning ──▶ extracting ──▶ deduplicating ──▶ done
                                                                  │
                                     error ◀──────────────────────┘
                                     (on failure at any phase)
```

## Mbox Parsing

The `.mbox` format (from Google Takeout) stores emails separated by `"From "` lines at the start of each message.

**Streaming parser (`parseMboxStream`)** -- reads the file via `ReadableStream` in browser-sized chunks (~64KB), detects `"From "` boundaries line-by-line, and emits one email at a time via an async callback. Uses constant memory regardless of file size (handles 6GB+ files without issue). Implements backpressure by awaiting the callback before reading the next chunk.

The parser:
1. Strips the envelope "From " header line from each message
2. Un-escapes `">From "` -> `"From "` in email bodies (standard mbox escaping)
3. Returns `ArrayBuffer` per email for the normalization pipeline

## Domain Pre-filtering (Two-Phase Architecture)

Processing large mbox files (e.g., 6GB Gmail exports with 200k+ emails) efficiently requires avoiding expensive operations on the vast majority of non-airline emails. The pipeline uses a two-phase approach:

**Phase 1: Fast scan.** As each email is streamed from the mbox, `extractSenderDomainFast()` performs a cheap string scan of the first 16KB of raw bytes to find the `From:` header and extract the sender domain. This is ~100x faster than a full MIME parse (postal-mime) because it skips attachment decoding, multipart handling, and character set conversion. The domain is checked against the curated airline domain set. Non-matching emails (typically 99%+) are discarded immediately. The LLM model loads in parallel during this phase.

**Phase 2: Full extraction.** Only the small set of airline-domain emails (typically a few hundred out of hundreds of thousands) undergo the expensive processing: full MIME parse via postal-mime, text extraction, and LLM inference.

The curated domain list (~185 domains) covers:

- Major airlines (130+): United, Delta, AA, Southwest, BA, Lufthansa, Emirates, Singapore Airlines, etc.
- Booking platforms (30+): Expedia, Kayak, Booking.com, Hopper, Kiwi, Trip.com, etc.
- Travel agencies (10+): Concur, Navan, TravelPerk, Amadeus, etc.
- Loyalty programs (6): MileagePlus, AAdvantage, SkyMiles, etc.

Subdomain matching is supported (e.g., `email.united.com` matches `united.com`). The tradeoff is that flights from airlines not in the domain list won't be captured.

## Local LLM Extraction

Flight data is extracted entirely by a local LLM running in the browser -- no regex heuristics, no JSON-LD scraping, no server-side AI. This is a deliberate architectural choice:

- **Privacy-first:** Email content never leaves the device. The model runs via WebGPU/WASM using WebLLM (Qwen3-4B-q4f16_1-MLC, ~2.5 GB, cached in IndexedDB after first download). The app requests durable storage via `navigator.storage.persist()` to protect the cached model from browser eviction.
- **Simpler architecture:** One extraction path instead of a cascading multi-tier pipeline. Easier to reason about, test, and maintain.
- **Stronger portfolio story:** Demonstrates real on-device AI inference, not just string matching dressed up as "AI-powered."
- **Better generalization:** An LLM handles the long tail of airline email formats naturally, whereas regex/JSON-LD only covers known patterns.

The tradeoff is speed -- LLM inference is slower per email than regex. We mitigate this with three strategies:

1. **Domain pre-filtering:** Only airline/booking-domain emails (~185 domains) are sent to the model, skipping 99%+ of the inbox.
2. **Batch extraction:** Emails are grouped in batches of 3 and processed in a single LLM call, reducing per-email overhead by ~3x.
3. **Multi-worker parallelism:** On devices with 8+ GB RAM and 8+ cores, extraction is split across two workers running in parallel.

**Extraction details:**
1. Email HTML/text is stripped to plain text and truncated to 2,000 characters (flight info is typically near the top)
2. A structured prompt asks the LLM to return JSON with `origin`, `destination`, `date`, `airline`, `flightNumber`
3. The LLM runs at temperature 0.1 (near-deterministic) with max 500 tokens per email
4. Qwen3's thinking mode is suppressed via `/no_think` directive for clean JSON output; `<think>` tags are stripped as a safety net
5. Extracted IATA codes are validated against the airport database (5,500+ airports) -- invalid codes are rejected to catch hallucinations
6. All extracted flights receive a confidence score of 0.85

## Deduplication Strategy

The same flight generates multiple emails (confirmation, itinerary update, check-in, boarding pass). Dedup uses:

- **Primary key:** normalized flight number + date (e.g., `UA1234-2024-01-15`)
- **Fallback key:** origin + destination + date (when flight number is missing)
- **Conflict resolution:** keep the higher-confidence extraction as base, fill missing fields from the lower-confidence duplicate
- **Output:** sorted by date ascending

Flight number normalization strips spaces and uppercases: `"ua 1234"` -> `"UA1234"`.

## Application State Machine

```
landing ──▶ parsing ──▶ reveal ──▶ results
   ▲                                  │
   └──────── "Start Over" ───────────┘
```

| State | Screen | Trigger |
|-------|--------|---------|
| `landing` | Landing page (hero, preview, privacy sections). If cached flights exist, a top banner offers "View Dashboard". | Initial load or reset |
| `parsing` | Progress UI with phase indicators | File uploaded via drag-and-drop or file picker |
| `reveal` | Animated reveal sequence showing key stats one-by-one | Worker returns Flight[] (skipped if zero flights) |
| `results` | Full dashboard with globe, stats, charts (skeleton loading -> staggered reveal) | Reveal sequence completes, or "View Dashboard" from cache |

On "Start Over", the current worker is terminated, all extraction workers are terminated, a fresh worker is spawned, IndexedDB is cleared, and a generation counter ensures stale messages from the old worker are ignored.

## Persistence

Flight data is persisted in **IndexedDB** (via the `idb` library) so users don't re-parse every visit.

### Storage Schema

```
IndexedDB: "flightwrapped" (v1)
  └── Object Store: "sync"
       └── Key: "default"
            └── Value: {
                  flights: Flight[],
                  lastImportAt: string   // ISO timestamp
                }
```

### Re-import Flow

1. User clicks "Import" (dashboard header) or uploads a file (landing page)
2. `File` objects are sent directly to the Web Worker (structured-cloneable, no `FileReader` needed)
3. The worker streams each file via `File.stream()` through the two-phase pipeline (fast scan + LLM extraction)
4. New flights are extracted, merged with existing cached flights, deduplicated, and persisted
5. The merged result replaces the cached data

## Profiler System

An opt-in pipeline profiler measures timing for each processing step, toggled via the stopwatch icon in the top-right nav.

### Two-Tier Profiling

```
┌─────────────────────────────────────────────────────────┐
│  MboxProfiler (pipeline-level)                          │
│                                                         │
│  pipeline-total ─────────────────────────────────────   │
│    ├── model-load ──────────                            │
│    ├── fast-scan ────────────────                       │
│    │     ├── file-0-stream ──────                       │
│    │     └── file-1-stream ──────                       │
│    ├── extract-all ──────────────────────               │
│    └── dedup ──                                         │
│                                                         │
│  Each segment: { name, startMs, endMs, durationMs }     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  EmailProfiler (per-email)                              │
│                                                         │
│  For each email:                                        │
│    index, subject, domain, totalMs                      │
│    ├── domain-filter  (Phase 1, filtered emails)        │
│    ├── normalize      (Phase 2, MIME parse)             │
│    └── llm-extract    (Phase 2, LLM inference)          │
│    filteredOut: boolean                                  │
│    flightsFound: number                                 │
└─────────────────────────────────────────────────────────┘

ProfilerReport (aggregated):
  mboxSegments[], emails[], totalMs
  summary: {
    totalEmails, filteredEmails, processedEmails,
    totalFlightsExtracted, avgNormalizeMs,
    avgDomainFilterMs, avgLlmMs, avgDedupMs
  }
```

## Stats Engine

All stat calculations run on the main thread (memoized with `useMemo`) after the worker returns flights:

### Core Stats (`calculateStats`)

| Metric | How it's calculated |
|--------|-------------------|
| Total flights | Count of Flight[] |
| Total miles | Sum of Haversine distances between origin/destination airports |
| Unique airports | Set of all origin + destination IATA codes |
| Unique cities/countries | Looked up from airport database |
| Unique airlines | Distinct airline names |
| Airline breakdown | `Record<airline, count>` |
| Most flown route | Undirected route key (`JFK-LAX = LAX-JFK`) with highest count |
| Most visited airport | Airport appearing most as origin or destination |
| Busiest month | `YYYY-MM` with highest flight count |
| First/last flight | Min/max by date |
| Longest/shortest route | Max/min Haversine distance |
| Domestic ratio | Fraction of flights where origin and destination are in the same country |
| Estimated hours | `totalMiles / 500` (assuming 500 mph average cruise speed) |
| CO2 tonnes | `totalMiles * 0.000255` (EPA emission factor) |
| Flights by year/month | Grouped counts |

### Fun Stats (`calculateFunStats`)

| Metric | Formula |
|--------|---------|
| Earth orbits | `totalMiles / 24,901` |
| Moon percentage | `(totalMiles / 238,900) * 100` |
| Days in air | `estimatedHours / 24` |
| Speed comparison | `totalMiles / (estimatedHours * 3.1)` (vs walking at 3.1 mph) |
| Distance label | Human-readable milestone (e.g., "enough to circle the Earth!") |

### Insights (`generateInsights`)

9 conditional insights, each with a trigger:

| Insight | Condition |
|---------|-----------|
| Weekend Warrior | >50% flights on Fri/Sat/Sun |
| Loyalty King | One airline has >60% of flights |
| Globe Trotter | 5+ unique countries |
| Domestic Flyer | >80% domestic flights |
| International Jet-Setter | >50% international flights |
| Frequent Flyer | 20+ flights in any single year |
| Seasonal Traveler | >40% flights in one quarter |
| Hub Hugger | >30% flights through one airport |
| Coast to Coast | Both US east and west coast airports visited |

### Archetypes (`determineArchetype`)

6 archetypes evaluated in priority order (first match wins):

| Archetype | Condition |
|-----------|-----------|
| The Commuter | Most flown route is >40% of total flights |
| The Explorer | 10+ unique airports, no single route >20% |
| The Road Warrior | 30+ total flights |
| The Long Hauler | Average distance >2,000 miles |
| The Weekender | >60% weekend flights and <15 total |
| The Occasional Flyer | Default fallback |

## Component Architecture

```
src/
├── main.tsx                          # React 19 entry point
├── App.tsx                           # State machine + multi-worker coordinator
├── index.css                         # Tailwind + custom animations
├── hooks/
│   └── useCountUp.ts                 # Number counter animation hook
├── worker/
│   ├── parser.worker.ts              # Web Worker: scan + extract + dedup pipeline
│   ├── extract.ts                    # Domain filter + LLM extraction entry
│   ├── dedup.ts                      # Flight deduplication (3-tier: flight#, route, codeshare)
│   └── extractors/
│       └── llm.ts                    # Qwen3-4B engine: single + batch extraction, IATA validation
├── lib/
│   ├── types.ts                      # All TypeScript interfaces + worker message types
│   ├── capabilities.ts               # Device capability detection (multi-worker eligibility)
│   ├── airports.ts                   # Airport DB (5,500+), Haversine distance
│   ├── domains.ts                    # ~185 airline/booking domains
│   ├── mbox-parser.ts               # Streaming .mbox parser (constant memory)
│   ├── storage.ts                    # IndexedDB persistence (idb) -- flights, import timestamp
│   ├── email-normalizer.ts           # Raw MIME -> NormalizedEmail (postal-mime) + fast domain extractor
│   ├── profiler.ts                   # Pipeline timing profiler (mbox-level + per-email segments)
│   ├── stats.ts                      # Flight statistics (18+ metrics)
│   ├── funStats.ts                   # Fun comparisons (Earth orbits, Moon %)
│   ├── insights.ts                   # 9 conditional personal insights
│   ├── archetypes.ts                 # 6 flyer archetypes
│   ├── archetypeColors.ts            # Per-archetype color palettes
│   ├── icons.ts                      # String token -> emoji lookup map
│   └── eval.ts                       # Precision/recall evaluation framework
├── data/
│   └── airports.json                 # Airport database source
├── components/
│   ├── InputScreen.tsx               # Landing page orchestrator (cached data banner)
│   ├── MboxUpload.tsx                # File upload component (drag-and-drop + click)
│   ├── ParsingProgress.tsx           # Progress UI during extraction
│   ├── ProfilerOverlay.tsx           # Dev profiler overlay (toggle, mbox pipeline, per-email timings)
│   ├── ErrorBoundary.tsx             # React error boundary around dashboard
│   ├── landing/
│   │   ├── HeroSection.tsx           # Full-screen hero: globe bg, headline, CTAs, privacy badges
│   │   ├── HeroGlobe.tsx             # Decorative 3D globe (lazy-loaded)
│   │   └── demoFlights.ts            # 50 sample flights for demo mode (28 airports, 18 airlines)
│   └── dashboard/
│       ├── Dashboard.tsx             # Dashboard layout with skeleton loading + year filter
│       ├── RevealSequence.tsx        # Animated reveal showing key stats one-by-one
│       ├── DashboardHeader.tsx       # Sticky header: logo, archetype pill, import button, reset
│       ├── GlobePanel.tsx            # Globe container (debounced ResizeObserver + lazy)
│       ├── GlobeInner.tsx            # react-globe.gl with arcs + airport dots
│       ├── StatsGrid.tsx             # 8-10 stat cards with count-up animation
│       ├── FunStatsRow.tsx           # 3-4 fun comparison pills + distance label
│       ├── InsightsRow.tsx           # Horizontal-scroll insight cards (gradient fade edge)
│       ├── ChartsRow.tsx             # Chart container
│       ├── TimelineChart.tsx         # SVG bar chart (flights by month)
│       ├── AirlineDonut.tsx          # SVG donut chart (airline breakdown)
│       └── FlightList.tsx            # Sortable, paginated flight table (empty state)
└── __tests__/
    ├── llm-parsing.test.ts           # JSON extraction, date parsing, HTML stripping (33 tests)
    ├── stats.test.ts                 # Stats calculation, fun stats, insights, archetypes (31 tests)
    ├── stats-edge-cases.test.ts      # Empty dates, zero miles, archetype thresholds (23 tests)
    ├── dedup.test.ts                 # Flight number normalization, merge, edge cases (18 tests)
    ├── eval.test.ts                  # Precision/recall, matching, field accuracy (16 tests)
    ├── demoFlights.test.ts           # IATA validation, data integrity, pipeline smoke (16 tests)
    ├── llm-real.test.ts              # Real-world LLM output parsing (16 tests)
    ├── types.test.ts                 # Type contract compliance (11 tests)
    ├── extraction.test.ts            # Extraction pipeline + dedup integration (11 tests)
    ├── airports.test.ts              # Airport lookups, IATA validation, Haversine distance (11 tests)
    ├── email-normalizer-edge.test.ts # ArrayBuffer input, batch processing, missing headers (9 tests)
    ├── dashboard.test.tsx            # Dashboard component rendering (9 tests)
    ├── email-normalizer.test.ts      # MIME parsing, multipart, fast domain extractor (9 tests)
    ├── domains.test.ts               # Domain whitelist coverage, case sensitivity (7 tests)
    ├── gmail.test.ts                 # Airline domain relevance (5 tests)
    ├── extract-filter.test.ts        # Domain filter gating LLM extraction (5 tests)
    ├── archetypes.test.ts            # Archetype determination logic (4 tests)
    ├── funStats.test.ts              # Fun stat calculations (4 tests)
    ├── icons.test.ts                 # Icon mapping (2 tests)
    └── worker.test.ts                # Worker message type shape (1 test)
```

## Landing Page

A single full-screen hero section with a rotating 3D globe background (lazy-loaded, 25-35% opacity), animated gradient headline ("How far have you flown?"), file upload CTA + "Try with sample data", privacy badge ("100% private. Your emails never leave your device"), and attribution box. 50 demo flights (28 airports, 21 countries, 18 airlines) spanning 2020-2025 power the sample data mode.

### Visual Design System

- **Background:** `gray-950` (near-black) throughout
- **Cards:** `bg-gray-900` with `border-gray-800` borders, flat (no rounded corners)
- **Buttons:** Flat (no border-radius), glass-card style badges
- **Text:** White headlines with gradient (`from-white to-gray-500`), `gray-400` body, `gray-500` captions
- **Links:** `text-gray-300 hover:text-white` throughout
- **Accents:** Blue (`#3b82f6`) primary, purple secondary
- **Archetype colors:** Per-archetype palettes (amber, emerald, red, purple, cyan, blue)
- **Animations:** CSS keyframes only (no animation library). `heroEntrance` stagger on landing, skeleton shimmer placeholders on dashboard, staggered fade-in with `animationDelay`.
- **Accessibility:** `prefers-reduced-motion` disables all animations, `aria-hidden` on decorative globes

## Security

- **CSP:** Content Security Policy meta tag restricts scripts to `'self'`, allows connections only to Hugging Face (for model download)
- **Referrer Policy:** `no-referrer` meta tag prevents leaking URLs
- **Durable storage:** `navigator.storage.persist()` deferred until user uploads a file; result is logged
- **IndexedDB data scope:** Only extracted flight data and import timestamp are persisted. No email content, no raw MIME data is ever stored. `clearAllData()` wipes everything on "Start Over".
- **No external API calls:** The app never connects to email accounts. All email data comes from user-uploaded files.

## Testing

250 tests across 21 test files, run with Vitest. A pre-commit git hook runs the full suite + TypeScript type-check on every commit.

## Build & Deployment

- **Build:** `tsc -b && vite build` -- TypeScript type-check then Vite production bundle
- **Output:** `dist/` with code-split chunks (globe lazy-loaded separately, react-vendor split out)
- **Build target:** `es2022` (matches WebGPU-capable browsers)
- **Sourcemaps:** Hidden (generated but not linked in output)
- **Base path:** Conditional -- `/FlightWrapped/` on GitHub Pages, `/` otherwise (via `GITHUB_PAGES` env var)
- **CI/CD:** GitHub Actions deploys to GitHub Pages on push to `main`, with `npm audit` check
- **PWA:** `vite-plugin-pwa` with Workbox, precaches app shell + textures, runtime caches model downloads
- **Path alias:** `@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.app.json`)

## Known Limitations

- **WebGL not disposed on unmount.** Cycling between landing and results accumulates GPU memory. Browser limit is 8-16 WebGL contexts. Needs `useEffect` cleanup calling the globe destructor or `renderer.dispose()`.
- **No COOP/COEP headers.** WebGPU requires `crossOriginIsolated = true`. Without COOP/COEP (GitHub Pages doesn't support custom headers), Chrome falls back to WASM CPU inference (slower). Could use `coi-serviceworker` pattern.
- **airports.json in main chunk.** The entire airport database loads on first page view. Only needed when flights exist. Could use dynamic import.
- **WCAG contrast.** Some `text-gray-500` and `text-gray-600` elements may not meet WCAG AA contrast ratios on dark backgrounds.
- **Multi-worker memory.** Each worker loads its own LLM instance (~2.5 GB). Two workers require ~5 GB for models alone. The 8 GB memory gate in `detectCapabilities()` may be tight on some devices. Monitor for OOM issues.

## LLM Evals

The `evals/` directory contains a comprehensive evaluation suite for the flight extraction pipeline, built with [promptfoo](https://promptfoo.dev). Evals run locally against [Ollama](https://ollama.com) with Llama 3.2 3B (or any compatible model).

### Eval Architecture

```
evals/
├── promptfooconfig.yaml          # Main config (providers, prompts, test suites)
├── promptfooconfig.batch.yaml    # Batch extraction config
├── prompts/                      # Prompt templates (mirroring llm.ts)
│   ├── single-extract.txt
│   └── batch-extract.txt
├── datasets/                     # Ground truth datasets (YAML)
│   ├── single-flight.yaml        # 10 cases: one flight per email
│   ├── multi-flight.yaml         # 8 cases: round trips, connections
│   ├── no-flight.yaml            # 8 cases: no actual flights
│   ├── edge-cases.yaml           # 8 cases: dates, languages, noise
│   ├── airline-formats.yaml      # 8 cases: different email formats
│   └── batch-extraction.yaml     # 4 cases: 3-email batch extraction
├── assertions/                   # Custom assertion modules (ESM)
│   ├── flight-assertions.mjs     # Single-email ground truth check
│   └── batch-assertions.mjs      # Batch ground truth check
└── scripts/
    └── run-evals.sh              # Convenience runner
```

### What's Tested

| Category | Cases | Description |
|----------|-------|-------------|
| Single Flight | 10 | One flight per email across diverse airlines |
| Multi-Flight | 8 | Round trips, multi-city, connections |
| No Flight | 8 | Marketing, loyalty, cancellation emails |
| Edge Cases | 8 | Date formats, languages, truncation, noise |
| Airline Formats | 8 | Table, bullet, inline, receipt styles |
| Batch | 4 | 3-email batch extraction accuracy |

### Assertions

Every test checks: valid JSON, `flights` array schema, IATA code validity (3-letter uppercase), date format (`YYYY-MM-DD`), and ground truth accuracy (precision/recall >= 0.8). Scoring uses F1 = 2*P*R/(P+R).

### Running

```bash
ollama pull llama3.2:3b       # one-time setup
cd evals && npx promptfoo eval
npx promptfoo view            # HTML report
```

See [evals/README.md](evals/README.md) for full documentation.

## Future Enhancements

- **Chart interactivity.** Hover tooltips on timeline bars and donut segments (e.g., "March 2023: 4 flights").
- **Globe interactivity.** `react-globe.gl` supports `onArcClick`, `onPointHover`. Clicking an arc could highlight the route in FlightList.
- **Hero globe demo arcs.** Render demo flight arcs on the hero globe background.
- **Story mode.** Wrapped-style vertical card sequence through top 5 highlights.
- **Globe auto-fly.** Zoom to most-visited airport on dashboard mount.
- **Background model download.** Background Fetch API for the 2.5 GB LLM model.
- **Install prompt.** Deferred `beforeinstallprompt` after results view.
- **App.tsx state machine tests.** No tests currently cover state transitions, worker lifecycle, or error handling.
- **Full pipeline integration test.** No test exercises the full path: email -> normalize -> worker -> extract -> stats -> render.
- **Private jet / charter support.** Private/charter flights don't send standardized confirmation emails from domains in our list. Could add major charter companies (NetJets, Wheels Up, VistaJet) but their formats are highly varied.
- **Dynamic confidence scoring.** Currently all LLM-extracted flights receive a static confidence score of 0.85. Could compute per-flight confidence based on extraction quality signals.
- **Shared model instance.** Investigate SharedArrayBuffer / COOP+COEP to share a single LLM model across workers, halving multi-worker memory.
