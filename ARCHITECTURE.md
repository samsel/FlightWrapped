# MyFlights Architecture

## Overview

MyFlights is a privacy-first, browser-based flight analytics tool. Users connect Gmail via OAuth PKCE. The app searches for flight confirmation emails, extracts flight data using a local LLM, deduplicates results, calculates stats, and displays shareable visualizations — all in the browser with zero server dependency.

## Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                            │
│                                                                  │
│  ┌─────────┐     ┌──────────┐     ┌──────────────────────────┐  │
│  │  React   │────▶│  Gmail   │────▶│      Web Worker          │  │
│  │  App     │     │  OAuth   │     │                          │  │
│  │          │     │  PKCE    │     │  ┌────────────────────┐  │  │
│  │          │     │          │     │  │  Domain Filter     │  │  │
│  │          │     └────┬─────┘     │  │  (~220 domains)    │  │  │
│  │          │          │           │  └────────┬───────────┘  │  │
│  │          │          ▼           │           │              │  │
│  │          │     ┌──────────┐     │  ┌────────▼───────────┐  │  │
│  │          │     │ Gmail API│     │  │  Local LLM         │  │  │
│  │          │     │ (remote) │     │  │  Phi-3.5-mini      │  │  │
│  │          │     └────┬─────┘     │  │  via WebLLM        │  │  │
│  │          │          │           │  └────────┬───────────┘  │  │
│  │          │          ▼           │           │              │  │
│  │          │     ┌──────────┐     │  ┌────────▼───────────┐  │  │
│  │          │     │ postal-  │     │  │  IATA Validation   │  │  │
│  │          │     │ mime     │     │  │  (5,500+ airports) │  │  │
│  │          │     │ parser   │     │  └────────┬───────────┘  │  │
│  │          │     └────┬─────┘     │           │              │  │
│  │          │          │           │  ┌────────▼───────────┐  │  │
│  │          │          └──────────▶│  │  Deduplication     │  │  │
│  │          │                      │  └────────┬───────────┘  │  │
│  │          │◀─────── Flight[] ────┤           │              │  │
│  │          │                      │           ▼              │  │
│  │          │                      │    Deduplicated          │  │
│  │          │                      │    Flight[]              │  │
│  │          │                      └──────────────────────────┘  │
│  │          │                                                    │
│  │          ▼                                                    │
│  │  ┌────────────────────────────────────────┐                  │
│  │  │  Stats Engine (main thread, memoized)  │                  │
│  │  │                                        │                  │
│  │  │  calculateStats()    → FlightStats     │                  │
│  │  │  calculateFunStats() → FunStats        │                  │
│  │  │  generateInsights()  → Insight[]       │                  │
│  │  │  determineArchetype()→ Archetype       │                  │
│  │  └────────────────────────────────────────┘                  │
│  │          │                                                    │
│  │          ▼                                                    │
│  │  ┌────────────────────────────────────────┐                  │
│  │  │  Dashboard                             │                  │
│  │  │  3D Globe · Stats · Charts · Insights  │                  │
│  │  │  Flight List · Share Card (PNG export) │                  │
│  │  └────────────────────────────────────────┘                  │
│  └─────────┘                                                    │
└──────────────────────────────────────────────────────────────────┘
```

## Application State Machine

```
landing ──▶ parsing ──▶ results
   ▲                       │
   └───── "Start Over" ────┘
