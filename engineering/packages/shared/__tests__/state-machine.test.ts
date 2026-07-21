import { describe, it, expect } from 'vitest';
import { transition, transitionOrThrow, type TransitionMap } from '../src/index.js';

type TestState = 'a' | 'b' | 'c' | 'terminal';

const testMap: TransitionMap<TestState> = {
  a: ['b'],
  b: ['c', 'terminal'],
  c: ['terminal'],
  terminal: [],
};

describe('transition', () => {
  it('returns valid:true for allowed transitions', () => {
    const result = transition('a', 'b', testMap);
    expect(result.valid).toBe(true);
    expect(result.from).toBe('a');
    expect(result.to).toBe('b');
  });

  it('returns valid:false with allowedTargets for disallowed transitions', () => {
    const result = transition('a', 'c', testMap);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.allowedTargets).toEqual(['b']);
    }
  });

  it('returns valid:false for transitions from terminal states', () => {
    const result = transition('terminal', 'a', testMap);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.allowedTargets).toEqual([]);
    }
  });

  it('handles multiple allowed targets', () => {
    expect(transition('b', 'c', testMap).valid).toBe(true);
    expect(transition('b', 'terminal', testMap).valid).toBe(true);
    expect(transition('b', 'a', testMap).valid).toBe(false);
  });
});

describe('transitionOrThrow', () => {
  it('returns the new state on valid transition', () => {
    expect(transitionOrThrow('a', 'b', testMap, 'test')).toBe('b');
  });

  it('throws on invalid transition with descriptive message', () => {
    expect(() => transitionOrThrow('a', 'terminal', testMap, 'TestEntity')).toThrow(
      /Invalid TestEntity transition: a → terminal/,
    );
  });

  it('throws from terminal state', () => {
    expect(() => transitionOrThrow('terminal', 'a', testMap, 'test')).toThrow();
  });
});
