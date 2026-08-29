/**
 * Structured events per master spec section 19. Every domain service takes
 * an optional `events` sink; when omitted, emission is a no-op, so existing
 * callers and tests are unaffected. This is deliberately a plain callback,
 * not a queue or transport -- the caller (apps/api's composition root, a
 * future worker, a test) decides where events go (logs, a metrics
 * pipeline, an in-memory array for assertions).
 */
export type DomainEventName =
  | 'project.created'
  | 'project.import.started'
  | 'project.import.completed'
  | 'project.import.failed'
  | 'revision.imported'
  | 'revision.snapshot.created'
  | 'diff.started'
  | 'diff.completed'
  | 'diff.failed'
  | 'constraint.evaluated'
  | 'constraint.violated'
  | 'constraint.unknown'
  | 'pull_request.created'
  | 'pull_request.reviewed'
  | 'pull_request.changes_requested'
  | 'pull_request.approved'
  | 'pull_request.merge_blocked'
  | 'pull_request.merged'
  | 'kicad.erc.completed'
  | 'kicad.drc.completed';

export interface DomainEvent {
  name: DomainEventName;
  timestamp: string;
  projectId?: string;
  revisionId?: string;
  pullRequestId?: string;
  actor?: string;
  correlationId?: string;
  durationMs?: number;
  result?: 'success' | 'failure';
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

export type DomainEventSink = (event: DomainEvent) => void;
