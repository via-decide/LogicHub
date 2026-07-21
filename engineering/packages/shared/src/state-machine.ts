export type TransitionMap<S extends string> = Record<S, readonly S[]>;

export interface TransitionSuccess<S extends string> {
  readonly from: S;
  readonly to: S;
  readonly valid: true;
}

export interface TransitionFailure<S extends string> {
  readonly from: S;
  readonly to: S;
  readonly valid: false;
  readonly allowedTargets: readonly S[];
}

export type TransitionResult<S extends string> = TransitionSuccess<S> | TransitionFailure<S>;

export function transition<S extends string>(
  current: S,
  next: S,
  map: TransitionMap<S>,
): TransitionResult<S> {
  const allowed = map[current];
  if (allowed && allowed.includes(next)) {
    return { from: current, to: next, valid: true };
  }
  return { from: current, to: next, valid: false, allowedTargets: allowed ?? [] };
}

export function transitionOrThrow<S extends string>(
  current: S,
  next: S,
  map: TransitionMap<S>,
  entityName: string,
): S {
  const result = transition(current, next, map);
  if (!result.valid) {
    throw new Error(
      `Invalid ${entityName} transition: ${current} → ${next}. Allowed: [${result.allowedTargets.join(', ')}]`,
    );
  }
  return result.to;
}
