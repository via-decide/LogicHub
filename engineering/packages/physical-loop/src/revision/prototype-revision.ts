import type { ProductGraph } from '@logichub-engineering/product-graph';
import { propagate } from '@logichub-engineering/product-graph';
import { getKit } from '@logichub-engineering/kit-matching';
import { hashValue } from '@logichub-engineering/project-capsule';
import type {
  ChecklistOutcome,
  EvidenceRecord,
  FlashRecord,
  KitIdentity,
  PrototypeRevision,
  UpgradeRecommendation,
} from '../schemas/loop.schema.js';
import type { Measurement } from '../schemas/measurement.schema.js';
import { compareToEstimates } from '../measurement/comparison.js';

export interface CreatePrototypeRevisionInput {
  identity: KitIdentity;
  graph: ProductGraph;
  checklist: ChecklistOutcome;
  flash: FlashRecord | null;
  /** Readings taken from the unit. This package never invents one. */
  measurements: readonly Measurement[];
  evidence: readonly EvidenceRecord[];
  savedAt: string;
}

/**
 * Save one pass around the physical loop as a prototype revision.
 *
 * The revision records what was actually done to one specific unit: which
 * checks were run, whether firmware was flashed, what was measured, and how
 * those readings compare to the estimates the design started from.
 *
 * Measuring a unit characterises that unit. It does not validate the design,
 * certify the product, or make it safe for anyone — there is no state here
 * that can express any of those, by design.
 */
export function createPrototypeRevision(
  input: CreatePrototypeRevisionInput,
): PrototypeRevision {
  for (const measurement of input.measurements) {
    if (
      measurement.unitSerial !== input.identity.unitSerial
      || measurement.hardwareRevision !== input.identity.hardwareRevision
    ) {
      throw new Error(
        `Measurement ${measurement.id} belongs to unit ${measurement.unitSerial} `
        + `(${measurement.hardwareRevision}), not ${input.identity.unitSerial} `
        + `(${input.identity.hardwareRevision}).`,
      );
    }
  }

  const resolved = propagate(input.graph).graph;
  const comparison = compareToEstimates(resolved, input.measurements);

  const measurements = [...input.measurements].sort((a, b) => (a.id < b.id ? -1 : 1));
  const evidence = [...input.evidence].sort((a, b) => (a.ref < b.ref ? -1 : 1));

  const productGraphHash = hashValue(resolved);

  const standing = measurements.length === 0
    ? 'UNVALIDATED'
    : comparison.complete
      ? 'CHARACTERISED'
      : 'PARTIAL';

  const revisionId = `proto_${hashValue({
    unitSerial: input.identity.unitSerial,
    hardwareRevision: input.identity.hardwareRevision,
    productGraphHash,
    measurementIds: measurements.map(m => m.id),
    savedAt: input.savedAt,
  }).slice(0, 16)}`;

  return {
    revisionId,
    identity: input.identity,
    sourceGraphId: resolved.id,
    productGraphHash,
    checklist: input.checklist,
    flash: input.flash,
    measurements,
    comparison,
    evidence,
    upgradeRecommendations: recommendUpgrades(input.identity, comparison),
    standing,
    savedAt: input.savedAt,
  };
}

/**
 * Suggest upgrades, driven by measured gaps where they exist.
 *
 * A recommendation only cites a measurement when one was actually taken. The
 * kit's own upgrade options are offered separately, without pretending they
 * follow from evidence.
 */
function recommendUpgrades(
  identity: KitIdentity,
  comparison: ReturnType<typeof compareToEstimates>,
): UpgradeRecommendation[] {
  const recommendations: UpgradeRecommendation[] = [];
  const kit = getKit(identity.kitId);

  for (const entry of comparison.comparisons) {
    if (entry.state !== 'COMPARED') continue;
    if (entry.percentDifference === undefined) continue;

    // Runtime falling well short of the estimate is the one gap the catalogue
    // has a direct answer for.
    if (entry.quantity === 'runtime' && entry.percentDifference <= -20) {
      recommendations.push({
        id: 'upgrade.pack-capacity',
        reason:
          `Measured runtime is ${Math.abs(entry.percentDifference)}% below the estimate. `
          + 'A higher-capacity pack would extend it.',
        drivenByQuantity: entry.quantity,
        upgradeOptionId: kit?.upgradeOptions.find(u => u.id.includes('battery'))?.id ?? null,
      });
    }

    if (entry.quantity === 'motor.peakCurrent' && entry.percentDifference >= 25) {
      recommendations.push({
        id: 'upgrade.supply-headroom',
        reason:
          `Measured peak motor current is ${entry.percentDifference}% above the estimate. `
          + 'Check the pack can deliver it before running under load.',
        drivenByQuantity: entry.quantity,
        upgradeOptionId: null,
      });
    }

    if (entry.quantity === 'bluetooth.range' && entry.percentDifference <= -30) {
      recommendations.push({
        id: 'upgrade.link-range',
        reason:
          `Measured link range is ${Math.abs(entry.percentDifference)}% below the estimate. `
          + 'Consider antenna placement or a different link before relying on the range.',
        drivenByQuantity: entry.quantity,
        upgradeOptionId: null,
      });
    }
  }

  if (!comparison.complete) {
    recommendations.push({
      id: 'measure.remaining-quantities',
      reason:
        `${comparison.unmeasuredQuantities.length} required quantities have not been `
        + 'measured. Complete them before drawing conclusions about this unit.',
      drivenByQuantity: null,
      upgradeOptionId: null,
    });
  }

  return recommendations.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
