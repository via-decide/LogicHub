import { describe, it, expect } from 'vitest';
import { assertValidBranchName, assertValidRef, assertSafeRepositoryPath, isSha } from '../src/validation.js';

describe('assertValidBranchName', () => {
  it.each(['main', 'feature/caps', 'release-1.0', 'user/a.b-c_d'])('accepts %s', (name) => {
    expect(() => assertValidBranchName(name)).not.toThrow();
  });

  it.each([
    '',
    '-flag-injection',
    '--force',
    'has space',
    'semi;colon',
    'dollar$(cmd)',
    'back`tick`',
    'double..dot',
    'trailing/',
    '/leading',
    'ends.',
    'branch.lock',
    'at@{reflog}',
    'double//slash',
    'new\nline',
  ])('rejects %j', (name) => {
    expect(() => assertValidBranchName(name)).toThrow();
  });
});

describe('assertValidRef', () => {
  it('accepts HEAD', () => {
    expect(() => assertValidRef('HEAD')).not.toThrow();
  });

  it('accepts full and abbreviated SHAs', () => {
    expect(() => assertValidRef('a'.repeat(40))).not.toThrow();
    expect(() => assertValidRef('abc123')).not.toThrow();
  });

  it('accepts branch names', () => {
    expect(() => assertValidRef('feature/caps')).not.toThrow();
  });

  it('rejects option-like refs', () => {
    expect(() => assertValidRef('--all')).toThrow();
    expect(() => assertValidRef('-x')).toThrow();
  });
});

describe('isSha', () => {
  it('recognizes hex SHAs', () => {
    expect(isSha('deadbeef')).toBe(true);
    expect(isSha('f'.repeat(40))).toBe(true);
  });

  it('rejects non-SHAs', () => {
    expect(isSha('main')).toBe(false);
    expect(isSha('DEADBEEF')).toBe(false);
    expect(isSha('ab')).toBe(false);
  });
});

describe('assertSafeRepositoryPath', () => {
  it('accepts absolute normalized paths', () => {
    expect(assertSafeRepositoryPath('/tmp/repo')).toBe('/tmp/repo');
  });

  it('strips trailing slashes', () => {
    expect(assertSafeRepositoryPath('/tmp/repo/')).toBe('/tmp/repo');
  });

  it('rejects relative paths', () => {
    expect(() => assertSafeRepositoryPath('relative/path')).toThrow(/absolute/i);
  });

  it('rejects path traversal', () => {
    expect(() => assertSafeRepositoryPath('/tmp/repo/../../etc')).toThrow(/normalized/i);
    expect(() => assertSafeRepositoryPath('/tmp/./repo')).toThrow(/normalized/i);
  });

  it('rejects empty and null-byte paths', () => {
    expect(() => assertSafeRepositoryPath('')).toThrow();
    expect(() => assertSafeRepositoryPath('/tmp/re\0po')).toThrow(/null byte/i);
  });
});
