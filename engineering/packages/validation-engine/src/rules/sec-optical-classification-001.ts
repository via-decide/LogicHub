import type { OpticalClassificationInputs } from '../contracts/rule-inputs.schema.js';
import type { RuleDefinition } from '../contracts/rule-definition.schema.js';
import type { CheckFinding, TraceStep } from '../contracts/rule-result.schema.js';
import { deriveConfidence } from '../confidence.js';
import type { MissingInput } from '../units/units.js';
import { buildResult, round, type UnhashedRuleResult } from './shared.js';

export const RULE_ID = 'SEC-OPTICAL-CLASSIFICATION-001';
export const RULE_VERSION = '0.1.0';

export const definition: RuleDefinition = {
  ruleId: RULE_ID,
  ruleName: 'Optical token classification margin',
  ruleVersion: RULE_VERSION,
  purpose:
    'Determine whether the RGB LED + LDR optical system has enough deterministic separation to classify the configured passive tokens under the documented lighting and manufacturing conditions.',
  targetObjects: ['optical:token-wells', 'optical:tokens', 'pin-map:GPIO0', 'pin-map:GPIO1', 'pin-map:GPIO3', 'pin-map:GPIO4', 'pin-map:GPIO10'],
  requiredInputs: [
    { name: 'tokenClasses[].samplesR/G/B', unit: 'ADC counts', description: 'Per-class strobe response samples' },
    { name: 'calibration.darkReading', unit: 'ADC counts', description: 'Dark reading' },
    { name: 'calibration.ambientReading', unit: 'ADC counts', description: 'Ambient reading' },
    { name: 'calibration.calibratedAmbientMax', unit: 'ADC counts', description: 'Ambient ceiling of the calibrated envelope' },
    { name: 'calibration.normalizationReference', unit: 'ADC counts', description: 'Normalization reference' },
    { name: 'calibration.samplesPerClass', unit: 'count', description: 'Number of calibration samples' },
    { name: 'adc.saturationCeiling', unit: 'ADC counts', description: 'Saturation ceiling' },
    { name: 'thresholds', unit: 'normalized', description: 'unknownDistance, ambiguityMargin, minSeparationToSpreadRatio' },
  ],
  optionalInputs: [
    { name: 'measurement', unit: 'ADC counts', description: 'A single reading to classify against the calibrated classes' },
    { name: 'geometry/timing/ledBrightness/ldrDividerResistance', unit: 'various', description: 'Documented context inputs' },
  ],
  formulas: [
    { id: 'F1', expression: 'X_n = (V_X - V_dark) / normalization_reference for X in {R,G,B}', description: 'Dark-subtracted normalized spectral vector' },
    { id: 'F2', expression: 'd(a, b) = sqrt((R_a-R_b)^2 + (G_a-G_b)^2 + (B_a-B_b)^2)', description: 'Euclidean distance in normalized space' },
    { id: 'F3', expression: 'margin = d_second_nearest - d_nearest', description: 'Classification margin' },
    { id: 'F4', expression: 'spread_c = max_i d(sample_i, centroid_c)', description: 'Within-class spread' },
  ],
  deterministicProcedure: [
    'Validate calibration: dark reading, normalization reference, samples per class, saturation ceiling.',
    'Normalize every calibration sample with F1; flag saturated raw samples.',
    'Compute per-class centroids and within-class spreads (F4).',
    'Compute all pairwise centroid separations (F2); compare the minimum against the ambiguity margin and against the spread ratio threshold.',
    'If a measurement is supplied: refuse classification (unknown/ambiguous) when saturated, when dark is invalid, when ambient exceeds the calibrated envelope, when the nearest distance exceeds unknownDistance, or when the margin (F3) is below ambiguityMargin. Otherwise classify nearest-centroid.',
  ],
  assumptions: [
    'LDR response treated as monotonic within the calibrated envelope.',
    'Normalized space is Euclidean; channels are equally weighted.',
    'One bay illuminated per strobe (single-bay strobe policy).',
  ],
  thresholds: [
    { name: 'unknownDistance', value: 'case input', description: 'Distance beyond which a reading is outside calibrated space' },
    { name: 'ambiguityMargin', value: 'case input', description: 'Margin below which two classes are ambiguous' },
    { name: 'minSeparationToSpreadRatio', value: 'case input', description: 'Minimum inter-class separation to within-class spread ratio' },
  ],
  outputStates: ['pass', 'warning', 'fail', 'ambiguous', 'unknown', 'error', 'requires_validation'],
  confidenceRules: [
    'empirical_calibrated only when every token class declares measured-grade samples',
    'deterministic_estimated_inputs when samples are engineering estimates or synthetic fixtures',
    'insufficient_evidence when calibration data is missing or ungraded',
  ],
  evidenceRequirements: [
    'Measured calibration dumps per device (validation-plan tests 4-5)',
    'Confusion matrix across all token classes (validation-plan test 6)',
    'Filament-batch variation data (validation-plan test 7)',
  ],
  failureModes: [
    'Two token colors collapse under ambient drift',
    'ADC saturation in bright classrooms flattens the spectral vector',
    'Filament batch shifts a class across the decision boundary',
    'LED aging reduces separation over device lifetime',
  ],
  requiredTestFixtureTypes: [
    'clearly separated primary colors',
    'two visually similar token colors',
    'bright ambient light',
    'dark classroom',
    'partially inserted token',
    'dirty optical pocket',
    'token printed from a different filament batch',
    'LED aging / reduced brightness',
    'LDR tolerance variation',
    'unknown token',
  ],
  physicalValidationProcedure: [
    'validation-plan test 4: optical dark calibration',
    'validation-plan test 5: optical bright-ambient calibration',
    'validation-plan test 6: token confusion-matrix test',
    'validation-plan test 7: filament-batch variation test',
    'validation-plan test 8: token insertion repeatability',
  ],
  limitations: [
    'No spectral model of the LDR or LEDs — purely empirical centroids.',
    'Assumes calibration and measurement share device and geometry.',
    'Ten historical samples cannot establish population statistics.',
  ],
};

