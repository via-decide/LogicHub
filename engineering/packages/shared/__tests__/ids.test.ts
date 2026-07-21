import { describe, it, expect } from 'vitest';
import {
  ProjectIdSchema,
  RevisionIdSchema,
  EngineeringObjectIdSchema,
  ConstraintIdSchema,
  DecisionIdSchema,
  ArtifactIdSchema,
  ChangeIntentIdSchema,
  ValidationResultIdSchema,
  ModuleIdSchema,
  EngineeringPullRequestIdSchema,
} from '../src/index.js';

const allIdSchemas = [
  ['ProjectId', ProjectIdSchema],
  ['RevisionId', RevisionIdSchema],
  ['EngineeringObjectId', EngineeringObjectIdSchema],
  ['ConstraintId', ConstraintIdSchema],
  ['DecisionId', DecisionIdSchema],
  ['ArtifactId', ArtifactIdSchema],
  ['ChangeIntentId', ChangeIntentIdSchema],
  ['ValidationResultId', ValidationResultIdSchema],
  ['ModuleId', ModuleIdSchema],
  ['EngineeringPullRequestId', EngineeringPullRequestIdSchema],
] as const;

describe.each(allIdSchemas)('%s', (_name, schema) => {
  it('accepts a valid non-empty string', () => {
    expect(schema.parse('abc-123')).toBe('abc-123');
  });

  it('accepts a UUID', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(schema.parse(uuid)).toBe(uuid);
  });

  it('rejects an empty string', () => {
    expect(() => schema.parse('')).toThrow();
  });

  it('rejects non-string types', () => {
    expect(() => schema.parse(123)).toThrow();
    expect(() => schema.parse(null)).toThrow();
    expect(() => schema.parse(undefined)).toThrow();
  });
});
