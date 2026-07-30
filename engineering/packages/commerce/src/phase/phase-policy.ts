import type { CommercePhase } from '../schemas/commerce.schema.js';

export interface PhasePolicy {
  phase: CommercePhase;
  name: string;
  /** Whether this build actually operates in this phase. */
  active: boolean;
  /** Whether a kit can be bought through the platform in this phase. */
  carriesInventory: boolean;
  description: string;
}

/**
 * The four commerce phases.
 *
 * Only Phase 1 is active. The rest are recorded so the roadmap is visible in
 * one place, not so they can be switched on — nothing reads `active` to decide
 * whether to enable a later phase, and there is no setter.
 */
export const PHASE_POLICIES: readonly PhasePolicy[] = [
  {
    phase: 1,
    name: 'No Inventory',
    active: true,
    carriesInventory: false,
    description:
      'Approved component profiles and external supplier links. The platform holds no '
      + 'stock and sells no kit.',
  },
  {
    phase: 2,
    name: 'Curated LogicHub Kits',
    active: false,
    carriesInventory: true,
    description:
      'A small set of standardised kits with locked manifests, pretested firmware and '
      + 'assembly evidence. Not enabled: no kit has been built or tested.',
  },
  {
    phase: 3,
    name: 'Certified Kit Marketplace',
    active: false,
    carriesInventory: true,
    description:
      'Third-party publishers supplying manifests, firmware, interfaces and validation '
      + 'evidence. Not enabled.',
  },
  {
    phase: 4,
    name: 'Custom Product Configuration',
    active: false,
    carriesInventory: true,
    description:
      'Custom BOM, PCB and enclosure generation with manufacturing handoff. Not enabled.',
  },
];

export const ACTIVE_PHASE: CommercePhase = 1;

export function getPhasePolicy(phase: CommercePhase): PhasePolicy {
  const policy = PHASE_POLICIES.find(p => p.phase === phase);
  if (!policy) throw new Error(`Unknown commerce phase: ${phase}`);
  return policy;
}

export function activePhasePolicy(): PhasePolicy {
  return getPhasePolicy(ACTIVE_PHASE);
}

/**
 * Whether a kit may be sold right now.
 *
 * Two independent conditions must both hold: the phase must carry inventory,
 * and the kit's parts must actually be sourced. In this build neither holds,
 * and the function is written so that fixing one alone is not enough.
 */
export function canSellKits(phase: CommercePhase, everyComponentSourced: boolean): boolean {
  return getPhasePolicy(phase).carriesInventory && everyComponentSourced;
}
