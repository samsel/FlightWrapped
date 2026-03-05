# MyFlights

Your flight stats, visualized. Connect your Gmail or upload email files to see beautiful analytics from your flight confirmation emails.

## How It Works

1. **Connect** — Sign in with Gmail (OAuth) or upload `.mbox`/`.eml` files
2. **Extract** — A 3-tier pipeline (JSON-LD → regex → local LLM) pulls flight data from confirmation emails
3. **Visualize** — See your flights on a 3D globe, get stats, insights, and a shareable image card

## Privacy

Everything runs entirely in your browser. No server, no database, no data leaves your machine. Email parsing and LLM inference happen locally via Web Workers and WebLLM. The only network call is an optional anonymous counter powered by Firebase.

## Tech Stack

- **Framework:** React + TypeScript + Vite
- **Styling:** Tailwind CSS v4
- **3D Globe:** react-globe.gl (Three.js)
- **Email Parsing:** postal-mime
- **Image Export:** html-to-image
- **Local LLM:** WebLLM (in-browser inference)
- **Counter:** Firebase (anonymous increment only)

## Local Development

```bash
npm install
npm run dev
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for a detailed overview of the extraction pipeline, data flow, and component structure.
