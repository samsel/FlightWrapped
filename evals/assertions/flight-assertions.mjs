/**
 * Custom promptfoo assertion provider for single-email flight extraction.
 *
 * Validates LLM output structure, IATA codes, date formats, and compares
 * extracted flights against ground truth using the same matching logic
 * as the production eval.ts (origin + destination + date).
 *
 * Export: default function(output, context) => { pass, score, reason }
 */

// ~50 most common IATA codes used in test fixtures.
// Keeps the module self-contained (no filesystem dependency on airports.json).
const VALID_IATA = new Set([
  'ATL', 'PEK', 'LAX', 'DXB', 'HND', 'ORD', 'LHR', 'PVG', 'CDG', 'DFW',
  'AMS', 'FRA', 'IST', 'CAN', 'JFK', 'SIN', 'DEN', 'ICN', 'BKK', 'SFO',
  'KUL', 'MAD', 'CTU', 'LAS', 'MUC', 'BOM', 'MIA', 'SEA', 'CLT', 'EWR',
  'PHX', 'IAH', 'SYD', 'MEL', 'GRU', 'YYZ', 'FCO', 'LGW', 'BCN', 'MNL',
  'BOS', 'MSP', 'DTW', 'NRT', 'HKG', 'MEX', 'DOH', 'ZRH', 'VIE', 'OSL',
  'CPH', 'HEL', 'ARN', 'LIS', 'WAW', 'PRG', 'BUD', 'DUB', 'EDI', 'MAN',
  'AKL', 'DEL', 'TPE', 'KIX', 'BNE', 'PER', 'SCL', 'BOG', 'LIM', 'EZE',
  'JNB', 'CPT', 'CAI', 'ADD', 'NBO', 'CMB', 'DAC', 'KTM', 'RUH', 'JED',
  'TLV', 'AMM', 'BWI', 'SAN', 'TPA', 'MCO', 'PDX', 'SLC', 'IAD', 'FLL',
  'AUS', 'RDU', 'STL', 'PIT', 'CLE', 'IND', 'CMH', 'MCI', 'OAK', 'SMF',
  'STN', 'BGY', 'MDW', 'YVR',
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const IATA_RE = /^[A-Z]{3}$/;

// ---------------------------------------------------------------------------
// JSON extraction -- mirrors the greedy { ... } approach in production llm.ts
// ---------------------------------------------------------------------------

/**
 * Extract the outermost JSON object from a string that may contain markdown
 * code fences, thinking tags, or other surrounding text.
 *
 * Algorithm (same as parseLlmResponse in llm.ts):
 *   1. Strip <think>...</think> tags
 *   2. Strip markdown code fences
 *   3. Find the first '{'
 *   4. Starting from the last '}', try JSON.parse on progressively shorter
 *      slices until one succeeds
 */
function extractJson(raw) {
  if (!raw || typeof raw !== 'string') return null;

  // Strip Qwen3-style thinking tags
  let content = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  content = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  const openIdx = content.indexOf('{');
  if (openIdx === -1) return null;

  // Greedy: try from the last '}' backwards until we find valid JSON
  for (let i = content.lastIndexOf('}'); i > openIdx; i = content.lastIndexOf('}', i - 1)) {
    try {
      return JSON.parse(content.slice(openIdx, i + 1));
    } catch {
      // try shorter slice
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Flight validation helpers
// ---------------------------------------------------------------------------

/** Check if code is a syntactically valid 3-letter IATA code. */
function isValidIata(code) {
  if (!code || typeof code !== 'string') return false;
  return IATA_RE.test(code.toUpperCase().trim());
}

/** Check if code is in our hardcoded known-good set. */
function isKnownIata(code) {
  return VALID_IATA.has(code.toUpperCase().trim());
}

/** Check if string matches YYYY-MM-DD format. */
function isValidDate(d) {
  return typeof d === 'string' && DATE_RE.test(d);
}

/** Normalize flight number for comparison: strip whitespace, uppercase. */
function normalizeFlightNum(fn) {
  if (!fn || typeof fn !== 'string') return '';
  return fn.replace(/\s+/g, '').toUpperCase();
}

// ---------------------------------------------------------------------------
// Ground-truth comparison (mirrors eval.ts logic)
// ---------------------------------------------------------------------------

/**
 * Match extracted flights to ground truth by origin + destination + date.
 * Calculate precision, recall, F1, and field accuracy for airline/flightNumber.
 *
 * This uses the same matching logic as evaluateExtraction() in eval.ts:
 *   - Each extracted flight is matched to the first unmatched ground truth
 *     flight with the same origin, destination, and date.
 *   - A matched pair counts as a true positive.
 *   - Field accuracy (airline, flightNumber) is computed only over matched pairs.
 */
function compareToGroundTruth(extracted, groundTruth) {
  // Handle edge cases identically to eval.ts
  if (groundTruth.length === 0 && extracted.length === 0) {
    return { precision: 1, recall: 1, f1: 1, truePositives: 0, airlineAcc: 1, flightNumAcc: 1 };
  }
  if (groundTruth.length === 0) {
    return { precision: 0, recall: 1, f1: 0, truePositives: 0, airlineAcc: 0, flightNumAcc: 0 };
  }
  if (extracted.length === 0) {
    return { precision: 1, recall: 0, f1: 0, truePositives: 0, airlineAcc: 0, flightNumAcc: 0 };
  }

  const matched = new Set();
  let truePositives = 0;
  let airlineCorrect = 0;
  let flightNumCorrect = 0;

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

      // Field accuracy: airline (case-insensitive)
      if ((ext.airline || '').toUpperCase().trim() === (gt.airline || '').toUpperCase().trim()) {
        airlineCorrect++;
      }
      // Field accuracy: flightNumber (normalized)
      if (normalizeFlightNum(ext.flightNumber) === normalizeFlightNum(gt.flightNumber)) {
        flightNumCorrect++;
      }
    }
  }

  const precision = truePositives / extracted.length;
  const recall = truePositives / groundTruth.length;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const airlineAcc = truePositives > 0 ? airlineCorrect / truePositives : 0;
  const flightNumAcc = truePositives > 0 ? flightNumCorrect / truePositives : 0;

  return { precision, recall, f1, truePositives, airlineAcc, flightNumAcc };
}

// ---------------------------------------------------------------------------
// Main assertion entry point
// ---------------------------------------------------------------------------

/**
 * @param {string} output  - Raw LLM response string
 * @param {object} context - promptfoo context; context.vars contains test variables
 * @returns {{ pass: boolean, score: number, reason: string }}
 */
export default function flightAssertion(output, context) {
  const reasons = [];

  // -- Step 1: Parse JSON from LLM output --
  if (!output || typeof output !== 'string' || output.trim().length === 0) {
    return { pass: false, score: 0, reason: 'Empty LLM output' };
  }

  const parsed = extractJson(output);
  if (!parsed || typeof parsed !== 'object') {
    return { pass: false, score: 0, reason: 'Could not extract valid JSON from LLM output' };
  }

  // -- Step 2: Validate flights array --
  const rawFlights = parsed.flights ?? parsed.flight;
  if (rawFlights === undefined || rawFlights === null) {
    return { pass: false, score: 0, reason: 'JSON missing "flights" array' };
  }

  const flights = Array.isArray(rawFlights) ? rawFlights : [rawFlights];

  // -- Step 3: Validate IATA codes --
  const iataErrors = [];
  const unknownIata = [];
  for (let i = 0; i < flights.length; i++) {
    const f = flights[i];
    if (!f || typeof f !== 'object') continue;

    const origin = String(f.origin ?? '').toUpperCase().trim();
    const dest = String(f.destination ?? '').toUpperCase().trim();

    if (!isValidIata(origin)) {
      iataErrors.push(`Flight ${i}: invalid origin "${origin}"`);
    } else if (!isKnownIata(origin)) {
      unknownIata.push(origin);
    }

    if (!isValidIata(dest)) {
      iataErrors.push(`Flight ${i}: invalid destination "${dest}"`);
    } else if (!isKnownIata(dest)) {
      unknownIata.push(dest);
    }
  }

  if (iataErrors.length > 0) {
    reasons.push(`IATA errors: ${iataErrors.join('; ')}`);
  }
  if (unknownIata.length > 0) {
    reasons.push(`Unknown but syntactically valid IATA codes: ${[...new Set(unknownIata)].join(', ')}`);
  }

  // -- Step 4: Validate date format --
  const dateErrors = [];
  for (let i = 0; i < flights.length; i++) {
    const f = flights[i];
    if (!f || typeof f !== 'object') continue;
    const date = String(f.date ?? '');
    if (!isValidDate(date)) {
      dateErrors.push(`Flight ${i}: invalid date "${date}"`);
    }
  }

  if (dateErrors.length > 0) {
    reasons.push(`Date errors: ${dateErrors.join('; ')}`);
  }

  // -- Step 5: Compare against ground truth (if provided) --
  const vars = context?.vars ?? {};
  const groundTruthRaw = vars.ground_truth;

  if (groundTruthRaw) {
    let groundTruth;
    try {
      groundTruth = typeof groundTruthRaw === 'string'
        ? JSON.parse(groundTruthRaw)
        : groundTruthRaw;
      if (!Array.isArray(groundTruth)) {
        // Allow { flights: [...] } wrapper
        groundTruth = groundTruth?.flights ?? groundTruth;
        if (!Array.isArray(groundTruth)) groundTruth = [groundTruth];
      }
    } catch (e) {
      return {
        pass: false,
        score: 0,
        reason: `Failed to parse ground_truth: ${e.message}`,
      };
    }

    const result = compareToGroundTruth(flights, groundTruth);
    const passThreshold = result.precision >= 0.8 && result.recall >= 0.8;

    reasons.push(
      `Precision: ${(result.precision * 100).toFixed(1)}% | ` +
      `Recall: ${(result.recall * 100).toFixed(1)}% | ` +
      `F1: ${(result.f1 * 100).toFixed(1)}% | ` +
      `TP: ${result.truePositives}/${groundTruth.length} | ` +
      `Airline acc: ${(result.airlineAcc * 100).toFixed(1)}% | ` +
      `FlightNum acc: ${(result.flightNumAcc * 100).toFixed(1)}%`
    );

    if (!passThreshold) {
      reasons.push('FAILED: precision or recall below 0.8 threshold');
    }

    return {
      pass: passThreshold && iataErrors.length === 0 && dateErrors.length === 0,
      score: result.f1,
      reason: reasons.join(' | '),
    };
  }

  // -- No ground truth: pass if structure is valid --
  const structureValid = iataErrors.length === 0 && dateErrors.length === 0;
  reasons.push(`Extracted ${flights.length} flight(s), structure ${structureValid ? 'valid' : 'invalid'}`);

  return {
    pass: structureValid,
    score: structureValid ? 1 : 0,
    reason: reasons.join(' | '),
  };
}
