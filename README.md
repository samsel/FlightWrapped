# MyFlights

Your flight stats, visualized. Connect your Gmail to see beautiful analytics from your flight confirmation emails — entirely in your browser.

## How It Works

1. **Connect** — Sign in with Gmail (read-only OAuth PKCE, no server involved)
2. **Extract** — A local LLM (Phi-3.5-mini via WebLLM) runs in your browser to parse flight data from confirmation emails
3. **Visualize** — See your flights on an interactive 3D globe, get stats, insights, your flyer archetype, and export a shareable image card

You can also click **"Try with sample data"** to explore the full dashboard with 46 demo flights — no Gmail setup needed.

## Privacy

Everything runs entirely in your browser. There is no backend — no server, no database, no analytics. Your Gmail token lives only in memory and is discarded when you close the tab. Email content is processed locally via Web Workers and a local LLM (WebLLM). The only external calls are to the Gmail API (from your browser, using your token) and a CDN for the globe texture.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript + Vite 7 |
| Styling | Tailwind CSS v4 |
| 3D Globe | react-globe.gl (Three.js) |
| Email Parsing | postal-mime |
| Local LLM | WebLLM — Phi-3.5-mini-instruct (~2GB, cached in IndexedDB) |
| Image Export | html-to-image |
| Charts | Custom SVG (no charting library) |

## Local Development

```bash
npm install
npm run dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run lint` | ESLint |
| `npm test` | Run tests (Vitest, 63 tests) |
| `npm run preview` | Preview production build |

## Gmail Setup

To enable Gmail OAuth you need a Google Cloud OAuth client ID:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project (or use an existing one)
2. Enable the **Gmail API** under APIs & Services → Library
3. Go to APIs & Services → Credentials → **Create Credentials → OAuth client ID**
4. Choose **Web application** as the application type
5. Under **Authorized redirect URIs**, add:
   - `http://localhost:5173` (local development)
   - Your production URL (e.g. `https://yourusername.github.io/myflights/`)
6. Copy the **Client ID** and create a `.env` file (see `.env.example`):
   ```
   VITE_GMAIL_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
   VITE_GMAIL_REDIRECT_URI=http://localhost:5173
   ```

The app uses OAuth PKCE (no client secret needed). All email data stays in your browser — the Gmail API is called directly from the client with `gmail.readonly` scope.

## Deployment

The project deploys automatically to GitHub Pages via GitHub Actions on every push to `main`. The workflow is defined in `.github/workflows/deploy.yml`.

To set up for your own fork:
1. Go to your repo's **Settings → Pages** and set the source to **GitHub Actions**
2. If you need Gmail OAuth in production, add `VITE_GMAIL_CLIENT_ID` as a repository secret and update the workflow to pass it as an env var during build

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for a detailed overview of the extraction pipeline, data flow, and component structure.
