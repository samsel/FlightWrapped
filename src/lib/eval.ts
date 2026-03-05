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
    origin: FieldAccuracy
    destination: FieldAccuracy
    date: FieldAccuracy
    airline: FieldAccuracy
    flightNumber: FieldAccuracy
  }
}

/**
 * Evaluate extraction results against ground truth.
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

  // Match extracted flights to ground truth by origin+destination+date
  const matched = new Set<number>()
  let truePositives = 0
  const fieldAccuracy = emptyFieldAccuracy()

  for (const ext of extracted) {
    const matchIdx = groundTruth.findIndex(
      (gt, i) =>
        !matched.has(i) &&
        gt.origin === ext.origin &&
        gt.destination === ext.destination &&
        gt.date === ext.date,
    )

    if (matchIdx >= 0) {
      matched.add(matchIdx)
      truePositives++

      const gt = groundTruth[matchIdx]
      checkField(fieldAccuracy.origin, ext.origin, gt.origin)
      checkField(fieldAccuracy.destination, ext.destination, gt.destination)
      checkField(fieldAccuracy.date, ext.date, gt.date)
      checkField(fieldAccuracy.airline, ext.airline, gt.airline)
      checkField(fieldAccuracy.flightNumber, normalizeFlightNum(ext.flightNumber), normalizeFlightNum(gt.flightNumber))
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
    origin: { correct: 0, total: 0, accuracy: 0 },
    destination: { correct: 0, total: 0, accuracy: 0 },
    date: { correct: 0, total: 0, accuracy: 0 },
    airline: { correct: 0, total: 0, accuracy: 0 },
    flightNumber: { correct: 0, total: 0, accuracy: 0 },
  }
}
