# MyFlights — Consolidated Improvement Plan

Findings from 6 expert audits: Security Advisor, QA Engineer, Senior Architect, Platform Engineer, Offline/PWA Expert, UX Designer.

---

## Tier 0: Critical / Deploy-Blocking

### 0.1 Globe textures served from CDN despite local bundling
**Source:** Platform Engineer | **Files:** `dist/assets/HeroGlobe-*.js`, `dist/assets/GlobeInner-*.js`
`import.meta.env.BASE_URL` + texture path does not survive the build — `react-globe.gl` falls back to its hardcoded jsDelivr CDN default. The local textures in `public/textures/` are never served. Contradicts the zero-external-request privacy claim.
**Fix:** Import textures as ES modules (`import earthNight from '/textures/earth-night.jpg'`) so Vite hashes and bundles them, or verify the `globeImageUrl` prop is actually used at runtime vs the library default.

### 0.2 Gmail OAuth client ID not configured in CI
**Source:** Platform Engineer | **File:** `.github/workflows/deploy.yml`
`VITE_GMAIL_CLIENT_ID` and `VITE_GMAIL_REDIRECT_URI` are not injected as env vars in the deploy workflow. The production build ships with `clientId = ''`. Gmail Connect is completely broken for real users.
**Fix:** Add GitHub Actions secrets and reference them in the workflow `env:` block.

### 0.3 Archetype icon rendered as literal string token
**Source:** QA Engineer | **Files:** `DashboardHeader.tsx:19`, `ShareCard.tsx:78`
`{archetype.icon}` renders `"briefcase"` as text instead of the emoji. `InsightsRow` correctly calls `getIcon(insight.icon)` but these two components do not.
**Fix:** Wrap with `getIcon(archetype.icon)` in both files.

---

## Tier 1: Security & Correctness Bugs

### 1.1 No `state` parameter in OAuth authorization request
**Source:** Security Advisor | **File:** `gmail.ts:47-58`
PKCE flow omits the `state` parameter entirely — opens a CSRF vector. An attacker can craft a callback URL with a malicious auth code.
**Fix:** Generate a random `state`, store in sessionStorage alongside the verifier, validate on callback before processing the code.

### 1.2 No Content Security Policy
**Source:** Security Advisor | **File:** `index.html`
No CSP header or meta tag. Any XSS has no second layer of defense. The app processes untrusted email content and renders user-derived data.
**Fix:** Add `<meta http-equiv="Content-Security-Policy">` with `script-src 'self'`, `connect-src` allowlist (googleapis, WebLLM CDN), `img-src 'self' data:`.

### 1.3 "Start Over" during parsing leaves worker running
**Source:** QA + Architect | **Files:** `App.tsx:138-143`, `App.tsx:47-61`
Worker continues processing. When it finishes, `onmessage` fires `setFlights` + `setAppState('results')`, silently navigating away from landing.
**Fix:** Either terminate and recreate the worker on reset, or add a generation counter / abort flag that the `onmessage` handler checks before applying state.

### 1.4 Zero-flight ghost state
**Source:** Architect + QA | **File:** `App.tsx:98-101`
When `messageIds.length === 0`, `appState` stays `'parsing'` with `progress.phase = 'done'`. User is stuck until they find "Try Again".
**Fix:** Transition to landing with an informational toast, or auto-transition after a short delay.

### 1.5 `handleCallback` doesn't validate `access_token`
**Source:** QA | **File:** `gmail.ts:86-88`
`data.access_token as string` — if Google returns `{"error":"invalid_grant"}`, this silently becomes `undefined`, used as Bearer token, causing 401s downstream.
**Fix:** Check `if (!data.access_token) throw new Error(data.error || 'No access token')`.

### 1.6 Double OAuth callback (StrictMode + back button)
**Source:** QA | **File:** `App.tsx:73-80`
StrictMode fires effects twice → second call finds no verifier → throws, clobbering in-flight parse. Back button replays callback with missing verifier.
**Fix:** Add a `processing` ref guard. If already processing, skip. If verifier is missing, show a user-friendly "session expired" message.

### 1.7 GmailConnect double-click corrupts PKCE verifier
**Source:** QA | **File:** `GmailConnect.tsx:8-13`
Rapid clicks call `initiateAuth()` twice, each writing a new verifier. Browser follows the second redirect but the first challenge is what Google validates against.
**Fix:** Disable the button after first click (add local loading state).

