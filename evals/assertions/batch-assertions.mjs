/**
 * Custom promptfoo assertion provider for batch (multi-email) flight extraction.
 *
 * The LLM output contains per-email keys (email_1, email_2, email_3) each with
 * a flights array. Ground truth is provided via context.vars as ground_truth_1,
 * ground_truth_2, ground_truth_3 etc. Each email's extraction is validated
 * independently and results are aggregated.
 *
 * All parsing, validation, and comparison logic lives in shared.mjs to
 * stay in sync with flight-assertions.mjs and production code.
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

    // Normalize dates (same as single-email assertions)
    normalizeFlightDates(flights);

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