interface Vec3 { r: number; g: number; b: number }

function dist(a: Vec3, b: Vec3): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

export function evaluate(inputs: OpticalClassificationInputs): UnhashedRuleResult {
  const missing: MissingInput[] = [];
  const trace: TraceStep[] = [];
  const checks: CheckFinding[] = [];
  const warnings: string[] = [];

  const dark = inputs.calibration.darkReading;
  const ambientReading = inputs.calibration.ambientReading;
  const ambientMax = inputs.calibration.calibratedAmbientMax;
  const normRef = inputs.calibration.normalizationReference;
  const samplesPerClass = inputs.calibration.samplesPerClass;
  const ceiling = inputs.adc.saturationCeiling;

  if (dark === null) missing.push({ field: 'calibration.darkReading', reason: 'dark reading absent' });
  if (ambientReading === null) missing.push({ field: 'calibration.ambientReading', reason: 'ambient reading absent' });
  if (ambientMax === null) missing.push({ field: 'calibration.calibratedAmbientMax', reason: 'calibrated ambient envelope absent' });
  if (normRef === null) missing.push({ field: 'calibration.normalizationReference', reason: 'normalization reference absent' });
  if (samplesPerClass === null) missing.push({ field: 'calibration.samplesPerClass', reason: 'sample count absent' });
  if (ceiling === null) missing.push({ field: 'adc.saturationCeiling', reason: 'saturation ceiling absent' });
  if (inputs.tokenClasses.length === 0) missing.push({ field: 'tokenClasses', reason: 'no calibrated token classes' });

  // --- dark validity ---------------------------------------------------------
  let darkValid = false;
  if (dark !== null && normRef !== null && ceiling !== null) {
    darkValid = dark >= 0 && dark < ceiling && dark < 0.5 * normRef;
    checks.push(
      darkValid
        ? { check: 'dark-reading', status: 'pass', detail: `Dark reading ${dark} counts is inside the valid envelope.` }
        : { check: 'dark-reading', status: 'unknown', detail: `Dark reading ${dark} counts is invalid (negative, saturated, or >= 50% of normalization reference). Classification refused on this calibration.`, observed: dark },
    );
  }

  // --- ambient envelope ------------------------------------------------------
  let ambientInsideEnvelope = false;
  if (ambientReading !== null && ambientMax !== null) {
    ambientInsideEnvelope = ambientReading <= ambientMax;
    checks.push(
      ambientInsideEnvelope
        ? { check: 'ambient-envelope', status: 'pass', detail: `Ambient reading ${ambientReading} counts within calibrated envelope (max ${ambientMax}).`, threshold: ambientMax, observed: ambientReading }
        : { check: 'ambient-envelope', status: 'unknown', detail: `Ambient reading ${ambientReading} counts exceeds the calibrated envelope (${ambientMax}). Measurements outside the calibrated space are never classified.`, threshold: ambientMax, observed: ambientReading },
    );
  }

  // --- centroids, spreads, saturation ---------------------------------------
  const centroids: Array<{ name: string; centroid: Vec3; spread: number; saturated: boolean; sampleCount: number }> = [];
  if (dark !== null && normRef !== null && normRef > 0 && ceiling !== null) {
    for (const cls of inputs.tokenClasses) {
      const n = Math.min(cls.samplesR.length, cls.samplesG.length, cls.samplesB.length);
      let saturated = false;
      const normalized: Vec3[] = [];
      for (let i = 0; i < n; i++) {
        const rawR = cls.samplesR[i];
        const rawG = cls.samplesG[i];
        const rawB = cls.samplesB[i];
        if (rawR >= ceiling || rawG >= ceiling || rawB >= ceiling) saturated = true;
        normalized.push({
          r: (rawR - dark) / normRef,
          g: (rawG - dark) / normRef,
          b: (rawB - dark) / normRef,
        });
      }
      const centroid: Vec3 = {
        r: normalized.reduce((s, v) => s + v.r, 0) / n,
        g: normalized.reduce((s, v) => s + v.g, 0) / n,
        b: normalized.reduce((s, v) => s + v.b, 0) / n,
      };
      const spread = normalized.reduce((max, v) => Math.max(max, dist(v, centroid)), 0);
      centroids.push({ name: cls.name, centroid, spread, saturated, sampleCount: n });
      if (samplesPerClass !== null && n < samplesPerClass) {
        warnings.push(`Class '${cls.name}' has ${n} samples, fewer than the declared samplesPerClass ${samplesPerClass}.`);
      }
    }
    trace.push({
      step: 'class-centroids',
      formula: 'F1 normalization; centroid = mean; F4 spread = max distance to centroid',
      inputs: { dark, normalizationReference: normRef },
      output: centroids.map(c => ({
        name: c.name,
        centroid: { r: round(c.centroid.r), g: round(c.centroid.g), b: round(c.centroid.b) },
        spread: round(c.spread),
        saturated: c.saturated,
      })),
    });

    const saturatedClasses = centroids.filter(c => c.saturated).map(c => c.name);
    if (saturatedClasses.length > 0) {
      checks.push({
        check: 'calibration-saturation', status: 'unknown',
        detail: `Calibration samples saturate the ADC for class(es): ${saturatedClasses.sort().join(', ')}. Saturated centroids are untrustworthy; classification refused for those classes.`,
        observed: saturatedClasses.sort(),
      });
    }

    // --- pairwise separability ----------------------------------------------
    if (centroids.length >= 2) {
      let minSep = Number.POSITIVE_INFINITY;
      let minPair = ['', ''];
      const pairSeparations: Array<{ pair: string; separation: number }> = [];
      for (let i = 0; i < centroids.length; i++) {
        for (let j = i + 1; j < centroids.length; j++) {
          const d = dist(centroids[i].centroid, centroids[j].centroid);
          pairSeparations.push({ pair: `${centroids[i].name}|${centroids[j].name}`, separation: round(d) });
          if (d < minSep) {
            minSep = d;
            minPair = [centroids[i].name, centroids[j].name];
          }
        }
      }
      const maxSpread = centroids.reduce((m, c) => Math.max(m, c.spread), 0);
      trace.push({
        step: 'pairwise-separation', formula: 'F2 over all centroid pairs',
        inputs: { classCount: centroids.length },
        output: { pairSeparations: pairSeparations.sort((a, b) => a.pair.localeCompare(b.pair)), minSeparation: round(minSep), maxWithinClassSpread: round(maxSpread) },
      });

      if (minSep < inputs.thresholds.ambiguityMargin) {
        checks.push({
          check: 'class-separability', status: 'fail',
          detail: `Classes '${minPair[0]}' and '${minPair[1]}' are separated by ${round(minSep, 4)} in normalized space — inside the ambiguity margin ${inputs.thresholds.ambiguityMargin}. These tokens cannot be told apart deterministically.`,
          threshold: inputs.thresholds.ambiguityMargin, observed: round(minSep, 4),
        });
      } else if (maxSpread > 0 && minSep / maxSpread < inputs.thresholds.minSeparationToSpreadRatio) {
        checks.push({
          check: 'class-separability', status: 'warning',
          detail: `Minimum separation ${round(minSep, 4)} over maximum within-class spread ${round(maxSpread, 4)} gives ratio ${round(minSep / maxSpread, 2)}, below the required ${inputs.thresholds.minSeparationToSpreadRatio}. Margins may collapse under drift.`,
          threshold: inputs.thresholds.minSeparationToSpreadRatio, observed: round(minSep / maxSpread, 4),
        });
      } else {
        checks.push({
          check: 'class-separability', status: 'pass',
          detail: `All ${centroids.length} classes separated; minimum separation ${round(minSep, 4)} (pair ${minPair[0]}|${minPair[1]}), max within-class spread ${round(maxSpread, 4)}.`,
          threshold: inputs.thresholds.ambiguityMargin, observed: round(minSep, 4),
        });
      }
    }
  }

  // --- optional single-measurement classification ----------------------------
  let classified: string | null = null;
  let classificationState: string | null = null;
  const m = inputs.measurement ?? null;
  if (m !== null) {
    if (dark === null || normRef === null || normRef <= 0 || ceiling === null || centroids.length === 0) {
      checks.push({ check: 'measurement-classification', status: 'unknown', detail: 'Measurement supplied but calibration is incomplete — classification refused.' });
      classificationState = 'unknown';
    } else if (m.R >= ceiling || m.G >= ceiling || m.B >= ceiling) {
      checks.push({ check: 'measurement-classification', status: 'unknown', detail: 'Measurement saturates the ADC — identity is never forced on saturated readings.', observed: { R: m.R, G: m.G, B: m.B } });
      classificationState = 'unknown';
    } else if (!darkValid || (m.dark >= 0.5 * normRef || m.dark < 0)) {
      checks.push({ check: 'measurement-classification', status: 'unknown', detail: 'Dark reading invalid for this measurement — classification refused.' });
      classificationState = 'unknown';
    } else if (m.ambient !== null && ambientMax !== null && m.ambient > ambientMax) {
      checks.push({ check: 'measurement-classification', status: 'unknown', detail: `Measurement ambient ${m.ambient} exceeds calibrated envelope ${ambientMax} — outside calibrated space, classification refused.`, threshold: ambientMax, observed: m.ambient });
      classificationState = 'unknown';
    } else {
      const v: Vec3 = { r: (m.R - m.dark) / normRef, g: (m.G - m.dark) / normRef, b: (m.B - m.dark) / normRef };
      const usable = centroids.filter(c => !c.saturated);
      const ranked = usable
        .map(c => ({ name: c.name, d: dist(v, c.centroid) }))
        .sort((a, b) => a.d - b.d || a.name.localeCompare(b.name));
      if (ranked.length === 0) {
        checks.push({ check: 'measurement-classification', status: 'unknown', detail: 'No unsaturated calibrated classes available.' });
        classificationState = 'unknown';
      } else {
        const d1 = ranked[0].d;
        const d2 = ranked.length > 1 ? ranked[1].d : Number.POSITIVE_INFINITY;
        const margin = ranked.length > 1 ? d2 - d1 : null;
        trace.push({
          step: 'measurement-classification', formula: 'F1, F2, F3',
          inputs: { normalized: { r: round(v.r), g: round(v.g), b: round(v.b) } },
          output: {
            nearest: ranked[0].name, nearestDistance: round(d1),
            secondNearest: ranked.length > 1 ? ranked[1].name : null,
            secondDistance: ranked.length > 1 ? round(d2) : null,
            margin: margin === null ? null : round(margin),
          },
        });
        if (d1 > inputs.thresholds.unknownDistance) {
          checks.push({
            check: 'measurement-classification', status: 'unknown',
            detail: `Nearest class '${ranked[0].name}' at distance ${round(d1, 4)} exceeds unknownDistance ${inputs.thresholds.unknownDistance} — token is outside calibrated space (explicit unknown-token state).`,
            threshold: inputs.thresholds.unknownDistance, observed: round(d1, 4),
          });
          classificationState = 'unknown';
        } else if (margin !== null && margin < inputs.thresholds.ambiguityMargin) {
          checks.push({
            check: 'measurement-classification', status: 'ambiguous',
            detail: `Margin ${round(margin, 4)} between '${ranked[0].name}' and '${ranked[1].name}' is below ambiguityMargin ${inputs.thresholds.ambiguityMargin} — explicit ambiguous-token state, identity not forced.`,
            threshold: inputs.thresholds.ambiguityMargin, observed: round(margin, 4),
          });
          classificationState = 'ambiguous';
        } else {
          classified = ranked[0].name;
          classificationState = 'classified';
          checks.push({
            check: 'measurement-classification', status: 'pass',
            detail: `Measurement classified as '${classified}' with distance ${round(d1, 4)} and margin ${margin === null ? 'n/a (single class)' : round(margin, 4)}.`,
            observed: round(d1, 4),
          });
        }
      }
    }
  }

  if (missing.length > 0) {
    checks.push({
      check: 'input-completeness', status: 'unknown',
      detail: `Required calibration inputs absent: ${missing.map(x => x.field).sort().join(', ')}. Unknown never becomes pass.`,
    });
  }

  const grades = inputs.tokenClasses.map(c => (c.samplesEvidenceGrade === 'measured' ? 'measured' : c.samplesEvidenceGrade === 'estimated' ? 'estimated' : 'unknown') as 'measured' | 'estimated' | 'unknown');
  const confidence = deriveConfidence({
    requiredInputGrades: grades,
    missingRequiredCount: missing.length,
    anchoredOnMeasurement: grades.length > 0 && grades.every(g => g === 'measured'),
  });

  const spreads = centroids.map(c => round(c.spread));
  const metrics: Record<string, number | string | null> = {
    classCount: centroids.length,
    maxWithinClassSpread: spreads.length > 0 ? Math.max(...spreads) : null,
    classifiedAs: classified,
    classificationState,
    ambientDrift_counts: ambientReading !== null && dark !== null ? round(ambientReading - dark) : null,
  };

  return buildResult({
    ruleId: RULE_ID,
    ruleVersion: RULE_VERSION,
    inputs: {
      calibration: inputs.calibration,
      adc: inputs.adc,
      thresholds: inputs.thresholds,
      tokenClassNames: inputs.tokenClasses.map(c => c.name).sort(),
    },
    inputProvenance: Object.fromEntries(
      inputs.tokenClasses.map(c => [`tokenClasses.${c.name}`, `samplesEvidenceGrade=${c.samplesEvidenceGrade}`]),
    ),
    assumptions: definition.assumptions,
    procedure: definition.formulas.map(f => `${f.id}: ${f.expression}`),
    trace,
    thresholds: inputs.thresholds,
    checks,
    metrics,
    confidence,
    unknowns: missing,
    warnings,
    failureModes: definition.failureModes,
    requiredTests: definition.physicalValidationProcedure,
    affectedObjects: definition.targetObjects,
    evidenceReferences: [],
  });
}
