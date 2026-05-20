export type ConstraintProfile = {
  visual: string[];
  movement: string[];
  audio: string[];
};

export type BaseEvent = {
  eventId: string;
  artifactId: string;
  timestamp: number;
  sessionId?: string;
  creatorId?: string;
  userId?: string;
};

export type ArtifactCreatedEvent = BaseEvent & {
  type: 'ArtifactCreatedEvent';
  creatorId: string;
  createdAt: number;
  constraintProfile: ConstraintProfile;
  parentArtifactId?: string;
};

export type ArtifactViewedEvent = BaseEvent & { type: 'ArtifactViewedEvent' };
export type ArtifactRemixedEvent = BaseEvent & { type: 'ArtifactRemixedEvent'; parentArtifactId: string };
export type ArtifactMutatedEvent = BaseEvent & { type: 'ArtifactMutatedEvent'; mutationType: string; parentArtifactId?: string };
export type ReplayStartedEvent = BaseEvent & { type: 'ReplayStartedEvent'; runtimeHash?: string };
export type ReplayCompletedEvent = BaseEvent & { type: 'ReplayCompletedEvent'; runtimeHash?: string; frameHash?: string; deterministic?: boolean };
export type ConstraintAppliedEvent = BaseEvent & { type: 'ConstraintAppliedEvent'; constraintProfile: ConstraintProfile };

export type InteractionSignalEvent = BaseEvent & {
  type: 'InteractionSignalEvent';
  userId: string;
  interactionTempo: number;
  hesitationMs: number;
  replayCount: number;
  inputRhythm: number[];
  interactionDensity: number;
};

export type SessionEvent = BaseEvent & {
  type: 'SessionEvent';
  action: 'started' | 'heartbeat' | 'ended';
};

export type LogicHubEvent =
  | ArtifactCreatedEvent
  | ArtifactViewedEvent
  | ArtifactRemixedEvent
  | ArtifactMutatedEvent
  | ReplayStartedEvent
  | ReplayCompletedEvent
  | ConstraintAppliedEvent
  | InteractionSignalEvent
  | SessionEvent;

export function isLogicHubEvent(input: unknown): input is LogicHubEvent {
  if (!input || typeof input !== 'object') return false;
  const value = input as Record<string, unknown>;
  return typeof value.type === 'string' && typeof value.eventId === 'string' && typeof value.artifactId === 'string';
}
