import { describe, it, expect } from 'vitest';
import type { Constraint, EngineeringObject } from '@logichub-engineering/contracts';
import type { DeltaRecord } from '@logichub-engineering/repository-engine';
import {
  evaluateConstraint,
  evaluateConstraints,
  hasBlockingConstraintViolation,
  parseConstraintExpression,
} from '../src/constraint-evaluation.js';

function makeConstraint(overrides: Partial<Constraint> = {}): Constraint {
  return {
    id: 'con-1',
    schemaVersion: '0.1.0',
    projectId: 'proj-1',
    revisionId: 'rev-1',
    name: 'Status LED must remain present',
    category: 'electrical',
    severity: 'blocking',
    scope: 'schematic',
    targetObjectIds: [],
    expression: { kind: 'object_must_exist', semanticKey: 'D1' },
    expected: true,
    status: 'active',
    evaluation: 'unknown',
    createdBy: 'test',
    createdAt: '2026-01-01T00:00:00Z',
    metadata: {},
    ...overrides,
  };
}

function makeObject(overrides: Partial<EngineeringObject> = {}): EngineeringObject {
  return {
    id: 'obj-1',
    schemaVersion: '0.1.0',
    projectId: 'proj-1',
    revisionId: 'rev-2',
    objectType: 'component',
    sourcePath: 'board.kicad_sch',
    name: 'U1',
    semanticKey: 'U1',
    properties: {},
    relationships: [],
    contentHash: 'sha256:aaaa',
    semanticHash: 'sha256:bbbb',
    createdAt: '2026-01-01T00:00:00Z',
    metadata: {},
    ...overrides,
  };
}

function makeDelta(overrides: Partial<DeltaRecord> = {}): DeltaRecord {
  return {
    schemaVersion: '0.1.0',
    deltaType: 'SYMBOL_FOOTPRINT_CHANGED',
    domain: 'schematic',
    recordId: 'delta-1',
    oldSemanticId: 'U1',
    newSemanticId: 'U1',
    oldSemanticHash: 'sha256:old',
    newSemanticHash: 'sha256:new',
    oldNormalizedValue: null,
    newNormalizedValue: null,
    affectedNodeIds: [],
    supportingEdgeIds: [],
    evidenceSourcePaths: [],
    classificationBasis: 'test',
    replayOperation: { operation: 'replace', objectId: 'U1', expectedOldHash: null },
    reviewDomains: [],
    validationImplications: [],
    ...overrides,
  };
}

describe('parseConstraintExpression', () => {
  it('parses each recognized shape', () => {
    expect(parseConstraintExpression({ kind: 'object_must_exist', semanticKey: 'D1' })).toEqual({
      kind: 'object_must_exist',
      semanticKey: 'D1',
    });
    expect(parseConstraintExpression({ kind: 'no_delta_type', deltaTypes: ['NET_REMOVED'] })).toEqual({
      kind: 'no_delta_type',
      deltaTypes: ['NET_REMOVED'],
      semanticKeys: undefined,
    });
    expect(parseConstraintExpression({ kind: 'property_equals', semanticKey: 'U1', property: 'value' })).toEqual({
      kind: 'property_equals',
      semanticKey: 'U1',
      property: 'value',
    });
  });

  it('returns null for unrecognized or malformed shapes', () => {
    expect(parseConstraintExpression(null)).toBeNull();
    expect(parseConstraintExpression('some free text')).toBeNull();
    expect(parseConstraintExpression({ kind: 'unknown_kind' })).toBeNull();
    expect(parseConstraintExpression({ kind: 'object_must_exist' })).toBeNull();
  });
});

