import { ProductGraphSchema, type ProductGraph } from '@logichub-engineering/product-graph';
import { hashValue } from '../canonical/hashing.js';
import {
  CapsuleManifestSchema,
  CHECKSUMS_PATH,
  MANIFEST_PATH,
  comparePaths,
  type Capsule,
  type CapsuleFile,
} from '../schemas/capsule.schema.js';

const PRODUCT_GRAPH_PATH = 'product-graph.json';

/**
 * Flatten a capsule to a path-keyed map, ready to write to disk or to pack
 * into an archive. Paths come back in canonical order.
 */
export function serializeCapsule(capsule: Capsule): Map<string, string> {
  const entries = [...capsule.files]
    .sort((a, b) => comparePaths(a.path, b.path))
    .map(file => [file.path, file.content] as const);
  return new Map(entries);
}

/**
 * Read a capsule back from a path-keyed map.
 *
 * The manifest is parsed and validated; nothing else is trusted yet. Callers
 * are expected to run `verifyCapsule` before using the contents — parsing
 * proves the shape, not the integrity.
 */
export function parseCapsule(files: ReadonlyMap<string, string>): Capsule {
  const manifestText = files.get(MANIFEST_PATH);
  if (manifestText === undefined) {
    throw new Error(`Capsule has no ${MANIFEST_PATH}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(manifestText);
  } catch {
    throw new Error(`${MANIFEST_PATH} is not valid JSON.`);
  }

  const result = CapsuleManifestSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `${MANIFEST_PATH} failed validation: ${result.error.issues.map(i => i.message).join(', ')}`,
    );
  }

  if (!files.has(CHECKSUMS_PATH)) {
    throw new Error(`Capsule has no ${CHECKSUMS_PATH}.`);
  }

  const capsuleFiles: CapsuleFile[] = [...files.entries()]
    .map(([path, content]) => ({ path, content }))
    .sort((a, b) => comparePaths(a.path, b.path));

  return { manifest: result.data, files: capsuleFiles };
}

/**
 * Recover the product graph a capsule was built from.
 *
 * The graph is validated against its schema and checked against the hash the
 * manifest recorded, so an altered graph is caught here rather than silently
 * imported.
 */
export function importProductGraph(capsule: Capsule): ProductGraph {
  const file = capsule.files.find(f => f.path === PRODUCT_GRAPH_PATH);
  if (file === undefined) {
    throw new Error(`Capsule has no ${PRODUCT_GRAPH_PATH}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(file.content);
  } catch {
    throw new Error(`${PRODUCT_GRAPH_PATH} is not valid JSON.`);
  }

  const result = ProductGraphSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `${PRODUCT_GRAPH_PATH} failed validation: `
      + result.error.issues.map(i => i.message).join(', '),
    );
  }

  const actualHash = hashValue(result.data);
  if (actualHash !== capsule.manifest.productGraphHash) {
    throw new Error(
      `${PRODUCT_GRAPH_PATH} hash does not match the manifest: `
      + `expected ${capsule.manifest.productGraphHash}, computed ${actualHash}.`,
    );
  }

  return result.data;
}
