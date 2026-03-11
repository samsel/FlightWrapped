# FlightWrapped Architecture

## Overview

FlightWrapped is a privacy-first, browser-based flight analytics tool. Users export their Gmail via Google Takeout and upload the .mbox file. The app parses individual emails from the file, extracts flight data using a local LLM, deduplicates results, calculates stats, and displays interactive visualizations -- all in the browser with zero server dependency. No API access to email accounts is ever made.

## Why Google Takeout Instead of Gmail OAuth

FlightWrapped was originally designed with Gmail OAuth PKCE for direct API access. We pivoted to Google Takeout file upload because:

1. **Gmail `gmail.readonly` is a restricted scope.** Google requires apps using restricted scopes to pass a CASA Tier 2 security assessment ($4,500--$75,000+) before any user beyond the developer's test accounts can authenticate. This is prohibitive for a portfolio/open-source project.
2. **Truly zero external API calls.** The original OAuth approach required browser-to-Gmail-API calls. With Takeout, the only external network calls are for the LLM model download (Hugging Face CDN). Email data never leaves the device even temporarily.
3. **Drastically simpler architecture.** Eliminated: OAuth PKCE flow, code verifier/state management, sessionStorage for redirect, token exchange, Gmail API search/batch-fetch, rate limiting, retry logic with exponential backoff, callback URL handling, CSP allowlisting for Google domains. The entire `gmail.ts` module (~300 lines) was replaced by a ~20-line mbox parser + a file input component.
4. **Stronger privacy claim.** "We never connect to your email account" vs "We connect read-only."

## Data Flow

```
+------------------------------------------------------------------+
|                        USER'S BROWSER                            |
|                                                                  |
|  +---------+     +----------+     +--------------------------+   |
|  |  React   |--> | FileReader|--> |      Web Worker          |   |
|  |  App     |    | (.mbox)  |     |                          |   |
|  |          |    +----------+     |  +--------------------+  |   |
|  |          |         |           |  |  Mbox Parser       |  |   |
|  |          |         |           |  |  (split on "From ")|  |   |
|  |          |         |           |  +--------+-----------+  |   |
|  |          |         |           |           |              |   |
|  |          |    ArrayBuffer      |  +--------v-----------+  |   |
|  |          |    (transferable)   |  |  Email Normalizer  |  |   |
|  |          |         |           |  |  (postal-mime)     |  |   |
|  |          |         |           |  +--------+-----------+  |   |
|  |          |         |           |           |              |   |
|  |          |         |           |  +--------v-----------+  |   |
|  |          |         |           |  |  Domain Filter     |  |   |
|  |          |         |           |  |  (~190 domains)    |  |   |
|  |          |         |           |  +--------+-----------+  |   |
|  |          |         |           |           |              |   |
|  |          |         |           |  +--------v-----------+  |   |
|  |          |         +---------->|  |  Local LLM         |  |   |
|  |          |                     |  |  Phi-3.5-mini      |  |   |
|  |          |                     |  |  via WebLLM        |  |   |
|  |          |                     |  +--------+-----------+  |   |
|  |          |                     |           |              |   |
|  |          |                     |  +--------v-----------+  |   |
|  |          |                     |  |  IATA Validation   |  |   |
|  |          |                     |  |  (5,500+ airports) |  |   |
|  |          |                     |  +--------+-----------+  |   |
|  |          |                     |           |              |   |
|  |          |                     |  +--------v-----------+  |   |
|  |          |                     |  |  Deduplication     |  |   |
|  |          |                     |  +--------+-----------+  |   |
|  |          |<--- Flight[] ------+           |              |   |
|  |          |                     |           v              |   |
|  |          |                     |    Deduplicated          |   |
|  |          |                     |    Flight[]              |   |
|  |          |                     +--------------------------+   |
|  |          |                                                    |
|  |          +-------> +--------------------+                     |
|  |          |         |  IndexedDB (idb)   |                     |
|  |          |<------- |  flights, import   |                     |
|  |          |         |  timestamp         |                     |
|  |          |         +--------------------+                     |
|  |          |                                                    |
|  |          v                                                    |
|  |  +----------------------------------------+                  |
|  |  |  Stats Engine (main thread, memoized)  |                  |
|  |  |                                        |                  |
|  |  |  calculateStats()    -> FlightStats    |                  |
|  |  |  calculateFunStats() -> FunStats       |                  |
|  |  |  generateInsights()  -> Insight[]      |                  |
|  |  |  determineArchetype()-> Archetype      |                  |
|  |  +----------------------------------------+                  |
|  |          |                                                    |
|  |          v                                                    |
|  |  +----------------------------------------+                  |
|  |  |  Dashboard                             |                  |
|  |  |  3D Globe . Stats . Charts . Insights  |                  |
|  |  |  Flight List                           |                  |
|  |  +----------------------------------------+                  |
|  +---------+                                                    |
+------------------------------------------------------------------+
```

