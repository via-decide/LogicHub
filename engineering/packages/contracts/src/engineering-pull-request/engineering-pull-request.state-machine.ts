import type { TransitionMap } from '@logichub-engineering/shared';
import type { PRStatus } from './engineering-pull-request.enums.js';

export const PullRequestTransitions: TransitionMap<PRStatus> = {
  draft:             ['open', 'closed', 'rejected'],
  open:              ['changes_requested', 'approved', 'closed', 'rejected'],
  changes_requested: ['open', 'closed', 'rejected'],
  approved:          ['merged', 'closed', 'rejected'],
  merged:            [],
  closed:            [],
  rejected:          [],
};
