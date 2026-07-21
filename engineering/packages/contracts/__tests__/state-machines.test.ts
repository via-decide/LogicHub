import { describe, it, expect } from 'vitest';
import { transition, transitionOrThrow } from '@logichub-engineering/shared';
import { RevisionTransitions } from '../src/revision/revision.state-machine.js';
import { ChangeIntentTransitions } from '../src/change-intent/change-intent.state-machine.js';
import { PullRequestTransitions } from '../src/engineering-pull-request/engineering-pull-request.state-machine.js';

describe('Revision state machine', () => {
  it('walks the happy path: draft → imported → validating → validated → review → merged', () => {
    let state = 'draft' as const;
    state = transitionOrThrow(state, 'imported', RevisionTransitions, 'Revision') as typeof state;
    state = transitionOrThrow(state, 'validating', RevisionTransitions, 'Revision') as typeof state;
    state = transitionOrThrow(state, 'validated', RevisionTransitions, 'Revision') as typeof state;
    state = transitionOrThrow(state, 'review', RevisionTransitions, 'Revision') as typeof state;
    state = transitionOrThrow(state, 'merged', RevisionTransitions, 'Revision') as typeof state;
    expect(state).toBe('merged');
  });

  it('terminal states have no outgoing transitions', () => {
    for (const terminal of ['merged', 'rejected', 'failed'] as const) {
      expect(transition(terminal, 'draft', RevisionTransitions).valid).toBe(false);
    }
  });

  it('any pre-merge state can fail', () => {
    for (const s of ['draft', 'imported', 'validating', 'validated', 'review'] as const) {
      expect(transition(s, 'failed', RevisionTransitions).valid).toBe(true);
      expect(transition(s, 'rejected', RevisionTransitions).valid).toBe(true);
    }
  });

  it('rejects skipping states', () => {
    expect(transition('draft', 'validated', RevisionTransitions).valid).toBe(false);
  });
});

describe('ChangeIntent state machine', () => {
  it('walks the happy path', () => {
    const path = ['captured', 'planned', 'executing', 'generated', 'validating', 'validated', 'review', 'accepted'] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(transition(path[i], path[i + 1], ChangeIntentTransitions).valid).toBe(true);
    }
  });

  it('any active state can transition to failed/cancelled/rejected', () => {
    const active = ['captured', 'planned', 'executing', 'generated', 'validating', 'validated', 'review'] as const;
    for (const s of active) {
      expect(transition(s, 'failed', ChangeIntentTransitions).valid).toBe(true);
      expect(transition(s, 'cancelled', ChangeIntentTransitions).valid).toBe(true);
      expect(transition(s, 'rejected', ChangeIntentTransitions).valid).toBe(true);
    }
  });

  it('terminal states have no outgoing transitions', () => {
    for (const t of ['accepted', 'rejected', 'failed', 'cancelled'] as const) {
      expect(transition(t, 'captured', ChangeIntentTransitions).valid).toBe(false);
    }
  });
});

describe('PullRequest state machine', () => {
  it('walks the happy path: draft → open → approved → merged', () => {
    let state = 'draft' as const;
    state = transitionOrThrow(state, 'open', PullRequestTransitions, 'PR') as typeof state;
    state = transitionOrThrow(state, 'approved', PullRequestTransitions, 'PR') as typeof state;
    state = transitionOrThrow(state, 'merged', PullRequestTransitions, 'PR') as typeof state;
    expect(state).toBe('merged');
  });

  it('supports open ↔ changes_requested round-trip', () => {
    expect(transition('open', 'changes_requested', PullRequestTransitions).valid).toBe(true);
    expect(transition('changes_requested', 'open', PullRequestTransitions).valid).toBe(true);
  });

  it('draft/open/changes_requested/approved can transition to closed or rejected', () => {
    for (const s of ['draft', 'open', 'changes_requested', 'approved'] as const) {
      expect(transition(s, 'closed', PullRequestTransitions).valid).toBe(true);
      expect(transition(s, 'rejected', PullRequestTransitions).valid).toBe(true);
    }
  });

  it('terminal states have no outgoing transitions', () => {
    for (const t of ['merged', 'closed', 'rejected'] as const) {
      expect(transition(t, 'open', PullRequestTransitions).valid).toBe(false);
    }
  });

  it('cannot merge from draft', () => {
    expect(transition('draft', 'merged', PullRequestTransitions).valid).toBe(false);
  });
});