## Mbox Parsing

The `.mbox` format (from Google Takeout) stores emails separated by `"From "` lines at the start of each message. The parser:

1. Splits the file text on `^From ` (regex with multiline flag)
2. Strips the envelope "From " header line from each part
3. Un-escapes `">From "` -> `"From "` in email bodies (standard mbox escaping)
4. Returns an array of `ArrayBuffer` per email for the normalization pipeline

## Application State Machine

```
landing --> parsing --> reveal --> results
   ^                                  |
   +---------- "Start Over" ---------+
```

| State | Screen | Trigger |
|-------|--------|---------|
| `landing` | Landing page (hero, preview, privacy sections). If cached flights exist, a top banner offers "View Dashboard". | Initial load or reset |
| `parsing` | Progress UI with phase indicators | File uploaded via drag-and-drop or file picker |
| `reveal` | Animated reveal sequence showing key stats one-by-one | Worker returns Flight[] (skipped if zero flights) |
| `results` | Full dashboard with globe, stats, charts (skeleton loading -> staggered reveal) | Reveal sequence completes, or "View Dashboard" from cache |

On "Start Over", the current worker is terminated, a fresh worker is spawned, IndexedDB is cleared, and a generation counter ensures stale messages from the old worker are ignored.

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
2. The .mbox file is read via `FileReader` into an `ArrayBuffer`
3. The buffer is transferred (zero-copy) to the Web Worker
4. New flights are extracted, merged with existing cached flights, deduplicated, and persisted
5. The merged result replaces the cached data

## Key Architecture Decisions

### Zero-Server / File Upload Model

We deliberately chose **no backend, no API access**. The entire app runs client-side with file upload as the only input.

**Why this is the right call:**

- **No verification barriers.** Gmail OAuth requires a CASA security assessment for restricted scopes. File upload requires nothing.
- **No token management.** No OAuth flow, no PKCE, no session state, no token expiry.
- **No server means no server to attack.** No SSRF, no credential leaks, no infrastructure to maintain.
- **Strongest possible privacy.** We never connect to the user's email account at all.
- **One-shot usage pattern.** Users export once, upload once, get results. No ongoing API connection needed.

### Pure Local LLM Extraction

Flight data is extracted entirely by a local LLM running in the browser -- no regex heuristics, no JSON-LD scraping, no server-side AI. This is a deliberate architectural choice:

- **Privacy-first:** Email content never leaves the device. The model runs via WebGPU/WASM using WebLLM (Phi-3.5-mini-instruct-q4f16_1-MLC, ~2 GB, cached in IndexedDB after first download). The app requests durable storage via `navigator.storage.persist()` to protect the cached model from browser eviction.
- **Simpler architecture:** One extraction path instead of a cascading multi-tier pipeline. Easier to reason about, test, and maintain.
- **Stronger portfolio story:** Demonstrates real on-device AI inference, not just string matching dressed up as "AI-powered."
- **Better generalization:** An LLM handles the long tail of airline email formats naturally, whereas regex/JSON-LD only covers known patterns.

The tradeoff is speed -- LLM inference is slower per email than regex. We mitigate this by pre-filtering emails against a curated airline/booking domain list (~190 domains) so only relevant emails are sent to the model.

**Extraction details:**
1. Email HTML/text is stripped to plain text and truncated to 2,000 characters (flight info is typically near the top)
2. A structured prompt asks the LLM to return JSON with `origin`, `destination`, `date`, `airline`, `flightNumber`
3. The LLM runs at temperature 0.1 (near-deterministic) with max 500 tokens
4. Extracted IATA codes are validated against the airport database (5,500+ airports) -- invalid codes are rejected to catch hallucinations
5. All extracted flights receive a confidence score of 0.85

### Domain Pre-filtering

Before any LLM inference, emails are filtered by sender domain against a curated list of ~190 domains covering:

