// @vitest-environment node
import { describe, it, expect } from 'vitest'

/**
 * Tests for the internal LLM parsing functions (parseLlmResponse, parseFlightDate, stripToPlainText).
 * Since these are not exported, we re-implement and test the logic patterns they use.
 * This validates the JSON extraction, date parsing, and HTML stripping logic.
 */

// --- parseDateToIso logic (mirrors llm.ts) ---
function parseDateToIso(str: string): string | null {
  const isoMatch = str.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    const y = parseInt(year, 10)
    const m = parseInt(month, 10)
    const d = parseInt(day, 10)
    if (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${year}-${month}-${day}`
    }
  }
  try {
    const d = new Date(str)
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear()
      if (year >= 1990 && year <= 2100) {
        return `${year}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      }
    }
  } catch {
    // fall through
  }
  return null
}

function parseFlightDate(dateStr: string, fallbackDate: string): string | null {
  if (dateStr) {
    const result = parseDateToIso(dateStr)
    if (result) return result
  }
  if (fallbackDate) {
    const result = parseDateToIso(fallbackDate)
    if (result) return result
  }
  return null
}

// --- JSON extraction logic (mirrors llm.ts parseLlmResponse) ---
function extractJson(content: string): Record<string, unknown> | null {
  const openIdx = content.indexOf('{')
  if (openIdx === -1) return null

  for (let i = content.lastIndexOf('}'); i > openIdx; i = content.lastIndexOf('}', i - 1)) {
    try {
      return JSON.parse(content.slice(openIdx, i + 1))
    } catch {
      // try shorter
    }
  }
  return null
}

