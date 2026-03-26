/**
 * Custom promptfoo assertion provider for single-email flight extraction.
 *
 * Validates LLM output structure, IATA codes, date formats, and compares
 * extracted flights against ground truth using precision/recall/F1 scoring.
 *
 * All parsing, validation, and comparison logic lives in shared.mjs to
 * stay in sync with batch-assertions.mjs and production code.
 *
 * Export: default function(output, context) => { pass, score, reason, componentResults }
 */

import {
  extractJson,
  validateFlights,
  normalizeFlightDates,
  compareToGroundTruth,
  parseGroundTruth,
  DEFAULT_THRESHOLD,
} from './shared.mjs';

/**
 * @param {string} output  - Raw LLM response string
 * @param {object} context - promptfoo context; context.vars contains test variables
 * @returns {{ pass: boolean, score: number, reason: string, componentResults?: object[] }}
 */
export default function flightAssertion(output, context) {
  const reasons = [];
  const componentResults = [];

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

  // Normalize dates: strip time components (e.g. "2024-11-04T07:00:00" → "2024-11-04")
  normalizeFlightDates(flights);

  // -- Step 3: Validate IATA codes and dates --
  const { iataErrors, unknownIata, dateErrors } = validateFlights(flights);

  if (iataErrors.length > 0) {
    reasons.push(`IATA errors: ${iataErrors.join('; ')}`);
  }
  if (unknownIata.length > 0) {
    reasons.push(`Unknown but syntactically valid IATA codes: ${[...new Set(unknownIata)].join(', ')}`);
  }
  if (dateErrors.length > 0) {
    reasons.push(`Date errors: ${dateErrors.join('; ')}`);
  }

  // -- Step 4: Compare against ground truth (if provided) --
  const vars = context?.vars ?? {};
  const groundTruthRaw = vars.ground_truth;
  const threshold = parseFloat(vars.pass_threshold) || DEFAULT_THRESHOLD;

  if (groundTruthRaw) {
    const groundTruth = parseGroundTruth(groundTruthRaw);
    if (!groundTruth) {
      return { pass: false, score: 0, reason: 'Failed to parse ground_truth' };
    }

    const result = compareToGroundTruth(flights, groundTruth);
    const passThreshold = result.precision >= threshold && result.recall >= threshold;

    reasons.push(
      `Precision: ${(result.precision * 100).toFixed(1)}% | ` +
      `Recall: ${(result.recall * 100).toFixed(1)}% | ` +
      `F1: ${(result.f1 * 100).toFixed(1)}% | ` +
      `TP: ${result.truePositives}/${groundTruth.length} | ` +
      `EM: ${result.exactMatch ? 'YES' : 'NO'} | ` +
      `Airline acc: ${(result.airlineAcc * 100).toFixed(1)}% | ` +
      `FlightNum acc: ${(result.flightNumAcc * 100).toFixed(1)}%`
    );

    if (!passThreshold) {
      reasons.push(`FAILED: precision or recall below ${threshold} threshold`);
    }

    // Build componentResults for per-flight breakdowns in promptfoo UI
    for (const pf of result.perFlight) {
      componentResults.push({
        pass: pf.matched,
        score: pf.matched ? (pf.airlineMatch && pf.flightNumMatch ? 1 : 0.5) : 0,
        reason: pf.matched
          ? `${pf.extracted}: matched (airline: ${pf.airlineMatch ? 'OK' : 'MISMATCH'}, flightNum: ${pf.flightNumMatch ? 'OK' : 'MISMATCH'})`
          : `${pf.extracted}: no match in ground truth (false positive)`,
        assertion: { type: 'flight-match', value: pf.extracted },
      });
    }

    // Add missed ground truth flights as failed components
    const matchedIndices = new Set();
    for (const pf of result.perFlight) {
      if (pf.matched) {
        const idx = groundTruth.findIndex((gt, i) =>
          !matchedIndices.has(i) &&
          `${gt.origin}-${gt.destination} ${gt.date}` === pf.extracted
        );
        if (idx >= 0) matchedIndices.add(idx);
      }
    }
    for (let i = 0; i < groundTruth.length; i++) {
      if (!matchedIndices.has(i)) {
        const gt = groundTruth[i];
        componentResults.push({
          pass: false,
          score: 0,
          reason: `${gt.origin}-${gt.destination} ${gt.date}: missed (false negative)`,
          assertion: { type: 'flight-recall', value: `${gt.origin}-${gt.destination} ${gt.date}` },
        });
      }
    }

    return {
      pass: passThreshold && iataErrors.length === 0 && dateErrors.length === 0,
      score: result.f1,
      reason: reasons.join(' | '),
      componentResults: componentResults.length > 0 ? componentResults : undefined,
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
