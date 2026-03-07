// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { parseLlmResponse, stripToPlainText } from '../worker/extractors/llm'
import type { NormalizedEmail } from '@/lib/types'

describe('parseLlmResponse (real export)', () => {
  it('parses a valid single-flight response', () => {
    const content = '{"flights":[{"origin":"JFK","destination":"LAX","date":"2024-01-15","airline":"United Airlines","flightNumber":"UA 1234"}]}'
    const flights = parseLlmResponse(content, '2024-01-15')
    expect(flights).toHaveLength(1)
    expect(flights[0].origin).toBe('JFK')
    expect(flights[0].destination).toBe('LAX')
    expect(flights[0].airline).toBe('United Airlines')
  })

  it('parses multi-flight response', () => {
    const content = '{"flights":[{"origin":"JFK","destination":"LHR","date":"2024-03-01","airline":"BA","flightNumber":"BA 117"},{"origin":"LHR","destination":"JFK","date":"2024-03-08","airline":"BA","flightNumber":"BA 116"}]}'
    const flights = parseLlmResponse(content, '2024-03-01')
    expect(flights).toHaveLength(2)
  })

  it('handles "from"/"to" field aliases', () => {
    const content = '{"flights":[{"from":"SFO","to":"ORD","date":"2024-02-20","carrier":"United","flight":"UA 500"}]}'
    const flights = parseLlmResponse(content, '2024-02-20')
    expect(flights).toHaveLength(1)
    expect(flights[0].origin).toBe('SFO')
    expect(flights[0].destination).toBe('ORD')
    expect(flights[0].airline).toBe('United')
    expect(flights[0].flightNumber).toBe('UA 500')
  })

  it('handles "flight" key instead of "flights"', () => {
    const content = '{"flight":{"origin":"MIA","destination":"ATL","date":"2024-05-01","airline":"Delta","flightNumber":"DL 100"}}'
    const flights = parseLlmResponse(content, '2024-05-01')
    expect(flights).toHaveLength(1)
  })

  it('rejects same origin and destination', () => {
    const content = '{"flights":[{"origin":"JFK","destination":"JFK","date":"2024-01-01","airline":"Test","flightNumber":"XX 1"}]}'
    const flights = parseLlmResponse(content, '2024-01-01')
    expect(flights).toHaveLength(0)
  })

  it('rejects invalid IATA codes', () => {
    const content = '{"flights":[{"origin":"INVALID","destination":"LAX","date":"2024-01-01","airline":"Test","flightNumber":"XX 1"}]}'
    const flights = parseLlmResponse(content, '2024-01-01')
    expect(flights).toHaveLength(0)
  })

  it('uses email date as fallback', () => {
    const content = '{"flights":[{"origin":"JFK","destination":"LAX","date":"","airline":"United","flightNumber":"UA 1"}]}'
    const flights = parseLlmResponse(content, '2024-06-15')
    expect(flights).toHaveLength(1)
    expect(flights[0].date).toBe('2024-06-15')
  })

  it('returns empty for no JSON', () => {
    expect(parseLlmResponse('I could not find any flights.', '')).toHaveLength(0)
  })

  it('returns empty for empty flights array', () => {
    expect(parseLlmResponse('{"flights":[]}', '')).toHaveLength(0)
  })

  it('handles JSON with surrounding text', () => {
    const content = 'Here is the result:\n{"flights":[{"origin":"SFO","destination":"SEA","date":"2024-04-01","airline":"Alaska","flightNumber":"AS 200"}]}\nEnd.'
    const flights = parseLlmResponse(content, '2024-04-01')
    expect(flights).toHaveLength(1)
  })

  it('sets confidence to 0.85', () => {
    const content = '{"flights":[{"origin":"JFK","destination":"LAX","date":"2024-01-01","airline":"UA","flightNumber":"UA 1"}]}'
    const flights = parseLlmResponse(content, '2024-01-01')
    expect(flights[0].confidence).toBe(0.85)
  })

  it('handles departure_date alias', () => {
    const content = '{"flights":[{"origin":"JFK","destination":"LAX","departure_date":"2024-07-04","airline":"UA","flight_number":"UA 400"}]}'
    const flights = parseLlmResponse(content, '')
    expect(flights).toHaveLength(1)
    expect(flights[0].date).toBe('2024-07-04')
    expect(flights[0].flightNumber).toBe('UA 400')
  })
})

describe('stripToPlainText (real export)', () => {
  const makeEmail = (text: string, html: string): NormalizedEmail => ({
    senderAddress: 'test@test.com',
    senderDomain: 'test.com',
    subject: 'Test',
    date: '2024-01-01',
    textBody: text,
    htmlBody: html,
  })

  it('prefers textBody when available', () => {
    const result = stripToPlainText(makeEmail('Plain text content', '<p>HTML content</p>'))
    expect(result).toBe('Plain text content')
  })

  it('falls back to htmlBody when textBody is empty', () => {
    const result = stripToPlainText(makeEmail('', '<p>HTML content</p>'))
    expect(result).toBe('HTML content')
  })

  it('returns empty for no content', () => {
    expect(stripToPlainText(makeEmail('', ''))).toBe('')
  })

  it('strips scripts and styles from HTML', () => {
    const result = stripToPlainText(makeEmail('', '<style>body{}</style><script>evil()</script><p>Safe</p>'))
    expect(result).toBe('Safe')
    expect(result).not.toContain('evil')
  })
})
