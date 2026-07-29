import Database from 'better-sqlite3';
import { createDatabase } from '../src/database.js';
import { runMigrations } from '../src/migrations/index.js';
import { createHash } from 'node:crypto';

export function createTestDb(): Database.Database {
  const db = createDatabase({ path: ':memory:' });
  runMigrations(db);
  return db;
}

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

export const NOW = '2025-01-15T10:00:00.000Z';

export function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj-1',
    schemaVersion: '0.1.0',
    slug: 'test-project',
    name: 'Test Project',
    visibility: 'private' as const,
    repository: { provider: 'github', localPath: '/tmp/repo', defaultBranch: 'main' },
    defaultBranch: 'main',
    createdBy: 'user-1',
    createdAt: NOW,
    status: 'active' as const,
    ...overrides,
  };
}

export function makeRevision(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rev-1',
    schemaVersion: '0.1.0',
    projectId: 'proj-1',
    gitCommitSha: 'a'.repeat(40),
    branchName: 'main',
    parentRevisionIds: [],
    author: 'user-1',
    message: 'Initial revision',
    createdAt: NOW,
    toolchain: { kicad: '8.0' },
    status: 'draft' as const,
    ...overrides,
  };
}

export function makeEngineeringObject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'eo-1',
    schemaVersion: '0.1.0',
    projectId: 'proj-1',
    revisionId: 'rev-1',
    objectType: 'component' as const,
    sourcePath: 'main.kicad_sch',
    name: 'R1',
    semanticKey: 'component:R1',
    properties: { value: '10k', package: '0402' },
    relationships: [],
    contentHash: sha256('content-1'),
    semanticHash: sha256('semantic-1'),
    createdAt: NOW,
    ...overrides,
  };
}

export function makeConstraint(overrides: Record<string, unknown> = {}) {
  return {
    id: 'con-1',
    schemaVersion: '0.1.0',
    projectId: 'proj-1',
    revisionId: 'rev-1',
    name: 'VCC Range',
    category: 'electrical' as const,
    severity: 'blocking' as const,
    scope: 'board',
    targetObjectIds: [],
    expression: { type: 'range', min: 3.0, max: 3.6 },
    expected: 3.3,
    status: 'active',
    evaluation: 'unknown' as const,
    createdBy: 'user-1',
    createdAt: NOW,
    ...overrides,
  };
}

export function makeDecision(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dec-1',
    schemaVersion: '0.1.0',
    projectId: 'proj-1',
    revisionId: 'rev-1',
    question: 'Which voltage regulator?',
    alternatives: [
      { id: 'alt-1', description: 'LDO AMS1117' },
      { id: 'alt-2', description: 'Buck TPS54302' },
    ],
    selectedAlternative: 'alt-1',
    constraintsConsidered: ['con-1'],
    evidenceArtifactIds: [],
    validationResultIds: [],
    status: 'proposed' as const,
    createdBy: 'user-1',
    createdAt: NOW,
    ...overrides,
  };
}

export function makeArtifact(overrides: Record<string, unknown> = {}) {
  return {
    id: 'art-1',
    schemaVersion: '0.1.0',
    projectId: 'proj-1',
    revisionId: 'rev-1',
    role: 'source' as const,
    filename: 'main.kicad_sch',
    mediaType: 'application/x-kicad-schematic',
    byteSize: 1024,
    sha256: sha256('artifact-content-1'),
    storageKey: 'ab/' + sha256('artifact-content-1'),
    sourcePaths: ['main.kicad_sch'],
    createdAt: NOW,
    ...overrides,
  };
}

export function makeChangeIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ci-1',
    schemaVersion: '0.1.0',
    projectId: 'proj-1',
    baseRevisionId: 'rev-1',
    targetBranch: 'feature/new-part',
    title: 'Add bypass capacitors',
    changeType: 'schematic_edit',
    requestedOperations: [],
    expectedObjectChanges: [],
    preserve: ['net:VCC'],
    optimize: ['cost'],
    constraints: [],
    approvalPolicy: { requiredApprovals: 1, autoMerge: false },
    status: 'captured' as const,
    createdBy: 'user-1',
    createdAt: NOW,
    ...overrides,
  };
}

export function makeValidationResult(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vr-1',
    schemaVersion: '0.1.0',
    projectId: 'proj-1',
    revisionId: 'rev-1',
    validator: 'kicad-erc',
    validatorVersion: '8.0.0',
    validationType: 'erc' as const,
    status: 'pass' as const,
    startedAt: NOW,
    diagnostics: [],
    artifactIds: [],
    createdAt: NOW,
    ...overrides,
  };
}

export function makeModule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mod-1',
    schemaVersion: '0.1.0',
    namespace: 'acme',
    name: 'power-supply',
    version: '1.0.0',
    interfaces: [],
    requirements: ['3.3V output'],
    constraints: [],
    dependencies: [],
    artifactIds: [],
    bomItemIds: [],
    verificationStatus: 'unverified' as const,
    maintainers: ['user-1'],
    createdAt: NOW,
    ...overrides,
  };
}

export function makePullRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'epr-1',
    schemaVersion: '0.1.0',
    projectId: 'proj-1',
    number: 1,
    title: 'Add bypass capacitors',
    baseBranch: 'main',
    baseRevisionId: 'rev-1',
    headBranch: 'feature/caps',
    headRevisionId: 'rev-2',
    author: 'user-1',
    status: 'draft' as const,
    requiredApprovals: 1,
    approvals: [],
    changeRequests: [],
    createdAt: NOW,
    ...overrides,
  };
}
