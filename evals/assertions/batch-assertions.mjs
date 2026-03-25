/**
 * Custom promptfoo assertion provider for batch (multi-email) flight extraction.
 *
 * The LLM output contains per-email keys (email_1, email_2, email_3) each with
 * a flights array. Ground truth is provided via context.vars as ground_truth_1,
 * ground_truth_2, ground_truth_3 etc. Each email's extraction is validated
 * independently and results are aggregated.
 *
 * Features:
 *   - Configurable pass threshold via context.vars.pass_threshold (default 0.8)
 *   - Micro + macro F1 (macro catches per-email failures masked by aggregation)
 *   - Exact-match (EM) metric per email
 *   - componentResults for per-email breakdowns in promptfoo UI
 *
 * Export: default function(output, context) => { pass, score, reason, componentResults }
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
  'STN', 'BGY', 'MDW', 'YVR', 'AUH', 'GIG', 'TBS', 'KBP',
]);

const DEFAULT_THRESHOLD = 0.8;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const IATA_RE = /^[A-Z]{3}$/;

// ---------------------------------------------------------------------------
// JSON extraction -- mirrors the greedy { ... } approach in production llm.ts
// ---------------------------------------------------------------------------

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

function compareToGroundTruth(extracted, groundTruth) {
  if (groundTruth.length === 0 && extracted.length === 0) {
    return { precision: 1, recall: 1, f1: 1, truePositives: 0, exactMatch: true, airlineAcc: 1, flightNumAcc: 1 };
  }
  if (groundTruth.length === 0) {
    return { precision: 0, recall: 1, f1: 0, truePositives: 0, exactMatch: false, airlineAcc: 0, flightNumAcc: 0 };
  }
  if (extracted.length === 0) {
    return { precision: 1, recall: 0, f1: 0, truePositives: 0, exactMatch: false, airlineAcc: 0, flightNumAcc: 0 };
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

      if ((ext.airline || '').toUpperCase().trim() === (gt.airline || '').toUpperCase().trim()) airlineCorrect++;
      if (normalizeFlightNum(ext.flightNumber) === normalizeFlightNum(gt.flightNumber)) flightNumCorrect++;
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

  return { precision, recall, f1, truePositives, exactMatch, airlineAcc, flightNumAcc };
}

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
 * @returns {{ pass: boolean, score: number, reason: string, componentResults?: object[] }}
 */
