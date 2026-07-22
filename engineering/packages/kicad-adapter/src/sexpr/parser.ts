import { createLogicHubError } from '@logichub-engineering/shared';

/**
 * KiCad file S-expression node. Lists are arrays whose first element is
 * usually the tag atom; atoms are strings (quoted or bare) or numbers.
 */
export type SExpr = string | number | SExpr[];

export function parseSExpr(input: string): SExpr[] {
  let pos = 0;
  let line = 1;

  function fail(message: string): never {
    throw createLogicHubError('LH_KICAD_PROJECT_INVALID',
      `S-expression parse error at line ${line}: ${message}`,
      { diagnostics: { line, position: pos } });
  }

  function skipWhitespace(): void {
    while (pos < input.length) {
      const ch = input[pos]!;
      if (ch === '\n') { line++; pos++; }
      else if (ch === ' ' || ch === '\t' || ch === '\r') pos++;
      else break;
    }
  }

  function parseString(): string {
    pos++; // opening quote
    let out = '';
    while (pos < input.length) {
      const ch = input[pos]!;
      if (ch === '\\') {
        const next = input[pos + 1];
        if (next === undefined) fail('unterminated escape in string');
        if (next === 'n') out += '\n';
        else if (next === 't') out += '\t';
        else if (next === 'r') out += '\r';
        else out += next;
        pos += 2;
      } else if (ch === '"') {
        pos++;
        return out;
      } else {
        if (ch === '\n') line++;
        out += ch;
        pos++;
      }
    }
    fail('unterminated string');
  }

  function parseAtom(): string | number {
    const start = pos;
    while (pos < input.length && !' \t\r\n()"'.includes(input[pos]!)) pos++;
    const raw = input.slice(start, pos);
    if (/^-?\d+$/.test(raw)) return Number.parseInt(raw, 10);
    if (/^-?\d*\.\d+$/.test(raw)) return Number.parseFloat(raw);
    return raw;
  }

  function parseNode(): SExpr {
    skipWhitespace();
    if (pos >= input.length) fail('unexpected end of input');
    const ch = input[pos]!;
    if (ch === '(') {
      pos++;
      const list: SExpr[] = [];
      for (;;) {
        skipWhitespace();
        if (pos >= input.length) fail('unclosed list');
        if (input[pos] === ')') { pos++; return list; }
        list.push(parseNode());
      }
    }
    if (ch === ')') fail("unexpected ')'");
    if (ch === '"') return parseString();
    return parseAtom();
  }

  const nodes: SExpr[] = [];
  skipWhitespace();
  while (pos < input.length) {
    nodes.push(parseNode());
    skipWhitespace();
  }
  return nodes;
}

/** Parse a file that must contain exactly one top-level list with the given tag. */
export function parseKicadFile(content: string, expectedTag: string): SExpr[] {
  const nodes = parseSExpr(content);
  if (nodes.length !== 1 || !Array.isArray(nodes[0]) || nodes[0][0] !== expectedTag) {
    throw createLogicHubError('LH_KICAD_PROJECT_INVALID',
      `Expected a single top-level (${expectedTag} ...) form`,
      { diagnostics: { expectedTag, topLevelCount: nodes.length } });
  }
  return nodes[0];
}

/** All child lists of `node` whose first element is `tag`. */
export function findChildren(node: SExpr, tag: string): SExpr[][] {
  if (!Array.isArray(node)) return [];
  return node.filter((c): c is SExpr[] => Array.isArray(c) && c[0] === tag);
}

/** First child list with the given tag, or undefined. */
export function findChild(node: SExpr, tag: string): SExpr[] | undefined {
  return findChildren(node, tag)[0];
}

/** The single atom payload of `(tag atom)` under `node`, or undefined. */
export function getAtom(node: SExpr, tag: string): string | number | undefined {
  const child = findChild(node, tag);
  if (!child) return undefined;
  const value = child[1];
  return Array.isArray(value) ? undefined : value;
}

export function getStringAtom(node: SExpr, tag: string): string | undefined {
  const value = getAtom(node, tag);
  return value === undefined ? undefined : String(value);
}

export function getNumberAtom(node: SExpr, tag: string): number | undefined {
  const value = getAtom(node, tag);
  return typeof value === 'number' ? value : undefined;
}
