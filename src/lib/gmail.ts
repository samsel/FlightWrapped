import type { RawEmail } from './types'
import { AIRLINE_DOMAINS } from './domains'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly'
const BATCH_SIZE = 100
const MAX_RETRIES = 5

// Populated from environment or config — set before calling initiateAuth
let clientId = ''
let redirectUri = ''

export function configureGmail(config: { clientId: string; redirectUri: string }) {
  clientId = config.clientId
  redirectUri = config.redirectUri
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Start OAuth PKCE flow — redirects the browser */
export async function initiateAuth(): Promise<void> {
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  // Store verifier in sessionStorage for the callback
  sessionStorage.setItem('gmail_code_verifier', codeVerifier)

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'online',
    prompt: 'consent',
  })

  window.location.href = `${GOOGLE_AUTH_URL}?${params.toString()}`
}

/** Exchange authorization code for access token (PKCE, no client secret) */
export async function handleCallback(code: string): Promise<string> {
  const codeVerifier = sessionStorage.getItem('gmail_code_verifier')
  if (!codeVerifier) {
    throw new Error('Missing code verifier — OAuth flow was not properly initiated')
  }
  sessionStorage.removeItem('gmail_code_verifier')

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Token exchange failed: ${err}`)
  }

  const data = await response.json()
  return data.access_token as string
}

function buildFlightSearchQuery(): string {
  // Build a query using top airline/booking domains + flight keywords
  const topDomains = [
    'united.com',
    'delta.com',
    'aa.com',
    'southwest.com',
    'jetblue.com',
    'alaskaair.com',
    'spirit.com',
    'frontierairlines.com',
    'hawaiianairlines.com',
    'aircanada.com',
    'britishairways.com',
    'lufthansa.com',
    'airfrance.com',
    'emirates.com',
    'qatarairways.com',
    'singaporeair.com',
    'cathaypacific.com',
    'qantas.com',
    'latam.com',
    'avianca.com',
    'expedia.com',
    'kayak.com',
    'booking.com',
    'priceline.com',
    'google.com',
    'trip.com',
  ]

  const domainQuery = topDomains.map((d) => `from:${d}`).join(' OR ')
  const keywordQuery =
    'subject:(flight OR boarding OR itinerary OR reservation OR "e-ticket" OR confirmation)'

  return `(${domainQuery}) ${keywordQuery}`
}

export interface RateLimitInfo {
  retryAfter: number
  attempt: number
}

/** Search Gmail for flight-related emails, returns message IDs */
export async function searchFlightEmails(
  token: string,
  onProgress?: (fetched: number) => void,
  onRateLimit?: (info: RateLimitInfo) => void,
): Promise<string[]> {
  const query = buildFlightSearchQuery()
  const messageIds: string[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      q: query,
      maxResults: '500',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const response = await fetchWithRetry(`${GMAIL_API_BASE}/messages?${params}`, token, MAX_RETRIES, onRateLimit)
    const data = await response.json()

    if (data.messages) {
      for (const msg of data.messages) {
        messageIds.push(msg.id)
      }
    }

    onProgress?.(messageIds.length)
    pageToken = data.nextPageToken
  } while (pageToken)

  return messageIds
}

/** Batch fetch full message content from Gmail API */
export async function batchFetchMessages(
  ids: string[],
  token: string,
  onProgress?: (fetched: number, total: number) => void,
  onRateLimit?: (info: RateLimitInfo) => void,
): Promise<RawEmail[]> {
  const results: RawEmail[] = []

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE)

    // Add jitter before each batch to be kind to the API
    if (i > 0) {
      await sleep(Math.random() * 1000)
    }

    const promises = batch.map(async (id) => {
      const response = await fetchWithRetry(
        `${GMAIL_API_BASE}/messages/${id}?format=raw`,
        token,
        MAX_RETRIES,
        onRateLimit,
      )
      const data = await response.json()
      // Gmail returns base64url-encoded raw message
      const raw = atob(data.raw.replace(/-/g, '+').replace(/_/g, '/'))
      return { raw } as RawEmail
    })

    const batchResults = await Promise.all(promises)
    results.push(...batchResults)
    onProgress?.(results.length, ids.length)
  }

  return results
}

async function fetchWithRetry(
  url: string,
  token: string,
  retries = MAX_RETRIES,
  onRateLimit?: (info: RateLimitInfo) => void,
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (response.ok) return response

    if (response.status === 429 || response.status >= 500) {
      const retryAfterHeader = response.headers.get('Retry-After')
      const backoff = retryAfterHeader
        ? parseInt(retryAfterHeader, 10) * 1000
        : Math.pow(2, attempt) * 1000 + Math.random() * 3000

      if (response.status === 429) {
        onRateLimit?.({ retryAfter: Math.round(backoff / 1000), attempt: attempt + 1 })
      }

      await sleep(backoff)
      continue
    }

    throw new Error(`Gmail API error: ${response.status} ${response.statusText}`)
  }

  throw new Error('Gmail API: max retries exceeded')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Check if there's an OAuth callback code in the current URL */
export function getCallbackCode(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('code')
}

/** Clean up the URL after handling the callback */
export function clearCallbackParams(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('code')
  url.searchParams.delete('scope')
  window.history.replaceState({}, '', url.pathname)
}

/** Check if the domain list contains this domain (used by extraction pipeline) */
export function isDomainRelevant(domain: string): boolean {
  return AIRLINE_DOMAINS.has(domain.toLowerCase())
}
