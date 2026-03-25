/**
 * Custom promptfoo assertion provider for batch (multi-email) flight extraction.
 *
 * The LLM output contains per-email keys (email_1, email_2, email_3) each with
 * a flights array. Ground truth is provided via context.vars as ground_truth_1,
 * ground_truth_2, ground_truth_3 etc. Each email's extraction is validated
 * independently and results are aggregated.
 *
 * Uses the same JSON extraction, IATA validation, date validation, and
 * flight matching logic as flight-assertions.mjs.
 *
 * Export: default function(output, context) => { pass, score, reason }
 */

// Hardcoded common IATA codes (same set as flight-assertions.mjs)
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
 */
function extractJson(raw) {
  if (!raw || typeof raw !== 'string') return null;

  let content = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  content = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  const openIdx = content.indexOf('{');
  if (openIdx === -1) return null;

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
// Validation helpers
// ---------------------------------------------------------------------------

function isValidIata(code) {
  if (!code || typeof code !== 'string') return false;
  return IATA_RE.test(code.toUpperCase().trim());
}

function isKnownIata(code) {
  return VALID_IATA.has(code.toUpperCase().trim());
}

function isValidDate(d) {
  return typeof d === 'string' && DATE_RE.test(d);
}

function normalizeFlightNum(fn) {
  if (!fn || typeof fn !== 'string') return '';
  return fn.replace(/\s+/g, '').toUpperCase();
}

// ---------------------------------------------------------------------------
// Per-email validation
// ---------------------------------------------------------------------------

/**
 * Validate structural integrity of a flights array.
 * Returns { iataErrors, unknownIata, dateErrors }.
 */
function validateFlights(flights) {
  const iataErrors = [];
  const unknownIata = [];
  const dateErrors = [];

  for (let i = 0; i < flights.length; i++) {
    const f = flights[i];
    if (!f || typeof f !== 'object') continue;

    const origin = String(f.origin ?? '').toUpperCase().trim();
    const dest = String(f.destination ?? '').toUpperCase().trim();
    const date = String(f.date ?? '');

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

    if (!isValidDate(date)) {
      dateErrors.push(`Flight ${i}: invalid date "${date}"`);
    }
  }

  return { iataErrors, unknownIata, dateErrors };
}

// ---------------------------------------------------------------------------
// Ground-truth comparison (same logic as eval.ts / flight-assertions.mjs)
// ---------------------------------------------------------------------------

/**
 * Match extracted flights to ground truth by origin + destination + date.
 */
function compareToGroundTruth(extracted, groundTruth) {
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

      if ((ext.airline || '').toUpperCase().trim() === (gt.airline || '').toUpperCase().trim()) {
        airlineCorrect++;
      }
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

/**
 * Parse ground truth from a context.vars value.
 * Accepts a JSON string or an already-parsed object/array.
 * Returns a flights array, or null on failure.
 */
function parseGroundTruth(raw) {
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

// ---------------------------------------------------------------------------
// Main batch assertion entry point
// ---------------------------------------------------------------------------

/**
 * @param {string} output  - Raw LLM response containing per-email extraction keys
 * @param {object} context - promptfoo context; context.vars contains ground_truth_1, etc.
 * @returns {{ pass: boolean, score: number, reason: string }}
 */
export default function batchAssertion(output, context) {
  // -- Step 1: Parse JSON from LLM output --
  if (!output || typeof output !== 'string' || output.trim().length === 0) {
    return { pass: false, score: 0, reason: 'Empty LLM output' };
  }

  const parsed = extractJson(output);
  if (!parsed || typeof parsed !== 'object') {
    return { pass: false, score: 0, reason: 'Could not extract valid JSON from LLM output' };
  }

  // -- Step 2: Discover email keys --
  // Look for keys like email_1, email_2, email_3, Email_1, Email 1, etc.
  // Also check how many ground_truth_N vars exist to know expected count.
  const vars = context?.vars ?? {};

  // Determine the number of emails by scanning ground_truth_N keys
  let emailCount = 0;
  for (let n = 1; n <= 20; n++) {
    if (vars[`ground_truth_${n}`] !== undefined) {
      emailCount = n;
    } else {
      break;
    }
  }

  // If no ground truth keys found, infer count from parsed output keys
  if (emailCount === 0) {
    for (let n = 1; n <= 20; n++) {
      const key = `email_${n}`;
      if (parsed[key] !== undefined || parsed[`Email ${n}`] !== undefined || parsed[`Email_${n}`] !== undefined) {
        emailCount = n;
      } else {
        break;
      }
    }
  }

  if (emailCount === 0) {
    return {
      pass: false,
      score: 0,
      reason: 'No email keys found in output and no ground_truth_N vars provided',
    };
  }

  // -- Step 3: Process each email independently --
  const perEmailResults = [];
  let totalTP = 0;
  let totalExtracted = 0;
  let totalGroundTruth = 0;
  let allStructureValid = true;
  let anyGroundTruth = false;

  for (let n = 1; n <= emailCount; n++) {
    const emailKey = `email_${n}`;
    const emailData = parsed[emailKey] ?? parsed[`Email ${n}`] ?? parsed[`Email_${n}`];

    // Extract flights array from this email's data
    let flights = [];
    if (emailData && typeof emailData === 'object') {
      const rawFlights = emailData.flights ?? emailData.flight ?? [];
      flights = Array.isArray(rawFlights) ? rawFlights : [rawFlights];
    }

    // Validate structure
    const validation = validateFlights(flights);
    const structureValid = validation.iataErrors.length === 0 && validation.dateErrors.length === 0;
    if (!structureValid) allStructureValid = false;

    // Compare to ground truth if available
    const gtRaw = vars[`ground_truth_${n}`];
    const groundTruth = parseGroundTruth(gtRaw);

    let emailResult;
    if (groundTruth) {
      anyGroundTruth = true;
      const comparison = compareToGroundTruth(flights, groundTruth);
      totalTP += comparison.truePositives;
      totalExtracted += flights.length;
      totalGroundTruth += groundTruth.length;

      emailResult = {
        email: n,
        extracted: flights.length,
        groundTruth: groundTruth.length,
        ...comparison,
        structureValid,
        validationIssues: [
          ...validation.iataErrors,
          ...validation.dateErrors,
        ],
      };
    } else {
      totalExtracted += flights.length;
      emailResult = {
        email: n,
        extracted: flights.length,
        groundTruth: 0,
        structureValid,
        validationIssues: [
          ...validation.iataErrors,
          ...validation.dateErrors,
        ],
      };
    }

    perEmailResults.push(emailResult);
  }

  // -- Step 4: Aggregate results --
  const reasons = [];

  // Build per-email summary lines
  for (const r of perEmailResults) {
    const parts = [`Email ${r.email}: ${r.extracted} extracted`];
    if (r.groundTruth !== undefined && r.groundTruth > 0) {
      parts.push(`${r.truePositives}/${r.groundTruth} matched`);
      parts.push(`P=${(r.precision * 100).toFixed(0)}% R=${(r.recall * 100).toFixed(0)}%`);
    }
    if (!r.structureValid) {
      parts.push(`ISSUES: ${r.validationIssues.join('; ')}`);
    }
    reasons.push(parts.join(', '));
  }

  // Calculate aggregate precision/recall/F1
  let aggregatePrecision, aggregateRecall, aggregateF1;

  if (anyGroundTruth) {
    if (totalExtracted === 0 && totalGroundTruth === 0) {
      aggregatePrecision = 1;
      aggregateRecall = 1;
    } else if (totalExtracted === 0) {
      aggregatePrecision = 1;
      aggregateRecall = 0;
    } else if (totalGroundTruth === 0) {
      aggregatePrecision = 0;
      aggregateRecall = 1;
    } else {
      aggregatePrecision = totalTP / totalExtracted;
      aggregateRecall = totalTP / totalGroundTruth;
    }

    aggregateF1 = aggregatePrecision + aggregateRecall > 0
      ? (2 * aggregatePrecision * aggregateRecall) / (aggregatePrecision + aggregateRecall)
      : 0;

    reasons.push(
      `Aggregate: P=${(aggregatePrecision * 100).toFixed(1)}% ` +
      `R=${(aggregateRecall * 100).toFixed(1)}% ` +
      `F1=${(aggregateF1 * 100).toFixed(1)}% ` +
      `(${totalTP}/${totalGroundTruth} TP across ${emailCount} emails)`
    );

    const passThreshold = aggregatePrecision >= 0.8 && aggregateRecall >= 0.8;
    if (!passThreshold) {
      reasons.push('FAILED: aggregate precision or recall below 0.8 threshold');
    }

    return {
      pass: passThreshold && allStructureValid,
      score: aggregateF1,
      reason: reasons.join(' | '),
    };
  }

  // No ground truth at all -- pass based on structure validity
  reasons.push(
    `No ground truth provided. ${emailCount} email(s) parsed, ` +
    `structure ${allStructureValid ? 'valid' : 'invalid'}`
  );

  return {
    pass: allStructureValid,
    score: allStructureValid ? 1 : 0,
    reason: reasons.join(' | '),
  };
}