export default function batchAssertion(output, context) {
  if (!output || typeof output !== 'string' || output.trim().length === 0) {
    return { pass: false, score: 0, reason: 'Empty LLM output' };
  }

  const parsed = extractJson(output);
  if (!parsed || typeof parsed !== 'object') {
    return { pass: false, score: 0, reason: 'Could not extract valid JSON from LLM output' };
  }

  const vars = context?.vars ?? {};
  const threshold = parseFloat(vars.pass_threshold) || DEFAULT_THRESHOLD;

  // Determine email count from ground_truth_N keys or output keys
  let emailCount = 0;
  for (let n = 1; n <= 20; n++) {
    if (vars[`ground_truth_${n}`] !== undefined) emailCount = n;
    else break;
  }
  if (emailCount === 0) {
    for (let n = 1; n <= 20; n++) {
      if (parsed[`email_${n}`] !== undefined || parsed[`Email ${n}`] !== undefined || parsed[`Email_${n}`] !== undefined) emailCount = n;
      else break;
    }
  }

  if (emailCount === 0) {
    return { pass: false, score: 0, reason: 'No email keys found in output and no ground_truth_N vars provided' };
  }

  // Process each email independently
  const perEmailResults = [];
  const componentResults = [];
  let totalTP = 0;
  let totalExtracted = 0;
  let totalGroundTruth = 0;
  let allStructureValid = true;
  let anyGroundTruth = false;
  const perEmailF1s = [];

  for (let n = 1; n <= emailCount; n++) {
    const emailData = parsed[`email_${n}`] ?? parsed[`Email ${n}`] ?? parsed[`Email_${n}`];

    let flights = [];
    if (emailData && typeof emailData === 'object') {
      const rawFlights = emailData.flights ?? emailData.flight ?? [];
      flights = Array.isArray(rawFlights) ? rawFlights : [rawFlights];
    }

    const validation = validateFlights(flights);
    const structureValid = validation.iataErrors.length === 0 && validation.dateErrors.length === 0;
    if (!structureValid) allStructureValid = false;

    const gtRaw = vars[`ground_truth_${n}`];
    const groundTruth = parseGroundTruth(gtRaw);

    if (groundTruth) {
      anyGroundTruth = true;
      const comparison = compareToGroundTruth(flights, groundTruth);
      totalTP += comparison.truePositives;
      totalExtracted += flights.length;
      totalGroundTruth += groundTruth.length;
      perEmailF1s.push(comparison.f1);

      perEmailResults.push({
        email: n, extracted: flights.length, groundTruth: groundTruth.length,
        ...comparison, structureValid,
        validationIssues: [...validation.iataErrors, ...validation.dateErrors],
      });

      // componentResult for this email
      componentResults.push({
        pass: comparison.precision >= threshold && comparison.recall >= threshold && structureValid,
        score: comparison.f1,
        reason: `Email ${n}: ${comparison.truePositives}/${groundTruth.length} TP, P=${(comparison.precision * 100).toFixed(0)}% R=${(comparison.recall * 100).toFixed(0)}% F1=${(comparison.f1 * 100).toFixed(0)}% EM=${comparison.exactMatch ? 'YES' : 'NO'}`,
        assertion: { type: 'batch-email', value: `email_${n}` },
      });
    } else {
      totalExtracted += flights.length;
      perEmailResults.push({
        email: n, extracted: flights.length, groundTruth: 0, structureValid,
        validationIssues: [...validation.iataErrors, ...validation.dateErrors],
      });
    }
  }

  // Aggregate results
  const reasons = [];

  for (const r of perEmailResults) {
    const parts = [`Email ${r.email}: ${r.extracted} extracted`];
    if (r.groundTruth !== undefined && r.groundTruth > 0) {
      parts.push(`${r.truePositives}/${r.groundTruth} matched`);
      parts.push(`P=${(r.precision * 100).toFixed(0)}% R=${(r.recall * 100).toFixed(0)}%`);
      parts.push(`EM=${r.exactMatch ? 'YES' : 'NO'}`);
    }
    if (!r.structureValid) parts.push(`ISSUES: ${r.validationIssues.join('; ')}`);
    reasons.push(parts.join(', '));
  }

  if (anyGroundTruth) {
    let aggregatePrecision, aggregateRecall, aggregateF1;

    if (totalExtracted === 0 && totalGroundTruth === 0) {
      aggregatePrecision = 1; aggregateRecall = 1;
    } else if (totalExtracted === 0) {
      aggregatePrecision = 1; aggregateRecall = 0;
    } else if (totalGroundTruth === 0) {
      aggregatePrecision = 0; aggregateRecall = 1;
    } else {
      aggregatePrecision = totalTP / totalExtracted;
      aggregateRecall = totalTP / totalGroundTruth;
    }

    aggregateF1 = aggregatePrecision + aggregateRecall > 0
      ? (2 * aggregatePrecision * aggregateRecall) / (aggregatePrecision + aggregateRecall)
      : 0;

    // Macro F1: average of per-email F1 scores (catches individual email failures)
    const macroF1 = perEmailF1s.length > 0
      ? perEmailF1s.reduce((a, b) => a + b, 0) / perEmailF1s.length
      : 0;

    reasons.push(
      `Aggregate: P=${(aggregatePrecision * 100).toFixed(1)}% ` +
      `R=${(aggregateRecall * 100).toFixed(1)}% ` +
      `Micro-F1=${(aggregateF1 * 100).toFixed(1)}% ` +
      `Macro-F1=${(macroF1 * 100).toFixed(1)}% ` +
      `(${totalTP}/${totalGroundTruth} TP across ${emailCount} emails)`
    );

    const passThreshold = aggregatePrecision >= threshold && aggregateRecall >= threshold;
    if (!passThreshold) {
      reasons.push(`FAILED: aggregate precision or recall below ${threshold} threshold`);
    }

    return {
      pass: passThreshold && allStructureValid,
      score: aggregateF1,
      reason: reasons.join(' | '),
      componentResults: componentResults.length > 0 ? componentResults : undefined,
    };
  }

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
