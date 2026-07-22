import type { TransitionMap } from '@logichub-engineering/shared';
import type { RevisionStatus } from './revision.enums.js';

export const RevisionTransitions: TransitionMap<RevisionStatus> = {
  draft:      ['imported', 'failed', 'rejected'],
  imported:   ['validating', 'failed', 'rejected'],
  validating: ['validated', 'failed', 'rejected'],
  validated:  ['review', 'failed', 'rejected'],
  review:     ['merged', 'failed', 'rejected'],
  merged:     [],
  rejected:   [],
  failed:     [],
};
