# MyFlights

Your flight stats, visualized. Connect your Gmail to see beautiful analytics from your flight confirmation emails.

## How It Works

1. **Connect** — Sign in with Gmail (OAuth)
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

## Gmail Setup

To enable the "Connect Gmail" feature you need a Google Cloud OAuth client ID:

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

The app uses OAuth PKCE (no client secret needed). All email data stays in your browser — the Gmail API is called directly from the client.

## Deployment

The project deploys automatically to GitHub Pages via GitHub Actions on every push to `main`. The workflow is defined in `.github/workflows/deploy.yml`.

To set up for your own fork:
1. Go to your repo's **Settings → Pages** and set the source to **GitHub Actions**
2. If you need Gmail OAuth in production, add `VITE_GMAIL_CLIENT_ID` as a repository secret and update the workflow to pass it as an env var during build

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for a detailed overview of the extraction pipeline, data flow, and component structure.
