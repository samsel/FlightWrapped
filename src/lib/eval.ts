import type { Flight, NormalizedEmail } from './types'

export interface EvalCase {
  email: NormalizedEmail
  groundTruth: Flight[]
}

export type EvalDataset = EvalCase[]

export interface FieldAccuracy {
  correct: number
  total: number
  accuracy: number
}

export interface EvalResult {
  totalEmails: number
  totalGroundTruthFlights: number
  totalExtractedFlights: number
  precision: number
  recall: number
  fieldAccuracy: {
    airline: FieldAccuracy
    flightNumber: FieldAccuracy
  }
}

/**
 * Evaluate extraction results against ground truth.
 *
 * Matching: origin + destination + date (case-insensitive, trimmed).
 * Field accuracy is tracked only for airline and flightNumber since
 * origin/destination/date are the match keys (always 100% for matched pairs).
 *
 * NOTE: This matching logic is also implemented in evals/assertions/shared.mjs
 * for the promptfoo eval suite. Keep both in sync if you change the algorithm.
 */
export function evaluateExtraction(
  extracted: Flight[],
  groundTruth: Flight[],
): { precision: number; recall: number; fieldAccuracy: EvalResult['fieldAccuracy'] } {
  if (groundTruth.length === 0 && extracted.length === 0) {
    return {
      precision: 1,
      recall: 1,
      fieldAccuracy: emptyFieldAccuracy(),
    }
  }

  if (groundTruth.length === 0) {
    return { precision: 0, recall: 1, fieldAccuracy: emptyFieldAccuracy() }
  }

  if (extracted.length === 0) {
    return { precision: 1, recall: 0, fieldAccuracy: emptyFieldAccuracy() }
  }

  // Match extracted flights to ground truth by origin+destination+date (case-insensitive)
  const matched = new Set<number>()
  let truePositives = 0
  const fieldAccuracy = emptyFieldAccuracy()

  for (const ext of extracted) {
    const matchIdx = groundTruth.findIndex(
      (gt, i) =>
        !matched.has(i) &&
        gt.origin.toUpperCase().trim() === ext.origin.toUpperCase().trim() &&
        gt.destination.toUpperCase().trim() === ext.destination.toUpperCase().trim() &&
        gt.date === ext.date,
    )

    if (matchIdx >= 0) {
      matched.add(matchIdx)
      truePositives++

      const gt = groundTruth[matchIdx]
      checkField(fieldAccuracy.airline, ext.airline, gt.airline)
      checkField(
        fieldAccuracy.flightNumber,
        normalizeFlightNum(ext.flightNumber),
        normalizeFlightNum(gt.flightNumber),
      )
    }
  }

  const precision = truePositives / extracted.length
  const recall = truePositives / groundTruth.length

  return { precision, recall, fieldAccuracy }
}

function checkField(acc: FieldAccuracy, extracted: string, truth: string) {
  acc.total++
  if (extracted.toUpperCase().trim() === truth.toUpperCase().trim()) {
    acc.correct++
  }
  acc.accuracy = acc.total > 0 ? acc.correct / acc.total : 0
}

function normalizeFlightNum(fn: string): string {
  return fn.replace(/\s+/g, '').toUpperCase()
}

function emptyFieldAccuracy(): EvalResult['fieldAccuracy'] {
  return {
    airline: { correct: 0, total: 0, accuracy: 0 },
    flightNumber: { correct: 0, total: 0, accuracy: 0 },
  }
}
