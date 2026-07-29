import { describe, it, expect } from 'vitest';
import { detectFileMoves, detectSymbolMoves } from '../../src/semdiff/move-detector.js';
import { makeSourceEntry, makeExport } from '../helpers.js';

describe('detectFileMoves', () => {
  it('detects strict content hash match move', () => {
    const base = [
      makeSourceEntry('src/old/utils.ts', { contentHash: 'hash_abc' }),
      makeSourceEntry('src/main.ts', { contentHash: 'hash_main' }),
    ];
    const proposed = [
      makeSourceEntry('src/new/utils.ts', { contentHash: 'hash_abc' }),
      makeSourceEntry('src/main.ts', { contentHash: 'hash_main' }),
    ];
    const moves = detectFileMoves(base, proposed);
    expect(moves).toHaveLength(1);
    expect(moves[0].basePath).toBe('src/old/utils.ts');
    expect(moves[0].proposedPath).toBe('src/new/utils.ts');
    expect(moves[0].matchType).toBe('strict');
  });

  it('does not match files present in both', () => {
    const base = [
      makeSourceEntry('src/main.ts', { contentHash: 'hash_main' }),
    ];
    const proposed = [
      makeSourceEntry('src/main.ts', { contentHash: 'hash_main' }),
    ];
    const moves = detectFileMoves(base, proposed);
    expect(moves).toHaveLength(0);
  });

  it('handles multiple moves without duplicates', () => {
    const base = [
      makeSourceEntry('a.ts', { contentHash: 'h1' }),
      makeSourceEntry('b.ts', { contentHash: 'h2' }),
    ];
    const proposed = [
      makeSourceEntry('c.ts', { contentHash: 'h1' }),
      makeSourceEntry('d.ts', { contentHash: 'h2' }),
    ];
    const moves = detectFileMoves(base, proposed);
    expect(moves).toHaveLength(2);
    const proposedPaths = moves.map(m => m.proposedPath).sort();
    expect(proposedPaths).toEqual(['c.ts', 'd.ts']);
  });

  it('skips files without content hash', () => {
    const base = [
      makeSourceEntry('a.ts', { contentHash: '' }),
    ];
    const proposed = [
      makeSourceEntry('b.ts', { contentHash: '' }),
    ];
    const moves = detectFileMoves(base, proposed);
    expect(moves).toHaveLength(0);
  });
});

describe('detectSymbolMoves', () => {
  it('detects strict body hash match', () => {
    const base = [
      makeExport('processData', {
        semanticId: 'software::old.ts::export::processData',
        bodyHash: 'body_123',
        alphaNormalizedBodyHash: 'alpha_123',
      }),
    ];
    const proposed = [
      makeExport('processData', {
        semanticId: 'software::new.ts::export::processData',
        bodyHash: 'body_123',
        alphaNormalizedBodyHash: 'alpha_123',
      }),
    ];
    const moves = detectSymbolMoves(base, proposed);
    expect(moves).toHaveLength(1);
    expect(moves[0].matchType).toBe('strict');
  });

  it('detects alpha-normalized match when strict fails', () => {
    const base = [
      makeExport('calculate', {
        semanticId: 'software::old.ts::export::calculate',
        bodyHash: 'strict_A',
        alphaNormalizedBodyHash: 'alpha_shared',
      }),
    ];
    const proposed = [
      makeExport('calculate', {
        semanticId: 'software::new.ts::export::calculate',
        bodyHash: 'strict_B',
        alphaNormalizedBodyHash: 'alpha_shared',
      }),
    ];
    const moves = detectSymbolMoves(base, proposed);
    expect(moves).toHaveLength(1);
    expect(moves[0].matchType).toBe('alpha_normalized');
  });

  it('does not match symbols present in both', () => {
    const shared = makeExport('shared', {
      semanticId: 'software::file.ts::export::shared',
    });
    const moves = detectSymbolMoves([shared], [shared]);
    expect(moves).toHaveLength(0);
  });

  it('prefers strict match over alpha-normalized', () => {
    const base = [
      makeExport('fn', {
        semanticId: 'software::a.ts::export::fn',
        bodyHash: 'exact_hash',
        alphaNormalizedBodyHash: 'alpha_hash',
      }),
    ];
    const proposed = [
      makeExport('fn', {
        semanticId: 'software::b.ts::export::fn',
        bodyHash: 'exact_hash',
        alphaNormalizedBodyHash: 'alpha_hash',
      }),
      makeExport('fn2', {
        semanticId: 'software::c.ts::export::fn2',
        bodyHash: 'other_hash',
        alphaNormalizedBodyHash: 'alpha_hash',
      }),
    ];
    const moves = detectSymbolMoves(base, proposed);
    expect(moves).toHaveLength(1);
    expect(moves[0].matchType).toBe('strict');
    expect(moves[0].proposedSemanticId).toBe('software::b.ts::export::fn');
  });
});
