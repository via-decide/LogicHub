import type { LogicNode, ProductGraph } from '@logichub-engineering/product-graph';
import { matchProducts, propagate } from '@logichub-engineering/product-graph';
import { matchKits, type KitMatch } from '@logichub-engineering/kit-matching';
import { generateAllSurfaces } from '@logichub-engineering/generated-surfaces';
import { canonicalize } from '../canonical/canonical-json.js';

export interface SectionFile {
  path: string;
  content: string;
}

/**
 * Build every content file the capsule carries, excluding the manifest and
 * the checksum list, which are derived from these.
 */
export function buildSections(graph: ProductGraph): SectionFile[] {
  const { graph: resolved, violations } = propagate(graph);
  const nodes = [...resolved.nodes].sort((a, b) => (a.id < b.id ? -1 : 1));
  const feasibility = matchProducts(resolved);
  const kitMatches = matchKits(resolved);
  const surfaces = generateAllSurfaces(resolved);

  const files: SectionFile[] = [
    json('product-graph.json', resolved),
    json('assumptions.json', buildAssumptions(nodes)),
    json('constraints.json', {
      nodeConstraints: nodes
        .filter(n => n.constraints.length > 0)
        .map(n => ({ nodeId: n.id, nodeType: n.type, codes: [...n.constraints].sort() })),
      propagationViolations: violations,
    }),
    json('product-feasibility.json', {
      note:
        'Verdicts describe capability arithmetic only. They are not a statement that any '
        + 'product here has been built, measured, certified, or found safe.',
      results: feasibility,
    }),
    json('kit-match.json', {
      note:
        'Coverage describes which kit parts answer which nodes. Sourcing and validation '
        + 'states are carried per component and are not implied by a high match.',
      matches: kitMatches,
    }),

    json('hardware/architecture.json', {
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type,
        category: n.category,
        maturity: n.maturity,
        parameters: n.parameters,
      })),
    }),
    json('hardware/interfaces.json', {
      connections: [...resolved.connections]
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .map(c => ({ id: c.id, from: c.from, to: c.to, type: c.type })),
    }),
    json('hardware/pin-map.json', { assignments: buildPinMap(nodes) }),
    { path: 'hardware/bom.csv', content: buildBomCsv(kitMatches[0]) },

    json('firmware/firmware-contract.json', buildFirmwareContract(nodes)),
    json('firmware/commands.json', {
      commands: surfaces.operator.sections
        .flatMap(s => s.controls)
        .map(c => ({
          id: c.id,
          sourceNodeId: c.sourceNodeId,
          kind: c.kind,
          label: c.label,
          // Firmware owns the interlocks; a command is a request, not an override.
          firmwareInterlockRequired: c.firmwareInterlockRequired,
        })),
    }),
    json('firmware/telemetry.json', {
      channels: surfaces.operator.sections
        .flatMap(s => s.readouts)
        .map(r => ({
          id: r.id,
          sourceNodeId: r.sourceNodeId,
          label: r.label,
          unit: r.unit,
          epistemicState: r.epistemicState,
        })),
    }),

    json('applications/operator/surface.json', surfaces.operator),
    json('applications/engineering/surface.json', surfaces.engineering),
    json('applications/service/surface.json', surfaces.service),

    json('validation/rules.json', {
      note:
        'Rules recorded here are the constraint checks the graph ran. A rule that did not '
        + 'fire is not evidence that the design was validated against hardware.',
      constraintCodesRaised: [...new Set(violations.map(v => v.code))].sort(),
    }),
    { path: 'validation/verification-plan.md', content: buildVerificationPlan(nodes) },

    json('evidence/evidence-manifest.json', {
      // Nothing has been built or measured, so there is no evidence. The file
      // exists so its emptiness is explicit rather than an omission.
      entries: [],
      note:
        'No physical evidence has been captured for this project. No measurement, test '
        + 'result, or field observation is recorded here.',
    }),

    { path: 'requirements.md', content: buildRequirements(resolved, feasibility.length) },
    { path: 'README.md', content: buildReadme(resolved) },
  ];

  return files;
}

function json(path: string, value: unknown): SectionFile {
  return { path, content: canonicalize(value) };
}

/**
 * What the capsule is assuming rather than knowing. Every derived value is
 * listed with the standing its node gave it, so a reader can tell estimate
 * from calculation without opening the engine.
 */
function buildAssumptions(nodes: readonly LogicNode[]): unknown {
  return {
    note:
      'Values below are derived, not measured. ESTIMATED figures come from generic family '
      + 'data; CALCULATED figures follow from them arithmetically. Nothing here has been '
      + 'measured on hardware.',
    nodes: nodes.map(node => ({
      nodeId: node.id,
      nodeType: node.type,
      epistemicState: typeof node.derivedMetrics.epistemicState === 'string'
        ? node.derivedMetrics.epistemicState
        : 'UNKNOWN',
      derivedMetrics: node.derivedMetrics,
    })),
  };
}

function buildPinMap(nodes: readonly LogicNode[]): unknown[] {
  const assignments: unknown[] = [];
  for (const node of nodes) {
    if (node.type !== 'controller') continue;
    const pins = node.parameters.assignedPins;
    if (pins === null || typeof pins !== 'object') continue;
    const record = pins as Record<string, unknown>;
    for (const fn of Object.keys(record).sort()) {
      assignments.push({ nodeId: node.id, function: fn, pin: String(record[fn]) });
    }
  }
  return assignments;
}

