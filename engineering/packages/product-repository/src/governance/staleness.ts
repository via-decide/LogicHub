import type { SemanticProductDiff } from '../schemas/diff.schema.js';
import type { RevisionStamp } from '../schemas/revision.schema.js';
import type {
  EvidenceBinding,
  StalenessRecord,
  ValidationDecision,
} from '../schemas/governance.schema.js';

/**
 * Subjects a diff touched, in the vocabulary decisions and evidence use.
 *
 * A change to a node contributes both the node id and `nodeType.field`, so a
 * decision about `motor.voltage` is caught by a change to any motor's voltage
 * without having to name a specific node.
 */
export function touchedSubjects(diff: SemanticProductDiff): string[] {
  const subjects = new Set<string>();

  for (const change of diff.changes) {
    if (change.nodeId !== null) subjects.add(change.nodeId);
    if (change.nodeType !== null) {
      subjects.add(change.nodeType);
      subjects.add(`${change.nodeType}.${change.field}`);
    }
    subjects.add(change.field);
  }

  for (const area of diff.affectedAreas) {
    subjects.add(area.area);
  }

  return [...subjects].sort();
}

/**
 * Find decisions the change has invalidated.
 *
 * A decision was made about a specific design. When that design moves under
 * it, the decision does not quietly carry forward — it is marked stale so
 * somebody has to look again. Accepting a design once is not accepting every
 * design that follows it.
 */
export function detectStaleDecisions(
  decisions: readonly ValidationDecision[],
  diff: SemanticProductDiff,
): StalenessRecord[] {
  const touched = new Set(touchedSubjects(diff));

  return decisions
    .filter(decision => touched.has(decision.subject))
    .map(decision => ({
      id: decision.id,
      kind: 'decision' as const,
      reason: 'subject-changed' as const,
      subject: decision.subject,
      fromRevisionId: decision.revisionId,
      message:
        `Decision "${decision.id}" covered ${decision.subject}, which changed in this `
        + 'revision. It does not carry forward and must be made again.',
    }))
    .sort(compareRecords);
}

/**
 * Find evidence the change has invalidated.
 *
 * Evidence describes a specific build. When the subject it speaks to changes,
 * or the hardware or firmware it was captured on moves, it stops describing
 * the thing in front of you. It is never silently reused.
 */
export function detectStaleEvidence(
  evidence: readonly EvidenceBinding[],
  diff: SemanticProductDiff,
  currentStamp: RevisionStamp,
): StalenessRecord[] {
  const touched = new Set(touchedSubjects(diff));
  const records: StalenessRecord[] = [];

  for (const binding of evidence) {
    if (binding.hardwareRevision !== currentStamp.hardware) {
      records.push({
        id: binding.ref,
        kind: 'evidence',
        reason: 'hardware-revision-changed',
        subject: binding.subjects.join(', ') || binding.ref,
        fromRevisionId: binding.revisionId,
        message:
          `Evidence "${binding.ref}" was captured on hardware ${binding.hardwareRevision}, `
          + `but this revision is ${currentStamp.hardware}. It does not describe this build.`,
      });
      continue;
    }

    if (binding.firmwareRevision !== currentStamp.firmware) {
      records.push({
        id: binding.ref,
        kind: 'evidence',
        reason: 'firmware-revision-changed',
        subject: binding.subjects.join(', ') || binding.ref,
        fromRevisionId: binding.revisionId,
        message:
          `Evidence "${binding.ref}" was captured on firmware ${binding.firmwareRevision}, `
          + `but this revision is ${currentStamp.firmware}. It does not describe this build.`,
      });
      continue;
    }

    const staleSubject = binding.subjects.find(subject => touched.has(subject));
    if (staleSubject !== undefined) {
      records.push({
        id: binding.ref,
        kind: 'evidence',
        reason: 'subject-changed',
        subject: staleSubject,
        fromRevisionId: binding.revisionId,
        message:
          `Evidence "${binding.ref}" speaks to ${staleSubject}, which changed in this `
          + 'revision. It no longer describes the current design.',
      });
    }
  }

  return records.sort(compareRecords);
}

function compareRecords(a: StalenessRecord, b: StalenessRecord): number {
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0;
}
