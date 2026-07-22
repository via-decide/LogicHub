import type { FingerprintDescriptor } from '../types.js';
import type { DeltaRecord, ImpactRecord, StalenessRecord, EngineeringPrSummary } from './types.js';
import { sortStrings } from '../util/deterministic.js';

export function buildPrSummary(
  base: FingerprintDescriptor,
  proposed: FingerprintDescriptor,
  deltas: DeltaRecord[],
  impacts: ImpactRecord[],
  staleEvidence: StalenessRecord[],
): EngineeringPrSummary {
  const changeCountsByDomain: Record<string, number> = {};
  const changeCountsByType: Record<string, number> = {};

  for (const d of deltas) {
    changeCountsByDomain[d.domain] = (changeCountsByDomain[d.domain] ?? 0) + 1;
    changeCountsByType[d.deltaType] = (changeCountsByType[d.deltaType] ?? 0) + 1;
  }

  const breakingSoftwareChanges: string[] = [];
  const changedExternalInterfaces: string[] = [];
  for (const d of deltas) {
    if (d.domain === 'software') {
      if (d.deltaType === 'API_REMOVED' || d.deltaType === 'SIGNATURE_CHANGED') {
        breakingSoftwareChanges.push(d.oldSemanticId ?? d.newSemanticId ?? d.recordId);
      }
      if (d.deltaType === 'ENTRY_POINT_ADDED' || d.deltaType === 'ENTRY_POINT_REMOVED') {
        changedExternalInterfaces.push(d.oldSemanticId ?? d.newSemanticId ?? d.recordId);
      }
    }
  }

  const changedNets: string[] = [];
  for (const d of deltas) {
    if (d.deltaType === 'NET_ADDED' || d.deltaType === 'NET_REMOVED' || d.deltaType === 'NET_RENAMED') {
      changedNets.push(d.oldSemanticId ?? d.newSemanticId ?? d.recordId);
    }
  }

  const changedComponentMappings: string[] = [];
  for (const d of deltas) {
    if (d.deltaType === 'SYMBOL_FOOTPRINT_CHANGED' || d.deltaType === 'SYMBOL_VALUE_CHANGED') {
      changedComponentMappings.push(d.oldSemanticId ?? d.recordId);
    }
  }

  const bomRiskChanges: string[] = [];
  for (const d of deltas) {
    if (d.domain === 'bom') {
      bomRiskChanges.push(`${d.deltaType}: ${d.oldSemanticId ?? d.newSemanticId ?? d.recordId}`);
    }
  }

  const affectedBlockingConstraints: string[] = [];
  for (const d of deltas) {
    if (d.deltaType === 'CONSTRAINT_CHANGED' || d.deltaType === 'CONSTRAINT_REMOVED') {
      affectedBlockingConstraints.push(d.oldSemanticId ?? d.recordId);
    }
  }

  const validationsRequired: string[] = [];
  for (const s of staleEvidence) {
    if (s.isStale) {
      validationsRequired.push(s.validationId);
    }
  }

  const reviewDomainsSet = new Set<string>();
  for (const d of deltas) {
    for (const rd of d.reviewDomains) {
      reviewDomainsSet.add(rd);
    }
  }
  for (const i of impacts) {
    reviewDomainsSet.add(i.reviewDomain);
  }

  const unknownMappings: string[] = [];
  for (const d of deltas) {
    if (d.domain === 'cross_domain' || d.domain === 'graph') {
      if (d.reviewDomains.length === 0) {
        unknownMappings.push(d.recordId);
      }
    }
  }

  const deterministicMergeBlockers: string[] = [];
  if (breakingSoftwareChanges.length > 0) {
    deterministicMergeBlockers.push(
      `Breaking software API changes: ${breakingSoftwareChanges.length} removed/changed signatures`,
    );
  }
  if (affectedBlockingConstraints.length > 0) {
    deterministicMergeBlockers.push(
      `Affected blocking constraints: ${affectedBlockingConstraints.length} changed/removed`,
    );
  }
  const criticalImpacts = impacts.filter(i => i.severity === 'critical');
  if (criticalImpacts.length > 0) {
    deterministicMergeBlockers.push(
      `Critical cross-domain impacts: ${criticalImpacts.length} nodes affected`,
    );
  }

  return {
    schemaVersion: '0.1.0',
    baseRevisionIdentity: {
      gitTreeId: base.identity.gitTreeId,
      descriptorHash: base.descriptorHash,
    },
    targetRevisionIdentity: {
      gitTreeId: proposed.identity.gitTreeId,
      descriptorHash: proposed.descriptorHash,
    },
    changeCountsByDomain: sortedRecord(changeCountsByDomain),
    changeCountsByType: sortedRecord(changeCountsByType),
    breakingSoftwareChanges: sortStrings(breakingSoftwareChanges),
    changedExternalInterfaces: sortStrings(changedExternalInterfaces),
    changedNets: sortStrings(changedNets),
    changedComponentMappings: sortStrings(changedComponentMappings),
    bomRiskChanges: sortStrings(bomRiskChanges),
    affectedBlockingConstraints: sortStrings(affectedBlockingConstraints),
    validationsRequired: sortStrings(validationsRequired),
    staleEvidence,
    reviewDomainsRequired: sortStrings([...reviewDomainsSet]),
    unknownMappings: sortStrings(unknownMappings),
    deterministicMergeBlockers: sortStrings(deterministicMergeBlockers),
  };
}

function sortedRecord(r: Record<string, number>): Record<string, number> {
  const sorted: Record<string, number> = {};
  for (const key of Object.keys(r).sort()) {
    sorted[key] = r[key];
  }
  return sorted;
}