### 1.8 `batchFetchMessages` — one bad email aborts entire pipeline
**Source:** QA | **File:** `gmail.ts:200`
`Promise.all` rejects if any single fetch exhausts retries. All previously fetched emails are discarded.
**Fix:** Use `Promise.allSettled`, collect successful results, log/skip failures.

### 1.9 ShareCard year range shows "0-0" with empty dates
**Source:** QA | **File:** `ShareCard.tsx:22-29`
`Number('')` → `0`. `Math.min(...[0,0])` → `0`. Year range displays "0–0".
**Fix:** Filter out empty/zero years before computing min/max.

---

## Tier 2: Architecture & Performance

### 2.1 Move `normalizeEmails` into the Web Worker
**Source:** Architect + Platform | **Files:** `App.tsx:117`, `email-normalizer.ts`
PostalMime parsing is CPU-bound. For 500+ emails it blocks the main thread for seconds. The `RawEmail.raw` ArrayBuffer should be transferred (zero-copy) to the worker.
**Fix:** Send `RawEmail[]` to the worker, normalize inside `parser.worker.ts` before the LLM loop.

### 2.2 Three.js/WebGL not disposed on unmount — GPU memory leak
**Source:** Platform | **Files:** `GlobeInner.tsx`, `HeroGlobe.tsx`
No cleanup on unmount. Cycling landing↔results accumulates GPU memory. Browser limit is 8-16 WebGL contexts.
**Fix:** Add `useEffect` cleanup calling the globe's destructor or `renderer.dispose()`.

