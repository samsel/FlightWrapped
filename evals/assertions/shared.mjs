/**
 * Shared utilities for flight extraction eval assertions.
 *
 * Single source of truth for JSON extraction, IATA validation, date handling,
 * and ground-truth comparison. Used by both flight-assertions.mjs (single-email)
 * and batch-assertions.mjs (multi-email).
 *
 * IATA validation uses the production airport database (src/data/airports.json)
 * so eval and production always agree on valid codes.
 *
 * NOTE: Ground-truth matching logic (origin+dest+date) is also implemented in
 * src/lib/eval.ts for production use. Keep both in sync if you change the
 * matching algorithm.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const airportData = require('../../src/data/airports.json');

// Build IATA set from production airport database (5500+ airports)
const VALID_IATA = new Set(airportData.map(a => a.iata));

export const DEFAULT_THRESHOLD = 0.8;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const IATA_RE = /^[A-Z]{3}$/;

// ---------------------------------------------------------------------------
// JSON extraction — mirrors parseLlmResponse() in src/worker/extractors/llm.ts
// ---------------------------------------------------------------------------

export function extractJson(raw) {
  if (!raw || typeof raw !== 'string') return null;

  let content = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  content = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  // Merge duplicate "flights" keys: {"flights":[A],"flights":[B]} → {"flights":[A,B]}
  content = content.replace(/"flights"\s*:\s*\[/g, (match, offset) => {
    if (offset === content.indexOf('"flights"')) return match;
    return '"__dup_flights":[';
  });

  const openIdx = content.indexOf('{');
  if (openIdx === -1) return null;

  for (let i = content.lastIndexOf('}'); i > openIdx; i = content.lastIndexOf('}', i - 1)) {
    try {
      const parsed = JSON.parse(content.slice(openIdx, i + 1));
      if (parsed.__dup_flights) {
        parsed.flights = [...(parsed.flights || []), ...parsed.__dup_flights];
        delete parsed.__dup_flights;
      }
      return parsed;
    } catch {
      // try shorter slice
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export function isValidIata(code) {
  if (!code || typeof code !== 'string') return false;
  return IATA_RE.test(code.toUpperCase().trim());
}

export function isKnownIata(code) {
  return VALID_IATA.has(code.toUpperCase().trim());
}

export function isValidDate(d) {
  return typeof d === 'string' && DATE_RE.test(d);
}

export function normalizeFlightNum(fn) {
  if (!fn || typeof fn !== 'string') return '';
  return fn.replace(/\s+/g, '').toUpperCase();
}

/** Strip time components from dates (e.g. "2024-11-04T07:00:00" → "2024-11-04") */
export function normalizeFlightDates(flights) {
  for (const f of flights) {
    if (f && typeof f.date === 'string' && f.date.includes('T')) {
      f.date = f.date.split('T')[0];
    }
  }
}

export function validateFlights(flights) {
  const iataErrors = [];
  const unknownIata = [];
  const dateErrors = [];

  for (let i = 0; i < flights.length; i++) {
    const f = flights[i];
    if (!f || typeof f !== 'object') continue;

    const origin = String(f.origin ?? '').toUpperCase().trim();
    const dest = String(f.destination ?? '').toUpperCase().trim();
    const date = String(f.date ?? '');

    if (!isValidIata(origin)) iataErrors.push(`Flight ${i}: invalid origin "${origin}"`);
    else if (!isKnownIata(origin)) unknownIata.push(origin);

    if (!isValidIata(dest)) iataErrors.push(`Flight ${i}: invalid destination "${dest}"`);
    else if (!isKnownIata(dest)) unknownIata.push(dest);

    if (!isValidDate(date)) dateErrors.push(`Flight ${i}: invalid date "${date}"`);
  }

  return { iataErrors, unknownIata, dateErrors };
}

// ---------------------------------------------------------------------------
// Ground-truth comparison
// ---------------------------------------------------------------------------

export function compareToGroundTruth(extracted, groundTruth) {
  if (groundTruth.length === 0 && extracted.length === 0) {
    return { precision: 1, recall: 1, f1: 1, truePositives: 0, exactMatch: true, airlineAcc: 1, flightNumAcc: 1, perFlight: [] };
  }
  if (groundTruth.length === 0) {
    return { precision: 0, recall: 1, f1: 0, truePositives: 0, exactMatch: false, airlineAcc: 0, flightNumAcc: 0, perFlight: [] };
  }
  if (extracted.length === 0) {
    return { precision: 1, recall: 0, f1: 0, truePositives: 0, exactMatch: false, airlineAcc: 0, flightNumAcc: 0, perFlight: [] };
  }

  const matched = new Set();
  let truePositives = 0;
  let airlineCorrect = 0;
  let flightNumCorrect = 0;
  const perFlight = [];

  for (const ext of extracted) {
    const matchIdx = groundTruth.findIndex((gt, i) =>
      !matched.has(i) &&
      (gt.origin || '').toUpperCase().trim() === (ext.origin || '').toUpperCase().trim() &&
      (gt.destination || '').toUpperCase().trim() === (ext.destination || '').toUpperCase().trim() &&
      (gt.date || '') === (ext.date || '')
    );

    if (matchIdx >= 0) {
      matched.add(matchIdx);
      truePositives++;
      const gt = groundTruth[matchIdx];

      const airlineMatch = (ext.airline || '').toUpperCase().trim() === (gt.airline || '').toUpperCase().trim();
      const fnMatch = normalizeFlightNum(ext.flightNumber) === normalizeFlightNum(gt.flightNumber);
      if (airlineMatch) airlineCorrect++;
      if (fnMatch) flightNumCorrect++;

      perFlight.push({
        extracted: `${ext.origin}-${ext.destination} ${ext.date}`,
        matched: true,
        airlineMatch,
        flightNumMatch: fnMatch,
      });
    } else {
      perFlight.push({
        extracted: `${ext.origin || '?'}-${ext.destination || '?'} ${ext.date || '?'}`,
        matched: false,
        airlineMatch: false,
        flightNumMatch: false,
      });
    }
  }

  const precision = truePositives / extracted.length;
  const recall = truePositives / groundTruth.length;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const airlineAcc = truePositives > 0 ? airlineCorrect / truePositives : 0;
  const flightNumAcc = truePositives > 0 ? flightNumCorrect / truePositives : 0;
  const exactMatch = truePositives === groundTruth.length &&
    truePositives === extracted.length &&
    airlineCorrect === truePositives &&
    flightNumCorrect === truePositives;

  return { precision, recall, f1, truePositives, exactMatch, airlineAcc, flightNumAcc, perFlight };
}

export function parseGroundTruth(raw) {
  if (!raw) return null;
  try {
    let gt = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(gt)) {
      gt = gt?.flights ?? gt;
      if (!Array.isArray(gt)) gt = [gt];
    }
    return gt;
  } catch {
    return null;
  }
}
