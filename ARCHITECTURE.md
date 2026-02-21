# MyFlights Architecture

## Overview

MyFlights is a privacy-first, browser-based flight analytics tool. Users connect Gmail (OAuth PKCE) or upload .mbox/.eml files. The app parses flight confirmation emails, extracts flight data, calculates stats, and displays shareable visualizations — all in the browser with zero server dependency.

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

### Three-Tier Extraction Pipeline

Flight data is extracted using a cascading approach:

1. **Tier 1 — JSON-LD (confidence: 0.99):** Structured schema.org data embedded by airlines. Ground truth when available.
2. **Tier 2 — Regex (confidence: 0.70–0.90):** Pattern matching for airport codes, flight numbers, dates. Only runs if Tier 1 finds nothing.
3. **Tier 3 — Local LLM (confidence: 0.80–0.95):** In-browser LLM via WebLLM. Opt-in only. Only runs if Tier 1 and 2 fail on airline-domain emails.

Each flight is tagged with its extraction tier and confidence score — visible in the UI for transparency.

### Deduplication Strategy

The same flight generates multiple emails (confirmation, itinerary update, check-in, boarding pass). Dedup uses:

- **Primary key:** flight number + date
- **Fallback:** origin + destination + date (when flight number is missing)
- **Conflict resolution:** keep the highest-confidence extraction

### Web Worker Pipeline

All email parsing and extraction runs in a Web Worker to keep the UI responsive. Communication uses a typed message protocol (`WorkerInMessage` / `WorkerOutMessage`) with progress reporting.

## Future Enhancements

### Private Jet / Charter Flight Support

Private jets won't be captured in the current implementation. Private/charter flights don't send standardized confirmation emails from domains in our list. We could add major charter companies (NetJets, Wheels Up, VistaJet, etc.) to the domain list, but their email formats are highly varied. Something to consider as a future enhancement — for now the tool targets commercial aviation.