```

| State | Screen | Trigger |
|-------|--------|---------|
| `landing` | Landing page (hero, preview, privacy sections) | Initial load or reset |
| `parsing` | Progress UI with phase indicators | Gmail OAuth callback or demo click |
| `results` | Full dashboard with globe, stats, charts | Worker returns Flight[] |

## Key Architecture Decisions

### Zero-Server / No BFF

We deliberately chose **no backend-for-frontend (BFF)**. The entire app runs client-side.

**Why this is the right call:**

- **OAuth PKCE was designed for this.** Google explicitly supports "JavaScript web application" credentials — public client, no secret, PKCE-protected. The security model assumes the client is untrusted. A BFF wrapping this flow adds complexity without meaningful security gain.
- **Token lives only in memory.** The Gmail access token is stored in React state — never persisted to localStorage, sessionStorage, cookies, or IndexedDB. Tab close = token gone. This is actually more secure than a BFF with httpOnly cookies, which persist across sessions and are vulnerable to CSRF.
- **Minimal, read-only scope.** `gmail.readonly` — the token can't send, delete, or modify anything. Worst case if somehow intercepted: someone reads emails for the token's short lifetime (~1 hour).
- **No server means no server to attack.** No SSRF, no credential leaks from env vars, no server compromise, no infrastructure to maintain/patch/monitor. The attack surface is genuinely smaller.
- **One-shot usage pattern.** Users analyze once and get results. No long-lived sessions, no token refresh needed, no server-side state to manage.

**Where a BFF would matter (and why it doesn't here):**

| Concern | BFF helps when... | Our situation |
|---|---|---|
| Client secret | You need a confidential client | PKCE eliminates this need |
| Token storage | You want httpOnly cookies | Memory-only is already better |
| Token refresh | You need long-lived sessions | We don't — one-shot analysis |
| Rate limiting | You need to protect API keys | Gmail quota is per-user via their token |
| Data aggregation | Server joins multiple APIs | We only hit Gmail |

**Note on `sessionStorage` for PKCE code verifier:** The code verifier is stored in `sessionStorage` briefly during the OAuth redirect. This is necessary since the page reloads. `sessionStorage` is accessible to any JS on the same origin — if third-party scripts were ever added, they could theoretically read it during the brief redirect window. Non-issue for this project, but worth documenting.

### Pure Local LLM Extraction

Flight data is extracted entirely by a local LLM running in the browser — no regex heuristics, no JSON-LD scraping, no server-side AI. This is a deliberate architectural choice:

- **Privacy-first:** Email content never leaves the device. The model runs via WebGPU/WASM using WebLLM (Phi-3.5-mini-instruct-q4f16_1-MLC, ~2GB, cached in IndexedDB after first download).
- **Simpler architecture:** One extraction path instead of a cascading multi-tier pipeline. Easier to reason about, test, and maintain.
- **Stronger portfolio story:** Demonstrates real on-device AI inference, not just string matching dressed up as "AI-powered."
- **Better generalization:** An LLM handles the long tail of airline email formats naturally, whereas regex/JSON-LD only covers known patterns.

The tradeoff is speed — LLM inference is slower per email than regex. We mitigate this by pre-filtering emails against a curated airline/booking domain list (~220 domains) so only relevant emails are sent to the model.

**Extraction details:**
1. Email HTML/text is stripped to plain text and truncated to 2,000 characters (flight info is typically near the top)
2. A structured prompt asks the LLM to return JSON with `origin`, `destination`, `date`, `airline`, `flightNumber`
3. The LLM runs at temperature 0.1 (near-deterministic) with max 500 tokens
4. Extracted IATA codes are validated against the airport database (5,500+ airports) — invalid codes are rejected to catch hallucinations
5. All extracted flights receive a confidence score of 0.85

### Domain Pre-filtering

Before any LLM inference, emails are filtered by sender domain against a curated list of ~220 domains covering:

- Major airlines (130+): United, Delta, AA, Southwest, BA, Lufthansa, Emirates, Singapore Airlines, etc.
- Booking platforms (30+): Expedia, Kayak, Booking.com, Google Flights, Hopper, Kiwi, Trip.com, etc.
- Travel agencies (10+): Concur, Navan, TravelPerk, Amadeus, etc.
- Loyalty programs (6): MileagePlus, AAdvantage, SkyMiles, etc.

This prevents running the LLM on irrelevant emails (newsletters, receipts, etc.) and dramatically reduces processing time. The tradeoff is that flights from airlines not in the domain list won't be captured.

### Gmail Search Strategy

The Gmail API is queried with a targeted search combining:
- Sender domains of top 25 airlines and 3 major booking sites
- Subject keywords: `flight`, `boarding`, `itinerary`, `reservation`, `e-ticket`, `confirmation`
- Results paginated at 500 per page

Messages are batch-fetched in groups of 100 with random jitter between batches to respect rate limits. A retry mechanism with exponential backoff handles 429/5xx responses, honoring `Retry-After` headers.

### Deduplication Strategy

The same flight generates multiple emails (confirmation, itinerary update, check-in, boarding pass). Dedup uses:

- **Primary key:** normalized flight number + date (e.g., `UA1234-2024-01-15`)
- **Fallback key:** origin + destination + date (when flight number is missing)
- **Conflict resolution:** keep the higher-confidence extraction as base, fill missing fields from the lower-confidence duplicate
- **Output:** sorted by date ascending

Flight number normalization strips spaces and uppercases: `"ua 1234"` → `"UA1234"`.

### Web Worker Pipeline

All email parsing and LLM extraction runs in a Web Worker to keep the UI responsive. Communication uses a typed message protocol:

```
Main Thread                          Worker
    │                                   │
    ├── { type: 'parse-emails' } ──────▶│
    │                                   ├── loading-model (progress)
    │◀── { type: 'progress' } ─────────┤
    │                                   ├── extracting (progress per email)
    │◀── { type: 'progress' } ─────────┤
    │                                   ├── deduplicating (progress)
    │◀── { type: 'progress' } ─────────┤
    │                                   ├── done
    │◀── { type: 'result', Flight[] } ─┤
    │                                   │
