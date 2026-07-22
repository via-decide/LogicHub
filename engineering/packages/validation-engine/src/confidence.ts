import type { EvidenceGrade } from './units/units.js';

/**
 * Explicit confidence classes — never unsupported floating-point "AI
 * confidence" values. Every result must explain its classification.
 */
export const CONFIDENCE_CLASSES = [
  'deterministic_verified_inputs',
  'deterministic_estimated_inputs',
  'empirical_calibrated',
  'heuristic',
  'insufficient_evidence',
] as const;

export type ConfidenceClass = (typeof CONFIDENCE_CLASSES)[number];

export interface ConfidenceAssessment {
  confidenceClass: ConfidenceClass;
  confidenceRationale: string;
}

/**
 * Derive a confidence class from the evidence grades of the inputs that a
 * deterministic calculation consumed.
 *
 * - any missing/unknown-grade required input  -> insufficient_evidence
 * - calculation anchored on measured calibration data -> empirical_calibrated
 * - all inputs verified/datasheet grade       -> deterministic_verified_inputs
 * - deterministic but >=1 estimated input     -> deterministic_estimated_inputs
 * - bounded rule without physical validation  -> heuristic (caller-declared)
 */
export function deriveConfidence(options: {
  requiredInputGrades: EvidenceGrade[];
  missingRequiredCount: number;
  anchoredOnMeasurement?: boolean;
  heuristicRule?: boolean;
}): ConfidenceAssessment {
  const { requiredInputGrades, missingRequiredCount } = options;

  if (missingRequiredCount > 0 || requiredInputGrades.includes('unknown')) {
    const missingNote = missingRequiredCount > 0
      ? `${missingRequiredCount} required input(s) absent`
      : 'at least one required input has unknown evidence grade';
    return {
      confidenceClass: 'insufficient_evidence',
      confidenceRationale: `Required data is absent or ungraded: ${missingNote}. The calculation cannot be trusted at any deterministic grade.`,
    };
  }

  if (options.anchoredOnMeasurement) {
    return {
      confidenceClass: 'empirical_calibrated',
      confidenceRationale: 'The result depends on measured calibration data from the specified hardware fixture.',
    };
  }

  if (options.heuristicRule) {
    return {
      confidenceClass: 'heuristic',
      confidenceRationale: 'The output is based on a bounded engineering rule that has not yet been physically validated.',
    };
  }

  if (requiredInputGrades.every(g => g === 'verified' || g === 'datasheet' || g === 'measured')) {
    return {
      confidenceClass: 'deterministic_verified_inputs',
      confidenceRationale: 'All required values come from controlled product specifications, reviewed datasheets, or measured fixtures.',
    };
  }

  return {
    confidenceClass: 'deterministic_estimated_inputs',
    confidenceRationale: 'The calculation is deterministic, but one or more inputs are engineering estimates.',
  };
}