- Major airlines (130+): United, Delta, AA, Southwest, BA, Lufthansa, Emirates, Singapore Airlines, etc.
- Booking platforms (30+): Expedia, Kayak, Booking.com, Google Flights, Hopper, Kiwi, Trip.com, etc.
- Travel agencies (10+): Concur, Navan, TravelPerk, Amadeus, etc.
- Loyalty programs (6): MileagePlus, AAdvantage, SkyMiles, etc.

This prevents running the LLM on irrelevant emails (newsletters, receipts, etc.) and dramatically reduces processing time. The tradeoff is that flights from airlines not in the domain list won't be captured.

### Deduplication Strategy

The same flight generates multiple emails (confirmation, itinerary update, check-in, boarding pass). Dedup uses:

- **Primary key:** normalized flight number + date (e.g., `UA1234-2024-01-15`)
- **Fallback key:** origin + destination + date (when flight number is missing)
- **Conflict resolution:** keep the higher-confidence extraction as base, fill missing fields from the lower-confidence duplicate
- **Output:** sorted by date ascending

Flight number normalization strips spaces and uppercases: `"ua 1234"` -> `"UA1234"`.

### Web Worker Pipeline

All mbox parsing, email normalization, and LLM extraction runs in a Web Worker to keep the UI responsive. The LLM model is pre-warmed on app mount (download begins immediately, not after the file is uploaded). The .mbox file ArrayBuffer is transferred to the worker as a zero-copy transferable. Communication uses a typed message protocol.

```
Main Thread                          Worker
    |                                   |
    +-- { type: 'init-llm' } ---------->|  (pre-warm on mount)
    |                                   |
    |  [User uploads .mbox file]        |
    +-- { type: 'parse-mbox',          |
    |        data: ArrayBuffer } ------>|
    |                                   +-- split mbox into emails
    |                                   +-- normalize each (postal-mime)
    |                                   +-- filter by domain
    |<-- { type: 'progress' } ---------+
    |                                   +-- extract per email (LLM)
    |<-- { type: 'progress' } ---------+
    |                                   +-- deduplicate
    |<-- { type: 'result', Flight[] } -+
    |                                   |
```