```

Progress phases: `loading-model` → `scanning` → `extracting` → `deduplicating` → `done`

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
├── App.tsx                           # State machine: landing → parsing → results
├── index.css                         # Tailwind + custom animations
├── worker/
│   ├── parser.worker.ts              # Web Worker orchestrator
│   ├── extract.ts                    # Extraction pipeline entry
│   ├── dedup.ts                      # Flight deduplication
│   └── extractors/
│       └── llm.ts                    # WebLLM extraction + IATA validation
├── lib/
│   ├── types.ts                      # All TypeScript interfaces
│   ├── airports.ts                   # Airport DB (5,500+), Haversine distance
│   ├── domains.ts                    # ~220 airline/booking domains
│   ├── gmail.ts                      # OAuth PKCE, search, batch fetch, retry
│   ├── email-normalizer.ts           # Raw MIME → NormalizedEmail (postal-mime)
│   ├── stats.ts                      # Flight statistics (18+ metrics)
│   ├── funStats.ts                   # Fun comparisons (Earth orbits, Moon %)
│   ├── insights.ts                   # 9 conditional personal insights
│   ├── archetypes.ts                 # 6 flyer archetypes
│   ├── icons.ts                      # Emoji icon lookup map
│   └── eval.ts                       # Precision/recall evaluation framework
├── data/
│   └── airports.json                 # Airport database source
├── components/
│   ├── InputScreen.tsx               # Landing page orchestrator
│   ├── GmailConnect.tsx              # Google OAuth button (PKCE)
│   ├── ParsingProgress.tsx           # Progress UI during extraction
│   ├── landing/
│   │   ├── HeroSection.tsx           # Hero: globe bg, headline, CTAs
│   │   ├── HeroGlobe.tsx            # Decorative 3D globe (lazy-loaded)
│   │   ├── PreviewSection.tsx        # Sample stats with count-up animation
│   │   ├── HowItWorks.tsx           # 3-step process cards
│   │   ├── PrivacySection.tsx        # Privacy pillars + architecture diagram
│   │   ├── FinalCTA.tsx             # Bottom CTA with glow
│   │   ├── demoFlights.ts           # 46 sample flights for demo mode
│   │   ├── icons.tsx                # SVG icons (Heroicons)
│   │   ├── useInView.ts            # IntersectionObserver hook
│   │   └── useCountUp.ts           # Number counter animation hook
│   └── dashboard/
│       ├── Dashboard.tsx             # Dashboard layout orchestrator
│       ├── DashboardHeader.tsx       # Sticky header: logo, archetype, share
│       ├── GlobePanel.tsx           # Globe container (ResizeObserver + lazy)
│       ├── GlobeInner.tsx           # react-globe.gl with arcs + airport dots
│       ├── StatsGrid.tsx            # 8-card stat grid
│       ├── FunStatsRow.tsx          # 3 fun comparison pills
│       ├── InsightsRow.tsx          # Horizontal-scroll insight cards
│       ├── ChartsRow.tsx            # Chart container
│       ├── TimelineChart.tsx        # SVG bar chart (flights by month)
│       ├── AirlineDonut.tsx         # SVG donut chart (airline breakdown)
│       ├── FlightList.tsx           # Sortable, paginated flight table
│       ├── ShareButton.tsx          # PNG export trigger + modal
│       └── ShareCard.tsx            # Off-screen card rendered to PNG (1200x630)
└── __tests__/
    ├── extraction.test.ts            # Dedup + eval framework (11 tests)
    ├── domains.test.ts               # Domain whitelist (6 tests)
    ├── email-normalizer.test.ts      # MIME parsing (3 tests)
    ├── airports.test.ts              # Airport DB + distance (11 tests)
    ├── worker.test.ts                # Worker message types (1 test)
    └── stats.test.ts                 # Stats, fun stats, insights, archetypes (31 tests)
```

