# FlightWrapped

**Live:** [samsel.github.io/FlightWrapped](https://samsel.github.io/FlightWrapped)

**Your flights, visualized.** Upload your Google Takeout .mbox file to see beautiful analytics from your flight confirmation emails -- entirely in your browser.

No servers. No sign-ups. No data leaves your device.

## How It Works

1. **Export** -- Go to [Google Takeout](https://takeout.google.com/), select only "Mail", and download your .mbox file
2. **Upload** -- Drop the .mbox file into FlightWrapped. A local LLM (Phi-3.5-mini via WebLLM) runs in your browser to parse flight data from confirmation emails
3. **Visualize** -- See your flights on an interactive 3D globe, get stats, insights, and your flyer archetype

You can also click **"Try with sample data"** to explore the full dashboard with 50 demo flights across 28 airports and 18 airlines. No file upload needed.

## Why Google Takeout Instead of Gmail OAuth?

FlightWrapped was originally built with Gmail OAuth PKCE (direct API access). I pivoted to Google Takeout file upload for several reasons:

- **No verification required.** Gmail's `gmail.readonly` scope is classified as "restricted" by Google, requiring a CASA Tier 2 security assessment ($4,500--$75,000+) before any user beyond test accounts can use the app. Google Takeout requires zero verification.
- **Truly zero network calls.** With OAuth, the browser still calls the Gmail API. With Takeout, there is no API -- the .mbox file is read locally via `FileReader`. The only external calls are for the LLM model download (Hugging Face).
- **Simpler architecture.** No OAuth flow, no token management, no PKCE verifier/state, no session storage, no callback URL handling. Just a file input.
- **Stronger privacy story.** "We never connect to your email account" is a stronger claim than "we connect read-only."

## Features

- **Privacy-first** -- Zero servers, zero databases, zero analytics. Everything runs entirely in your browser. No API access to your email -- you export and upload the file yourself.
- **Local AI extraction** -- Phi-3.5-mini runs on-device via WebLLM (WebGPU/WASM). Email content is processed locally through Web Workers.
- **Persistent** -- Flight data is cached in IndexedDB. Return visits skip re-parsing. Re-import merges and deduplicates with existing data.
- **3D globe visualization** -- Interactive globe (react-globe.gl / Three.js) showing flight arcs and airport markers.
- **Year filtering** -- Filter your dashboard by year to see stats for any individual year or all time.
- **PWA support** -- Installable as a progressive web app with offline app shell caching via service worker.
- **Animated reveal sequence** -- Skeleton loading placeholders, count-up number animations, and staggered fade-in transitions.
- **Rich stats** -- 18+ computed metrics including distance, airports, airlines, routes, CO2 estimate, and fun comparisons (Earth orbits, Moon journey, days in air).
- **Flyer archetypes** -- 6 personality types (Commuter, Explorer, Road Warrior, Long Hauler, Weekender, Occasional Flyer) based on your travel patterns.
- **9 travel insights** -- Conditional badges like Weekend Warrior, Globe Trotter, Loyalty King, and more.
- **Re-import** -- Import additional .mbox files to merge new flights with existing data.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript + Vite 7 |
| Styling | Tailwind CSS v4 |
| 3D Globe | react-globe.gl (Three.js) |
| Email Parsing | postal-mime |
| Mbox Parsing | Custom parser (splits on "From " lines, handles escaping) |
| Local LLM | WebLLM -- Phi-3.5-mini-instruct (~2 GB, cached in IndexedDB) |
| Persistence | IndexedDB via idb (flights, import timestamp) |
| Charts | Custom SVG (no charting library) |
| PWA | vite-plugin-pwa (Workbox) |
| Testing | Vitest + Testing Library |

## Local Development

```bash
npm install
npm run dev
```

No environment variables or API keys are required. FlightWrapped runs entirely in the browser.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run lint` | ESLint |
| `npm test` | Run tests (Vitest, 235 tests across 20 files) |
| `npm run preview` | Preview production build |

## Deployment

The project deploys automatically to GitHub Pages via GitHub Actions on every push to `main`. The workflow is defined in `.github/workflows/deploy.yml`.

The CI pipeline runs `npm audit --audit-level=high` before building to catch known vulnerabilities.

To set up for your own fork:
1. Go to your repo's **Settings -> Pages** and set the source to **GitHub Actions**

No secrets or environment variables need to be configured.

## Testing

244 tests across 21 test files, run with Vitest. A pre-commit git hook runs the full test suite + TypeScript type-check on every commit.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for a detailed overview of the extraction pipeline, data flow, and component structure.