### 2.3 No COOP/COEP headers — WebGPU may be unavailable
**Source:** Platform | **File:** N/A (GitHub Pages doesn't support custom headers)
WebGPU requires `crossOriginIsolated = true`. Without COOP/COEP, Chrome falls back to WASM CPU inference (much slower).
**Fix:** Consider `coi-serviceworker` pattern, or document the limitation.

### 2.4 Reduce `batchFetchMessages` concurrency from 100 to 10-20
**Source:** Architect + QA + Platform | **File:** `gmail.ts:183`
100 concurrent fetches per batch reliably exhausts Gmail's per-second quota (250 units/s, 5 units per message read).
**Fix:** Reduce `BATCH_SIZE` to 10-20.

### 2.5 `airports.json` bundled in main synchronous chunk
**Source:** Platform | **File:** `airports.ts`
The entire airport database loads on first page view. Only needed when flights exist.
**Fix:** Dynamic import or serve as a static asset fetched on demand.

### 2.6 Add Vite `build` config — vendor splitting, target, sourcemaps
**Source:** Platform | **File:** `vite.config.ts`
No `build:` key. React/react-dom co-bundled with app code. Build target defaults to ES2015 (unnecessary for WebGPU-capable browsers).
**Fix:** Add `manualChunks` for react-vendor, postal-mime, html-to-image. Set `target: 'es2022'`, `sourcemap: 'hidden'`.

### 2.7 `@mlc-ai/web-llm` not in package.json
**Source:** Platform + Security | **Files:** `llm.ts:37-38`, `package.json`
Loaded at runtime via `/* @vite-ignore */` dynamic import. Not in lockfile, not auditable, not type-safe (`any` cast).
**Fix:** Add to `devDependencies` (or `dependencies`), remove `@vite-ignore`, let Vite handle the import.

### 2.8 `html-to-image` imported synchronously
**Source:** Platform | **File:** `ShareButton.tsx`
Only needed on Share click but loaded in the initial dashboard chunk.
**Fix:** Dynamic `import('html-to-image')` inside the `generate` callback.

### 2.9 Pre-warm LLM model during landing/parsing phase
**Source:** Architect | **Files:** `App.tsx`, `parser.worker.ts`
`init-llm` message exists in the protocol but is never sent. Model download (~2GB, 30-60s) only starts after emails are fetched. User watches a frozen "Loading AI model" screen.
**Fix:** Send `init-llm` to the worker on mount or after OAuth redirect, so download begins while emails are being fetched.

### 2.10 Dead code cleanup
**Source:** Architect | **Files:** `extract.ts:23-36`, `gmail.ts:262`
`extractFlightsFromEmails` (batch function) is never called — extraction loop lives in `parser.worker.ts`. `isDomainRelevant` is an unused re-export of `isAirlineDomain`.
**Fix:** Delete both.

---

## Tier 3: Security Hardening

### 3.1 Add `Referrer-Policy: no-referrer` meta tag
**Source:** Security | **File:** `index.html`

### 3.2 Defer `navigator.storage.persist()` until user initiates flow
**Source:** Security | **File:** `App.tsx:37`
Currently fires on app load, before any user intent. Firefox shows a prompt. Move to after "Connect Gmail" click.

### 3.3 Add `npm audit --audit-level=high` to CI
**Source:** Security | **File:** `.github/workflows/deploy.yml`

### 3.4 Cap `Retry-After` to 60 seconds
**Source:** Security | **File:** `gmail.ts:226`
A malicious/broken `Retry-After: 86400` would sleep for 24 hours.

### 3.5 Add `state` parameter cleanup to PKCE verifier cleanup
**Source:** Security | **File:** `gmail.ts`
Store + validate `state` alongside verifier (pairs with 1.1).

### 3.6 ResizeObserver debounce
**Source:** Platform | **Files:** `GlobePanel.tsx:19`, `HeroSection.tsx:19`
Mid-drag resize thrashes WebGL context. Add 100-200ms debounce.

---

## Tier 4: UX — High-Impact, Low-Effort

### 4.1 Animate StatsGrid numbers with `useCountUp`
**Source:** UX Designer | **Files:** `StatsGrid.tsx`, `useCountUp.ts`
Landing page preview has count-up animation; the actual dashboard does not. The real data mounts statically. Reuse the existing `useCountUp` hook.

### 4.2 Display missing high-value stats
**Source:** UX Designer | **Files:** `StatsGrid.tsx`, `FunStatsRow.tsx`
`firstFlight`, `mostFlownRoute`, `mostVisitedAirport` are computed in `FlightStats` but never shown. `speedComparison` and `distanceLabel` are computed in `FunStats` but never rendered.

### 4.3 Make Share button prominent
**Source:** UX Designer | **File:** `DashboardHeader.tsx`
Currently `text-gray-400` ghost link. This is the #1 viral action — should be a filled button with high contrast.

### 4.4 Add scroll affordance to InsightsRow
**Source:** UX Designer | **File:** `InsightsRow.tsx`
No right-edge fade or indicator that more cards exist. Add a gradient fade mask on the right edge.

### 4.5 WCAG contrast fixes
**Source:** UX Designer | **File:** `index.css`, multiple components
`text-gray-500` (~2.8:1) and `text-gray-600` (~2.1:1) fail WCAG AA on `bg-gray-900`/`bg-gray-950`. The FinalCTA trust micro-copy is the worst offender.
**Fix:** Bump gray-500 → gray-400 for body text, gray-600 → gray-500 for captions.

### 4.6 Add `aria-hidden="true"` to dashboard GlobePanel
**Source:** UX Designer | **File:** `GlobePanel.tsx`
Landing globe has it; dashboard globe does not.

### 4.7 Add Web Share API for mobile sharing
**Source:** UX + Offline | **File:** `ShareButton.tsx`
Convert data URL to Blob/File, call `navigator.share({ files: [...] })` with feature detection. Native share sheet on mobile instead of download.

### 4.8 Celebratory reveal animation
**Source:** UX Designer | **File:** `Dashboard.tsx`
No transition moment from parsing → results. Add a brief number-based reveal (full-screen stat counter, then dashboard fades in). Or at minimum, stagger the skeleton→content transition per card.

---

## Tier 5: UX — Medium Effort

### 5.1 Hero globe: increase opacity, add demo flight arcs
**Source:** UX Designer | **Files:** `HeroSection.tsx`, `HeroGlobe.tsx`
Globe at 15-25% opacity is nearly invisible. Add sample arcs from `demoFlights.ts` to make the product promise visually concrete.

### 5.2 Chart interactivity — hover tooltips
**Source:** UX Designer | **Files:** `TimelineChart.tsx`, `AirlineDonut.tsx`
No hover state on bars or donut segments. "March 2023: 4 flights" on hover would make charts actually useful.

### 5.3 Globe interactivity
**Source:** UX Designer | **File:** `GlobeInner.tsx`
`react-globe.gl` supports `onArcClick`, `onPointClick`, `onPointHover`. Clicking an arc could highlight the route in FlightList. Currently the globe is entirely passive.

### 5.4 FlightList empty state
**Source:** QA | **File:** `FlightList.tsx`
Empty `<tbody>` with no message when 0 flights. Add "No flights extracted" copy.

### 5.5 Year/date filter on dashboard
**Source:** UX Designer | **Files:** `Dashboard.tsx`, `StatsGrid.tsx`
`flightsByYear` is computed but never exposed as a filter. Users with 5+ years of data can't answer "how far did I fly in 2023?"

### 5.6 Stronger FinalCTA headline
**Source:** UX Designer | **File:** `FinalCTA.tsx`
"Ready to see your flight map?" is transactional. Shift to aspirational: "Your travel story awaits" or similar.

### 5.7 Share card improvements
**Source:** UX Designer | **File:** `ShareCard.tsx`
No URL/brand attribution, archetype text too small, no visual artwork. Add app URL, increase archetype badge size.

---

## Tier 6: PWA & Offline

### 6.1 Service worker for app shell + texture caching
**Source:** Offline Expert | **Files:** new `sw.ts`, `vite.config.ts`
Add `vite-plugin-pwa` or hand-rolled SW. Precache hashed JS/CSS chunks (`CacheFirst`), `NetworkFirst` for `index.html`, `CacheFirst` for globe textures. Enables offline landing page on revisit.

### 6.2 PWA manifest + icon PNGs
**Source:** Offline Expert | **Files:** new `public/manifest.webmanifest`, new icon PNGs
Makes app installable. Needs 192x192 and 512x512 icons. `display: standalone`, `background_color: #030712`.

### 6.3 `storage.estimate()` before model load
**Source:** Offline Expert | **File:** `llm.ts` or `parser.worker.ts`
Check available storage before attempting 2GB model download. Show warning if insufficient.

### 6.4 Log `persist()` result
**Source:** Offline Expert | **File:** `App.tsx`
Currently ignores the boolean return. If `false`, the model cache is at risk of eviction.

---

## Tier 7: Test Coverage Gaps

### 7.1 App.tsx state machine tests
**Source:** QA | Zero tests for state transitions, worker lifecycle, error handling.

### 7.2 Full pipeline integration test
**Source:** QA | No test exercises: email → normalize → worker → extract → stats → render.

### 7.3 Gmail OAuth functional tests
**Source:** QA | `gmail.test.ts` covers only smoke tests. PKCE flow, search, batch fetch, retry logic all untested.

### 7.4 Export `parseLlmResponse` and test actual code
**Source:** QA | `llm-parsing.test.ts` tests duplicated mirror functions, not the real exports. Field aliasing (`from`/`to`/`flight_number`) untested.

### 7.5 Dashboard component tests
**Source:** QA | Zero rendering tests for any dashboard component. The archetype icon bug (0.3) would be caught by a basic render test.

### 7.6 `extractFlightsFromEmail` domain filter test
**Source:** QA | The domain filter that gates LLM extraction is untested.

---

## Tier 8: Future / Nice-to-Have

- **Story mode** — Wrapped-style vertical card sequence through top 5 highlights
- **Multiple share card themes** — dark/light, different color palettes
- **Opt-in local persistence** — IndexedDB for flight data (not email content)
- **JSON export/import** — download/upload `flights.json`
- **Globe auto-fly** — zoom to most-visited airport on dashboard mount
- **Archetype visual identity** — unique color/illustration per archetype
- **Background model download** — Background Fetch API for 2GB model
- **Install prompt** — deferred `beforeinstallprompt` after results view

---

## Cross-Agent Agreement Matrix

Issues flagged by 3+ agents (highest confidence):

| Issue | Security | QA | Architect | Platform | Offline | UX |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| normalizeEmails on main thread | | | x | x | | |
| batchFetchMessages concurrency | | x | x | x | | |
| WebLLM not in package.json | x | x | | x | | |
| Worker not cancelled on reset | | x | x | | | |
| No CSP | x | | | | | |
| Globe texture CDN leak | | | | x | x | |
| Missing Web Share API | | | | | x | x |
| No OAuth state param | x | | | | | |
| archetype.icon display bug | | x | | | | x |