Progress phases: `loading-model` -> `scanning` -> `extracting` -> `deduplicating` -> `done`

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
+-- main.tsx                          # React 19 entry point
+-- App.tsx                           # State machine: landing -> parsing -> results
+-- index.css                         # Tailwind + custom animations
+-- hooks/
|   +-- useCountUp.ts                 # Number counter animation hook
+-- worker/
|   +-- parser.worker.ts              # Web Worker orchestrator (mbox parse + normalize + extract + dedup)
|   +-- extract.ts                    # Domain filter + LLM extraction entry
|   +-- dedup.ts                      # Flight deduplication
|   +-- extractors/
|       +-- llm.ts                    # WebLLM extraction + IATA validation
+-- lib/
|   +-- types.ts                      # All TypeScript interfaces
|   +-- airports.ts                   # Airport DB (5,500+), Haversine distance
|   +-- domains.ts                    # ~190 airline/booking domains
|   +-- mbox-parser.ts               # .mbox file -> individual email ArrayBuffers
|   +-- storage.ts                    # IndexedDB persistence (idb) -- flights, import timestamp
|   +-- email-normalizer.ts           # Raw MIME -> NormalizedEmail (postal-mime)
|   +-- stats.ts                      # Flight statistics (18+ metrics)
|   +-- funStats.ts                   # Fun comparisons (Earth orbits, Moon %)
|   +-- insights.ts                   # 9 conditional personal insights
|   +-- archetypes.ts                 # 6 flyer archetypes
|   +-- archetypeColors.ts            # Per-archetype color palettes
|   +-- icons.ts                      # String token -> emoji lookup map
|   +-- eval.ts                       # Precision/recall evaluation framework
+-- data/
|   +-- airports.json                 # Airport database source
+-- components/
|   +-- InputScreen.tsx               # Landing page orchestrator (cached data banner)
|   +-- MboxUpload.tsx                # File upload component (drag-and-drop + click)
|   +-- ParsingProgress.tsx           # Progress UI during extraction
|   +-- ErrorBoundary.tsx             # React error boundary around dashboard
|   +-- landing/
|   |   +-- HeroSection.tsx           # Full-screen hero: globe bg, headline, CTAs, privacy + attribution badges
|   |   +-- HeroGlobe.tsx             # Decorative 3D globe (lazy-loaded)
|   |   +-- demoFlights.ts            # 50 sample flights for demo mode (28 airports, 18 airlines)
|   +-- dashboard/
|       +-- Dashboard.tsx             # Dashboard layout with skeleton loading + year filter
|       +-- RevealSequence.tsx        # Animated reveal sequence showing key stats one-by-one
|       +-- DashboardHeader.tsx       # Sticky header: logo, archetype pill, import button, reset
|       +-- GlobePanel.tsx            # Globe container (debounced ResizeObserver + lazy)
|       +-- GlobeInner.tsx            # react-globe.gl with arcs + airport dots
|       +-- StatsGrid.tsx             # 8-10 stat cards with count-up animation
|       +-- FunStatsRow.tsx           # 3-4 fun comparison pills + distance label
|       +-- InsightsRow.tsx           # Horizontal-scroll insight cards (gradient fade edge)
|       +-- ChartsRow.tsx             # Chart container
|       +-- TimelineChart.tsx         # SVG bar chart (flights by month)
|       +-- AirlineDonut.tsx          # SVG donut chart (airline breakdown)
|       +-- FlightList.tsx            # Sortable, paginated flight table (empty state)
+-- __tests__/
    +-- llm-parsing.test.ts           # JSON extraction, date parsing, HTML stripping (33 tests)
    +-- stats.test.ts                 # Stats calculation, fun stats, insights, archetypes (31 tests)
    +-- stats-edge-cases.test.ts      # Empty dates, zero miles, archetype thresholds (23 tests)
    +-- dedup.test.ts                 # Flight number normalization, merge, edge cases (18 tests)
    +-- eval.test.ts                  # Precision/recall, matching, field accuracy (16 tests)
    +-- demoFlights.test.ts           # IATA validation, data integrity, pipeline smoke (16 tests)
    +-- llm-real.test.ts              # Real-world LLM output parsing (16 tests)
    +-- types.test.ts                 # Type contract compliance (11 tests)
    +-- extraction.test.ts            # Extraction pipeline + dedup integration (11 tests)
    +-- airports.test.ts              # Airport lookups, IATA validation, Haversine distance (11 tests)
    +-- email-normalizer-edge.test.ts # ArrayBuffer input, batch processing, missing headers (9 tests)
    +-- dashboard.test.tsx            # Dashboard component rendering (9 tests)
    +-- domains.test.ts               # Domain whitelist coverage, case sensitivity (7 tests)
    +-- gmail.test.ts                 # Airline domain relevance (5 tests)
    +-- extract-filter.test.ts        # Domain filter gating LLM extraction (5 tests)
    +-- archetypes.test.ts            # Archetype determination logic (4 tests)
    +-- funStats.test.ts              # Fun stat calculations (4 tests)
    +-- email-normalizer.test.ts      # MIME parsing, multipart emails (3 tests)
    +-- icons.test.ts                 # Icon mapping (2 tests)
    +-- worker.test.ts                # Worker message type shape (1 test)
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

244 tests across 21 test files, run with Vitest. A pre-commit git hook runs the full suite + TypeScript type-check on every commit.

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

## Future Enhancements

- **Chart interactivity.** Hover tooltips on timeline bars and donut segments (e.g., "March 2023: 4 flights").
- **Globe interactivity.** `react-globe.gl` supports `onArcClick`, `onPointHover`. Clicking an arc could highlight the route in FlightList.
- **Hero globe demo arcs.** Render demo flight arcs on the hero globe background.
- **Story mode.** Wrapped-style vertical card sequence through top 5 highlights.
- **Globe auto-fly.** Zoom to most-visited airport on dashboard mount.
- **Background model download.** Background Fetch API for the 2 GB LLM model.
- **Install prompt.** Deferred `beforeinstallprompt` after results view.
- **App.tsx state machine tests.** No tests currently cover state transitions, worker lifecycle, or error handling.
- **Full pipeline integration test.** No test exercises the full path: email -> normalize -> worker -> extract -> stats -> render.
- **Private jet / charter support.** Private/charter flights don't send standardized confirmation emails from domains in our list. Could add major charter companies (NetJets, Wheels Up, VistaJet) but their formats are highly varied.
- **Dynamic confidence scoring.** Currently all LLM-extracted flights receive a static confidence score of 0.85. Could compute per-flight confidence based on extraction quality signals.