describe('evaluateConstraint', () => {
  it('reports requires_validation for an unrecognized expression, never a fabricated pass', () => {
    const outcome = evaluateConstraint(makeConstraint({ expression: 'ensure it looks fine' }), [], []);
    expect(outcome.evaluation).toBe('requires_validation');
  });

  describe('object_must_exist', () => {
    it('passes when the object is present', () => {
      const outcome = evaluateConstraint(makeConstraint(), [makeObject({ semanticKey: 'D1' })], []);
      expect(outcome.evaluation).toBe('pass');
    });

    it('violates a blocking constraint when the object is missing (D1 removed in the fixture proposal)', () => {
      const outcome = evaluateConstraint(makeConstraint({ severity: 'blocking' }), [], []);
      expect(outcome.evaluation).toBe('violation');
    });

    it('warns instead of violating for a non-blocking severity', () => {
      const outcome = evaluateConstraint(makeConstraint({ severity: 'warning' }), [], []);
      expect(outcome.evaluation).toBe('warning');
    });
  });

  describe('object_must_not_exist', () => {
    it('passes when the object is absent', () => {
      const outcome = evaluateConstraint(
        makeConstraint({ expression: { kind: 'object_must_not_exist', semanticKey: 'D1' } }),
        [],
        []
      );
      expect(outcome.evaluation).toBe('pass');
    });

    it('violates when the forbidden object is present', () => {
      const outcome = evaluateConstraint(
        makeConstraint({ expression: { kind: 'object_must_not_exist', semanticKey: 'D1' } }),
        [makeObject({ semanticKey: 'D1' })],
        []
      );
      expect(outcome.evaluation).toBe('violation');
    });
  });

  describe('no_delta_type', () => {
    it('passes when no matching delta touches the scope', () => {
      const outcome = evaluateConstraint(
        makeConstraint({ expression: { kind: 'no_delta_type', deltaTypes: ['NET_REMOVED'] } }),
        [],
        [makeDelta({ deltaType: 'SYMBOL_FOOTPRINT_CHANGED' })]
      );
      expect(outcome.evaluation).toBe('pass');
    });

    it('violates when a disallowed delta type appears, scoped to the constraint semanticKeys', () => {
      const outcome = evaluateConstraint(
        makeConstraint({
          severity: 'blocking',
          expression: { kind: 'no_delta_type', deltaTypes: ['SYMBOL_FOOTPRINT_CHANGED'], semanticKeys: ['U1'] },
        }),
        [],
        [makeDelta({ deltaType: 'SYMBOL_FOOTPRINT_CHANGED', oldSemanticId: 'U1', newSemanticId: 'U1' })]
      );
      expect(outcome.evaluation).toBe('violation');
    });

    it('ignores a matching delta type outside the scoped semanticKeys', () => {
      const outcome = evaluateConstraint(
        makeConstraint({
          expression: { kind: 'no_delta_type', deltaTypes: ['SYMBOL_FOOTPRINT_CHANGED'], semanticKeys: ['J2'] },
        }),
        [],
        [makeDelta({ deltaType: 'SYMBOL_FOOTPRINT_CHANGED', oldSemanticId: 'U1', newSemanticId: 'U1' })]
      );
      expect(outcome.evaluation).toBe('pass');
    });
  });

  describe('property_equals', () => {
    it('is unknown when the target object cannot be found', () => {
      const outcome = evaluateConstraint(
        makeConstraint({ expression: { kind: 'property_equals', semanticKey: 'U1', property: 'value' }, expected: 'AMS1117-3.3' }),
        [],
        []
      );
      expect(outcome.evaluation).toBe('unknown');
    });

    it('passes when the property matches expected', () => {
      const outcome = evaluateConstraint(
        makeConstraint({ expression: { kind: 'property_equals', semanticKey: 'U1', property: 'value' }, expected: 'AMS1117-3.3' }),
        [makeObject({ semanticKey: 'U1', properties: { value: 'AMS1117-3.3' } })],
        []
      );
      expect(outcome.evaluation).toBe('pass');
    });

    it('violates a blocking constraint when the property does not match (regulator swapped in the fixture proposal)', () => {
      const outcome = evaluateConstraint(
        makeConstraint({
          severity: 'blocking',
          expression: { kind: 'property_equals', semanticKey: 'U1', property: 'value' },
          expected: 'AMS1117-3.3',
        }),
        [makeObject({ semanticKey: 'U1', properties: { value: 'TPS62A02' } })],
        []
      );
      expect(outcome.evaluation).toBe('violation');
    });
  });
});

describe('hasBlockingConstraintViolation', () => {
  it('is true only when a blocking-severity constraint evaluates to violation', () => {
    const blocking = makeConstraint({ id: 'con-blocking', severity: 'blocking' });
    const warningOnly = makeConstraint({ id: 'con-warning', severity: 'warning' });
    const outcomes = evaluateConstraints([blocking, warningOnly], [], []);
    expect(hasBlockingConstraintViolation([blocking, warningOnly], outcomes)).toBe(true);
  });

  it('is false when every violation is non-blocking', () => {
    const warningOnly = makeConstraint({ id: 'con-warning', severity: 'warning' });
    const outcomes = evaluateConstraints([warningOnly], [], []);
    expect(hasBlockingConstraintViolation([warningOnly], outcomes)).toBe(false);
  });

  it('is false when everything passes', () => {
    const blocking = makeConstraint({ id: 'con-blocking', severity: 'blocking' });
    const outcomes = evaluateConstraints([blocking], [makeObject({ semanticKey: 'D1' })], []);
    expect(hasBlockingConstraintViolation([blocking], outcomes)).toBe(false);
  });
});
