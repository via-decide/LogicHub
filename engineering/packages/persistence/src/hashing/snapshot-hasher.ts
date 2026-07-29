import { createHash } from 'node:crypto';
import type { EngineeringObject, Constraint, Decision, Artifact } from '@logichub-engineering/contracts';

export interface SnapshotHashes {
  snapshotHash: string;
  engineeringObjectSnapshotHash: string;
  constraintSnapshotHash: string;
  decisionSnapshotHash: string;
  bomSnapshotHash: string;
  artifactManifestHash: string;
}

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

function hashOfHashes(hashes: string[]): string {
  const sorted = [...hashes].sort();
  return sha256(sorted.join('\n'));
}

export function computeSnapshotHashes(contents: {
  engineeringObjects: EngineeringObject[];
  constraints: Constraint[];
  decisions: Decision[];
  bomItems: EngineeringObject[];
  artifacts: Artifact[];
}): SnapshotHashes {
  const engineeringObjectSnapshotHash = hashOfHashes(
    contents.engineeringObjects.map(o => o.contentHash),
  );

  const constraintSnapshotHash = hashOfHashes(
    contents.constraints.map(c => sha256(JSON.stringify({
      id: c.id, name: c.name, category: c.category,
      severity: c.severity, expression: c.expression, expected: c.expected,
    }))),
  );

  const decisionSnapshotHash = hashOfHashes(
    contents.decisions.map(d => sha256(JSON.stringify({
      id: d.id, question: d.question,
      selectedAlternative: d.selectedAlternative, status: d.status,
    }))),
  );

  const bomSnapshotHash = hashOfHashes(
    contents.bomItems.map(b => b.contentHash),
  );

  const artifactManifestHash = hashOfHashes(
    contents.artifacts.map(a => a.sha256),
  );

  const subHashes = [
    engineeringObjectSnapshotHash,
    constraintSnapshotHash,
    decisionSnapshotHash,
    bomSnapshotHash,
    artifactManifestHash,
  ].sort();

  const snapshotHash = sha256(subHashes.join('\n'));

  return {
    snapshotHash,
    engineeringObjectSnapshotHash,
    constraintSnapshotHash,
    decisionSnapshotHash,
    bomSnapshotHash,
    artifactManifestHash,
  };
}