const BOM_HEADER = [
  'componentId', 'name', 'partFamily', 'quantity',
  'manufacturerPartNumber', 'supplierSku', 'unitCost', 'currency',
  'availability', 'sourcingState',
].join(',');

/**
 * Bill of materials.
 *
 * Unsourced fields are written as the literal UNKNOWN rather than left blank
 * or filled with a plausible value, so a reader cannot mistake an absent
 * price for a free part.
 */
function buildBomCsv(bestMatch: KitMatch | undefined): string {
  if (bestMatch === undefined) {
    return `${BOM_HEADER}\n`;
  }

  const rows = [...bestMatch.componentManifest]
    .sort((a, b) => (a.component.id < b.component.id ? -1 : 1))
    .map(resolved => {
      const c = resolved.component;
      const cost = c.sourcing.cost;
      return [
        csv(c.id),
        csv(c.name),
        csv(c.partFamily ?? 'UNKNOWN'),
        String(resolved.quantity),
        csv(c.sourcing.manufacturerPartNumber ?? 'UNKNOWN'),
        csv(c.sourcing.supplierSku ?? 'UNKNOWN'),
        cost.state === 'KNOWN' ? String(cost.amount) : 'UNKNOWN',
        cost.state === 'KNOWN' ? csv(cost.currency) : 'UNKNOWN',
        csv(c.sourcing.availability),
        csv(c.sourcing.state),
      ].join(',');
    });

  return `${[BOM_HEADER, ...rows].join('\n')}\n`;
}

function csv(field: string): string {
  return /[",\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

function buildFirmwareContract(nodes: readonly LogicNode[]): unknown {
  const controller = nodes.find(n => n.type === 'controller');
  return {
    target: controller === undefined
      ? null
      : String(controller.derivedMetrics.model ?? 'unknown'),
    controllerNodeId: controller?.id ?? null,
    note:
      'Firmware owns every safety interlock. Generated applications issue requests and '
      + 'cannot disable, override, or bypass an interlock.',
    motorChannelsRequired: nodes.filter(n => n.type === 'motor').length,
    sensorChannelsRequired: nodes.filter(n => n.type === 'sensor').length,
  };
}

function buildVerificationPlan(nodes: readonly LogicNode[]): string {
  const lines = [
    '# Verification plan',
    '',
    'Nothing in this capsule has been verified against hardware. Every figure it',
    'carries is derived. This plan lists what would have to be measured before any',
    'claim about the built product could be made.',
    '',
    '## Outstanding',
    '',
  ];

  for (const node of nodes) {
    switch (node.type) {
      case 'battery':
        lines.push('- Measure pack voltage at rest and under load, and record actual runtime.');
        break;
      case 'motor':
        lines.push(`- Measure ${node.id} current draw and output speed under real load.`);
        break;
      case 'controller':
        lines.push(`- Confirm ${node.id} supply voltage at its input against its datasheet.`);
        break;
      case 'sensor':
        lines.push(`- Calibrate ${node.id} against a known reference and record the error.`);
        break;
      case 'connectivity':
        lines.push(`- Measure usable range for ${node.id} in the intended environment.`);
        break;
      default:
        break;
    }
  }

  lines.push(
    '',
    '## Not covered',
    '',
    '- No thermal model has been run, so no thermal limits are established.',
    '- No regulatory or safety certification is claimed or implied.',
    '- No enclosure rating (ingress, drop, flammability) has been established.',
    '',
  );

  return lines.join('\n');
}

function buildRequirements(graph: ProductGraph, templateCount: number): string {
  return [
    `# ${graph.name}`,
    '',
    '## What this project is',
    '',
    `A configuration of ${graph.nodes.length} node(s) evaluated against ${templateCount}`,
    'product templates. The contents of this capsule describe a design, not a built',
    'product.',
    '',
    '## Standing of the contents',
    '',
    '- Derived values are estimates or calculations, never measurements.',
    '- No component in the bill of materials has been sourced; part numbers, prices',
    '  and stock levels are recorded as UNKNOWN rather than filled in.',
    '- No physical evidence has been captured.',
    '- No certification, safety, or production-readiness claim is made.',
    '',
    '## User mode',
    '',
    `This project was configured in ${graph.userMode} mode.`,
    '',
  ].join('\n');
}

function buildReadme(graph: ProductGraph): string {
  return [
    `# ${graph.name} — LogicHub Project Capsule`,
    '',
    'A portable, self-contained record of one product configuration.',
    '',
    '## Integrity',
    '',
    'Every file is listed in `capsule-manifest.json` with its SHA-256 and byte length,',
    'and again in `checksums.sha256`. Verifying the capsule recomputes both. A capsule',
    'that cannot be fully checked is not verified; there is no partial pass.',
    '',
    '## Portability',
    '',
    'This capsule resolves nothing at open time. It has no remote dependency, and any',
    'external file it references is pinned by version, URI and checksum.',
    '',
    '## Reproducibility',
    '',
    'The capsule contains no wall-clock timestamp. The same product graph always',
    'produces byte-identical output, so a rebuild can be compared against the original',
    'directly.',
    '',
    '## What this capsule does not assert',
    '',
    'Nothing here has been built, measured, sourced, or certified. See',
    '`validation/verification-plan.md` for what would have to be measured first.',
    '',
  ].join('\n');
}
