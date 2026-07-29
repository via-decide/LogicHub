/**
 * Canonical JSON serialization.
 *
 * Two capsules built from the same product must be byte-identical, so
 * serialization cannot depend on the order keys happen to have been inserted
 * in, on floating-point printing, or on the platform. Object keys are sorted,
 * numbers are rejected unless finite, and the output uses a fixed two-space
 * indent with a trailing newline.
 */

export function canonicalize(value: unknown): string {
  return `${render(value, 0)}\n`;
}

/** Canonical form with no indentation, for hashing. */
export function canonicalCompact(value: unknown): string {
  return renderCompact(value);
}

function render(value: unknown, depth: number): string {
  const pad = '  '.repeat(depth);
  const padInner = '  '.repeat(depth + 1);

  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return renderNumber(value);
  if (typeof value === 'string') return JSON.stringify(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map(item => `${padInner}${render(item, depth + 1)}`);
    return `[\n${items.join(',\n')}\n${pad}]`;
  }

  if (typeof value === 'object') {
    const entries = definedEntries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const rendered = entries.map(
      ([key, item]) => `${padInner}${JSON.stringify(key)}: ${render(item, depth + 1)}`,
    );
    return `{\n${rendered.join(',\n')}\n${pad}}`;
  }

  throw new Error(`Value of type ${typeof value} cannot be serialized canonically.`);
}

function renderCompact(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return renderNumber(value);
  if (typeof value === 'string') return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map(renderCompact).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = definedEntries(value as Record<string, unknown>);
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${renderCompact(v)}`).join(',')}}`;
  }

  throw new Error(`Value of type ${typeof value} cannot be serialized canonically.`);
}

/**
 * Keys in sorted order, with undefined values dropped. An absent key and a
 * key set to undefined must serialize the same way, or two equivalent graphs
 * would produce different capsules.
 */
function definedEntries(record: Record<string, unknown>): [string, unknown][] {
  return Object.keys(record)
    .sort()
    .filter(key => record[key] !== undefined)
    .map(key => [key, record[key]] as [string, unknown]);
}

/**
 * A number that cannot round-trip is a defect, not something to paper over
 * with a substitute value. NaN and Infinity have no JSON representation.
 */
function renderNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot serialize non-finite number: ${String(value)}`);
  }
  // Negative zero and positive zero must not produce different bytes.
  return Object.is(value, -0) ? '0' : JSON.stringify(value);
}
