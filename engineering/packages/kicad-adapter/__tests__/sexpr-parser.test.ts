import { describe, it, expect } from 'vitest';
import { parseSExpr, parseKicadFile, findChildren, findChild, getStringAtom, getNumberAtom } from '../src/sexpr/parser.js';

describe('parseSExpr', () => {
  it('parses bare atoms', () => {
    expect(parseSExpr('hello')).toEqual(['hello']);
  });

  it('parses numbers', () => {
    expect(parseSExpr('42 -3 2.54')).toEqual([42, -3, 2.54]);
  });

  it('parses quoted strings with escapes', () => {
    expect(parseSExpr('"hello world"')).toEqual(['hello world']);
    expect(parseSExpr('"line\\nbreak"')).toEqual(['line\nbreak']);
    expect(parseSExpr('"tab\\there"')).toEqual(['tab\there']);
    expect(parseSExpr('"escaped\\\\"')).toEqual(['escaped\\']);
    expect(parseSExpr('"escaped\\"quote"')).toEqual(['escaped"quote']);
  });

  it('parses nested lists', () => {
    expect(parseSExpr('(a (b c) d)')).toEqual([['a', ['b', 'c'], 'd']]);
  });

  it('parses empty lists', () => {
    expect(parseSExpr('()')).toEqual([[]]);
  });

  it('parses KiCad-style nodes', () => {
    const result = parseSExpr('(net 1 "+5V")');
    expect(result).toEqual([['net', 1, '+5V']]);
  });

  it('handles multiple top-level forms', () => {
    const result = parseSExpr('(a 1) (b 2)');
    expect(result).toEqual([['a', 1], ['b', 2]]);
  });

  it('throws on unterminated string', () => {
    expect(() => parseSExpr('"unclosed')).toThrow(/unterminated string/i);
  });

  it('throws on unclosed list', () => {
    expect(() => parseSExpr('(a b')).toThrow(/unclosed list/i);
  });

  it('throws on unexpected close paren', () => {
    expect(() => parseSExpr(')')).toThrow(/unexpected/i);
  });

  it('includes line number in error', () => {
    expect(() => parseSExpr('\n\n)')).toThrow(/line 3/);
  });

  it('handles whitespace variants', () => {
    const result = parseSExpr('  (  a\t\tb  \n  c  )  ');
    expect(result).toEqual([['a', 'b', 'c']]);
  });
});

describe('parseKicadFile', () => {
  it('parses a valid file with expected tag', () => {
    const root = parseKicadFile('(kicad_sch (version 20230121))', 'kicad_sch');
    expect(root[0]).toBe('kicad_sch');
    expect(getNumberAtom(root, 'version')).toBe(20230121);
  });

  it('rejects wrong top-level tag', () => {
    expect(() => parseKicadFile('(kicad_pcb (version 1))', 'kicad_sch'))
      .toThrow(/expected.*kicad_sch/i);
  });

  it('rejects multiple top-level forms', () => {
    expect(() => parseKicadFile('(a 1) (b 2)', 'a'))
      .toThrow(/expected.*single/i);
  });

  it('rejects bare atom as top-level', () => {
    expect(() => parseKicadFile('hello', 'hello'))
      .toThrow(/expected.*single/i);
  });
});

describe('findChildren / findChild', () => {
  const tree = parseSExpr('(root (net 0 "") (net 1 "+5V") (layer "F.Cu"))')[0]!;

  it('finds all children with a tag', () => {
    const nets = findChildren(tree, 'net');
    expect(nets).toHaveLength(2);
    expect(nets[0]![1]).toBe(0);
    expect(nets[1]![1]).toBe(1);
  });

  it('findChild returns first match', () => {
    const net = findChild(tree as unknown[], 'net');
    expect(net).toBeDefined();
    expect(net![1]).toBe(0);
  });

  it('returns empty/undefined for no match', () => {
    expect(findChildren(tree, 'nonexistent')).toEqual([]);
    expect(findChild(tree as unknown[], 'nonexistent')).toBeUndefined();
  });
});

describe('getStringAtom / getNumberAtom', () => {
  const tree = parseSExpr('(root (version 42) (generator "pcbnew") (empty))')[0]!;

  it('returns string atom', () => {
    expect(getStringAtom(tree as unknown[], 'generator')).toBe('pcbnew');
  });

  it('returns number atom', () => {
    expect(getNumberAtom(tree as unknown[], 'version')).toBe(42);
  });

  it('returns undefined for missing tag', () => {
    expect(getStringAtom(tree as unknown[], 'missing')).toBeUndefined();
    expect(getNumberAtom(tree as unknown[], 'missing')).toBeUndefined();
  });

  it('getNumberAtom returns undefined for string value', () => {
    expect(getNumberAtom(tree as unknown[], 'generator')).toBeUndefined();
  });

  it('getStringAtom coerces number to string', () => {
    expect(getStringAtom(tree as unknown[], 'version')).toBe('42');
  });
});