## Landing Page Sections

The landing page is a full-scroll, multi-section experience:

1. **Hero** — Rotating 3D globe background (lazy-loaded), animated gradient headline ("How far have you flown?"), Gmail CTA + "Try with sample data" link, privacy badge, scroll indicator
2. **Preview** — Sample stats grid with count-up number animations, fun stats pills, archetype badge, gradient-bordered card
3. **How It Works** — 3 glass cards with SVG icons and privacy notes embedded in each step
4. **Privacy** — Architecture diagram (Browser ↔ Gmail API, no server), three pillars: browser-only processing, read-only access, zero servers
5. **Final CTA** — Repeated Gmail button with radial glow, footer

### Visual Design System

- **Background:** `gray-950` (near-black) throughout
- **Cards:** Glassmorphic (`backdrop-blur + translucent bg`) or gradient-bordered (`::before` mask technique)
- **Text:** White headlines with gradient (`from-white to-gray-400`), `gray-400` body, `gray-500` captions
- **Accents:** Blue (`#3b82f6`) primary, purple secondary, emerald for privacy section
- **Animations:** CSS keyframes only (no animation library) — `heroEntrance`, `shimmer`, `glow-pulse`, `float`
- **Scroll animations:** `IntersectionObserver` via `useInView` hook, fires once per element
- **Accessibility:** `prefers-reduced-motion` disables all animations

## Testing

63 tests across 6 test files, run with Vitest:

| Test file | Tests | Coverage |
|-----------|-------|----------|
| `stats.test.ts` | 31 | Stats calculation, fun stats, insights, archetypes |
| `extraction.test.ts` | 11 | Deduplication logic, eval framework (precision/recall) |
| `airports.test.ts` | 11 | Airport lookups, IATA validation, Haversine distance |
| `domains.test.ts` | 6 | Domain whitelist coverage, case sensitivity |
| `email-normalizer.test.ts` | 3 | MIME parsing, multipart emails, edge cases |
| `worker.test.ts` | 1 | Worker message type shape |

## Build & Deployment

- **Build:** `tsc -b && vite build` — TypeScript type-check then Vite production bundle
- **Output:** `dist/` with code-split chunks (globe lazy-loaded separately)
- **Base path:** Conditional — `/myflights/` on GitHub Pages, `/` otherwise (via `GITHUB_PAGES` env var)
- **CI/CD:** GitHub Actions deploys to GitHub Pages on push to `main`
- **Path alias:** `@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.app.json`)

## Future Enhancements

### Private Jet / Charter Flight Support

Private jets won't be captured in the current implementation. Private/charter flights don't send standardized confirmation emails from domains in our list. We could add major charter companies (NetJets, Wheels Up, VistaJet, etc.) to the domain list, but their email formats are highly varied. Something to consider as a future enhancement — for now the tool targets commercial aviation.

### Dynamic Confidence Scoring

Currently all LLM-extracted flights receive a static confidence score of 0.85. A future improvement could compute per-flight confidence based on extraction quality signals (e.g., how well the JSON parsed, whether both IATA codes were found in the database, date plausibility).
