import type { TransitionMap } from '@logichub-engineering/shared';
import type { ChangeIntentStatus } from './change-intent.enums.js';

export const ChangeIntentTransitions: TransitionMap<ChangeIntentStatus> = {
  captured:   ['planned', 'failed', 'cancelled', 'rejected'],
  planned:    ['executing', 'failed', 'cancelled', 'rejected'],
  executing:  ['generated', 'failed', 'cancelled', 'rejected'],
  generated:  ['validating', 'failed', 'cancelled', 'rejected'],
  validating: ['validated', 'failed', 'cancelled', 'rejected'],
  validated:  ['review', 'failed', 'cancelled', 'rejected'],
  review:     ['accepted', 'failed', 'cancelled', 'rejected'],
  accepted:   [],
  rejected:   [],
  failed:     [],
  cancelled:  [],
};
