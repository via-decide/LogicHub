import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { parseKicadFile, findChildren, findChild, getStringAtom, getNumberAtom, type SExpr } from '../sexpr/parser.js';
import type { ParsedSchematic, SchematicSymbol } from '../types.js';

function readProperties(symbolNode: SExpr[]): Record<string, string> {
  const props: Record<string, string> = {};
  for (const prop of findChildren(symbolNode, 'property')) {
    const name = prop[1];
    const value = prop[2];
    if (typeof name === 'string' && !Array.isArray(value) && value !== undefined) {
      props[name] = String(value);
    }
  }
  return props;
}

function readPosition(node: SExpr[]): { x: number; y: number; angle: number } {
  const at = findChild(node, 'at');
  if (!at) return { x: 0, y: 0, angle: 0 };
  const [, x, y, angle] = at;
  return {
    x: typeof x === 'number' ? x : 0,
    y: typeof y === 'number' ? y : 0,
    angle: typeof angle === 'number' ? angle : 0,
  };
}

/** Lib IDs of symbols declared with the (power) flag in lib_symbols. */
function collectPowerLibIds(root: SExpr[]): Set<string> {
  const powerIds = new Set<string>();
  const libSymbols = findChild(root, 'lib_symbols');
  if (!libSymbols) return powerIds;
  for (const sym of findChildren(libSymbols, 'symbol')) {
    const libId = sym[1];
    if (typeof libId === 'string' && sym.some(c => Array.isArray(c) && c[0] === 'power')) {
      powerIds.add(libId);
    }
  }
  return powerIds;
}

export async function parseSchematic(filePath: string): Promise<ParsedSchematic> {
  const raw = await readFile(filePath, 'utf-8');
  const root = parseKicadFile(raw, 'kicad_sch');

  const powerLibIds = collectPowerLibIds(root);
  const symbols: SchematicSymbol[] = [];

  for (const node of findChildren(root, 'symbol')) {
    const libId = getStringAtom(node, 'lib_id');
    if (libId === undefined) continue; // lib_symbols definitions have no lib_id

    const props = readProperties(node);
    const inBomAtom = getStringAtom(node, 'in_bom');
    const onBoardAtom = getStringAtom(node, 'on_board');

    symbols.push({
      uuid: getStringAtom(node, 'uuid') ?? '',
      libId,
      reference: props['Reference'] ?? '?',
      value: props['Value'] ?? '',
      footprint: props['Footprint'] ?? '',
      unit: getNumberAtom(node, 'unit') ?? 1,
      inBom: inBomAtom !== 'no',
      onBoard: onBoardAtom !== 'no',
      isPower: powerLibIds.has(libId) || (props['Reference'] ?? '').startsWith('#'),
      position: readPosition(node),
      properties: props,
    });
  }

  const titleBlock = findChild(root, 'title_block');
  const sheetName = (titleBlock && getStringAtom(titleBlock, 'title')) ?? basename(filePath, '.kicad_sch');

  return {
    uuid: getStringAtom(root, 'uuid') ?? '',
    version: getNumberAtom(root, 'version') ?? 0,
    generator: getStringAtom(root, 'generator') ?? 'unknown',
    sheetName,
    sourcePath: filePath,
    symbols,
    raw: root,
  };
}
