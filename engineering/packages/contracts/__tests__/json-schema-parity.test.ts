import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import {
  ProjectSchema, ProjectJsonSchema,
  ArtifactSchema, ArtifactJsonSchema,
  EngineeringObjectSchema, EngineeringObjectJsonSchema,
  ConstraintSchema, ConstraintJsonSchema,
  DecisionSchema, DecisionJsonSchema,
  ValidationResultSchema, ValidationResultJsonSchema,
  ModuleSchema, ModuleJsonSchema,
  RevisionSchema, RevisionJsonSchema,
  ChangeIntentSchema, ChangeIntentJsonSchema,
  EngineeringPullRequestSchema, EngineeringPullRequestJsonSchema,
} from '../src/index.js';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const sha256 = 'a'.repeat(64);
const gitSha = 'b'.repeat(40);
const ts = '2026-01-15T10:00:00+00:00';

const fixtures: Record<string, { zodSchema: any; jsonSchema: any; valid: any; invalidField: { key: string; value: any } }> = {
  Project: {
    zodSchema: ProjectSchema,
    jsonSchema: ProjectJsonSchema,
    valid: { id: 'p1', slug: 'test', name: 'Test', visibility: 'private', repository: { provider: 'git', localPath: '/x' }, createdBy: 'a', createdAt: ts },
    invalidField: { key: 'visibility', value: 'secret' },
  },
  Artifact: {
    zodSchema: ArtifactSchema,
    jsonSchema: ArtifactJsonSchema,
    valid: { id: 'a1', projectId: 'p1', revisionId: 'r1', role: 'bom', filename: 'f.csv', mediaType: 'text/csv', byteSize: 100, sha256, storageKey: 'k', sourcePaths: [], createdAt: ts },
    invalidField: { key: 'role', value: 'invalid' },
  },
  EngineeringObject: {
    zodSchema: EngineeringObjectSchema,
    jsonSchema: EngineeringObjectJsonSchema,
    valid: { id: 'eo1', projectId: 'p1', revisionId: 'r1', objectType: 'component', sourcePath: 's.sch', name: 'U1', semanticKey: 'u1', properties: {}, relationships: [], contentHash: sha256, semanticHash: sha256, createdAt: ts },
    invalidField: { key: 'objectType', value: 'widget' },
  },
  Constraint: {
    zodSchema: ConstraintSchema,
    jsonSchema: ConstraintJsonSchema,
    valid: { id: 'c1', projectId: 'p1', revisionId: 'r1', name: 'Max width', category: 'mechanical', severity: 'blocking', scope: 'revision', targetObjectIds: [], createdBy: 'a', createdAt: ts },
    invalidField: { key: 'category', value: 'invalid' },
  },
  Decision: {
    zodSchema: DecisionSchema,
    jsonSchema: DecisionJsonSchema,
    valid: { id: 'd1', projectId: 'p1', revisionId: 'r1', question: 'Why?', alternatives: [], constraintsConsidered: [], evidenceArtifactIds: [], validationResultIds: [], createdBy: 'a', createdAt: ts },
    invalidField: { key: 'status', value: 'invalid' },
  },
  ValidationResult: {
    zodSchema: ValidationResultSchema,
    jsonSchema: ValidationResultJsonSchema,
    valid: { id: 'v1', projectId: 'p1', revisionId: 'r1', validator: 'erc', validatorVersion: '1.0', validationType: 'erc', status: 'pass', startedAt: ts, diagnostics: [], artifactIds: [], createdAt: ts },
    invalidField: { key: 'validationType', value: 'invalid' },
  },
  Module: {
    zodSchema: ModuleSchema,
    jsonSchema: ModuleJsonSchema,
    valid: { id: 'm1', namespace: 'ns', name: 'mod', version: '1.0', interfaces: [], requirements: [], constraints: [], dependencies: [], artifactIds: [], bomItemIds: [], maintainers: [], createdAt: ts },
    invalidField: { key: 'verificationStatus', value: 'invalid' },
  },
  Revision: {
    zodSchema: RevisionSchema,
    jsonSchema: RevisionJsonSchema,
    valid: { id: 'r1', projectId: 'p1', gitCommitSha: gitSha, branchName: 'main', parentRevisionIds: [], author: 'a', message: 'init', createdAt: ts, toolchain: {} },
    invalidField: { key: 'status', value: 'invalid' },
  },
  ChangeIntent: {
    zodSchema: ChangeIntentSchema,
    jsonSchema: ChangeIntentJsonSchema,
    valid: { id: 'ci1', projectId: 'p1', baseRevisionId: 'r1', targetBranch: 'feat', title: 'Change', changeType: 'mod', requestedOperations: [], expectedObjectChanges: [], preserve: [], optimize: [], constraints: [], approvalPolicy: { requiredApprovals: 1, autoMerge: false }, createdBy: 'a', createdAt: ts },
    invalidField: { key: 'status', value: 'invalid' },
  },
  EngineeringPullRequest: {
    zodSchema: EngineeringPullRequestSchema,
    jsonSchema: EngineeringPullRequestJsonSchema,
    valid: { id: 'pr1', projectId: 'p1', number: 1, title: 'PR', baseBranch: 'main', baseRevisionId: 'r1', headBranch: 'feat', headRevisionId: 'r2', author: 'a', approvals: [], changeRequests: [], createdAt: ts },
    invalidField: { key: 'status', value: 'invalid' },
  },
};

describe.each(Object.entries(fixtures))('%s JSON Schema parity', (_name, { zodSchema, jsonSchema, valid, invalidField }) => {
  it('valid object accepted by both Zod and JSON Schema', () => {
    const parsed = zodSchema.parse(valid);
    const validate = ajv.compile(jsonSchema);
    const ajvValid = validate(parsed);
    if (!ajvValid) {
      console.error(_name, 'AJV errors:', validate.errors);
    }
    expect(ajvValid).toBe(true);
  });

  it('invalid object rejected by Zod', () => {
    expect(() => zodSchema.parse({ ...valid, [invalidField.key]: invalidField.value })).toThrow();
  });
});