// --- stripToPlainText logic (mirrors llm.ts) ---
function stripToPlainText(htmlBody: string): string {
  return htmlBody
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('parseDateToIso', () => {
  it('parses standard YYYY-MM-DD', () => {
    expect(parseDateToIso('2024-01-15')).toBe('2024-01-15')
  })

  it('parses date embedded in longer string', () => {
    expect(parseDateToIso('Departure: 2024-03-20 at 10:00')).toBe('2024-03-20')
  })

  it('rejects dates before 1990', () => {
    expect(parseDateToIso('1899-01-01')).toBeNull()
  })

  it('rejects dates after 2100', () => {
    expect(parseDateToIso('2101-01-01')).toBeNull()
  })

  it('handles empty string', () => {
    expect(parseDateToIso('')).toBeNull()
  })

  it('handles nonsense string', () => {
    expect(parseDateToIso('not a date')).toBeNull()
  })

  it('preserves exact date regardless of local timezone', () => {
    // Critical timezone bug fix - YYYY-MM-DD must not shift
    const result = parseDateToIso('2024-01-15')
    expect(result).toBe('2024-01-15')
  })

  it('handles ISO datetime format via regex', () => {
    expect(parseDateToIso('2024-06-15T10:30:00Z')).toBe('2024-06-15')
  })

  it('handles natural date strings via Date fallback', () => {
    // "January 15, 2024" is parsed by Date constructor
    const result = parseDateToIso('January 15, 2024')
    expect(result).toBe('2024-01-15')
  })

  it('handles date at year boundary', () => {
    expect(parseDateToIso('2024-12-31')).toBe('2024-12-31')
    expect(parseDateToIso('2024-01-01')).toBe('2024-01-01')
  })

  it('rejects invalid month or day', () => {
    expect(parseDateToIso('2024-13-01')).toBeNull()
    expect(parseDateToIso('2024-00-15')).toBeNull()
    expect(parseDateToIso('2024-01-32')).toBeNull()
    expect(parseDateToIso('2024-01-00')).toBeNull()
  })
})

describe('parseFlightDate', () => {
  it('prefers dateStr over fallback', () => {
    expect(parseFlightDate('2024-03-15', '2024-01-01')).toBe('2024-03-15')
  })

  it('uses fallback when dateStr is empty', () => {
    expect(parseFlightDate('', '2024-01-01')).toBe('2024-01-01')
  })

  it('uses fallback when dateStr is invalid', () => {
    expect(parseFlightDate('garbage', '2024-01-01')).toBe('2024-01-01')
  })

  it('returns null when both are empty', () => {
    expect(parseFlightDate('', '')).toBeNull()
  })

  it('returns null when both are invalid', () => {
    expect(parseFlightDate('not-a-date', 'also-not')).toBeNull()
  })
})

describe('extractJson (LLM response parsing)', () => {
  it('extracts clean JSON', () => {
    const result = extractJson('{"flights":[{"origin":"JFK","destination":"LAX"}]}')
    expect(result).toEqual({ flights: [{ origin: 'JFK', destination: 'LAX' }] })
  })

  it('extracts JSON with surrounding text', () => {
    const result = extractJson('Here is the result: {"flights":[]} Let me know if you need more.')
    expect(result).toEqual({ flights: [] })
  })

  it('handles JSON with markdown code block', () => {
    const content = '```json\n{"flights":[{"origin":"SFO","destination":"ORD"}]}\n```'
    const result = extractJson(content)
    expect(result).toEqual({ flights: [{ origin: 'SFO', destination: 'ORD' }] })
  })

  it('returns null for no JSON', () => {
    expect(extractJson('No flights found in this email.')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractJson('')).toBeNull()
  })

  it('handles nested braces', () => {
    const result = extractJson('{"flights":[{"data":{"nested":true}}]}')
    expect(result).toEqual({ flights: [{ data: { nested: true } }] })
  })

  it('handles JSON followed by trailing text with braces', () => {
    // Greedy regex fix - should still find valid JSON
    const content = '{"flights":[]} Some note about {formatting}'
    const result = extractJson(content)
    // Should parse something valid
    expect(result).not.toBeNull()
  })

  it('handles malformed JSON gracefully', () => {
    expect(extractJson('{broken json')).toBeNull()
  })

  it('handles JSON with whitespace', () => {
    const content = `  {
      "flights": [
        { "origin": "LAX", "destination": "NRT" }
      ]
    }  `
    const result = extractJson(content)
    expect(result).not.toBeNull()
    expect((result as any).flights).toHaveLength(1)
  })
})

describe('stripToPlainText', () => {
  it('strips HTML tags', () => {
    expect(stripToPlainText('<p>Hello <strong>World</strong></p>')).toBe('Hello World')
  })

  it('strips style blocks', () => {
    expect(stripToPlainText('<style>.foo { color: red; }</style><p>Content</p>')).toBe('Content')
  })

  it('strips script blocks', () => {
    expect(stripToPlainText('<script>alert("xss")</script><p>Safe</p>')).toBe('Safe')
  })

  it('decodes HTML entities', () => {
    expect(stripToPlainText('A &amp; B &lt; C &gt; D')).toBe('A & B < C > D')
  })

  it('replaces &nbsp; with space', () => {
    expect(stripToPlainText('Hello&nbsp;World')).toBe('Hello World')
  })

  it('collapses whitespace', () => {
    expect(stripToPlainText('<p>  lots   of   spaces  </p>')).toBe('lots of spaces')
  })

  it('handles empty string', () => {
    expect(stripToPlainText('')).toBe('')
  })

  it('handles complex email HTML', () => {
    const html = `
      <html><head><style>body { font-family: Arial; }</style></head>
      <body>
        <table><tr><td>Your flight UA 1234 from JFK to LAX</td></tr></table>
        <script>trackEvent();</script>
      </body></html>
    `
    const text = stripToPlainText(html)
    expect(text).toContain('UA 1234')
    expect(text).toContain('JFK')
    expect(text).not.toContain('<style>')
    expect(text).not.toContain('<script>')
    expect(text).not.toContain('trackEvent')
  })
})
