import { CURRENT_SCHEMA_VERSION } from '@logichub-engineering/shared';
import type { ProductGraph } from '@logichub-engineering/product-graph';
import { propagate } from '@logichub-engineering/product-graph';
import { canonicalize } from '../canonical/canonical-json.js';
import { byteLength, hashValue, sha256Hex } from '../canonical/hashing.js';
import {
  CAPSULE_FORMAT_ID,
  CAPSULE_VERSION,
  CHECKSUMS_PATH,
  MANIFEST_PATH,
  comparePaths,
  type Capsule,
  type CapsuleFile,
  type CapsuleFileEntry,
  type CapsuleManifest,
  type ExternalReference,
} from '../schemas/capsule.schema.js';
import { buildSections } from './sections.js';

export interface BuildCapsuleOptions {
  /**
   * Files too large to carry inside the capsule. Each must be pinned by
   * version and checksum; a bare URI would leave the capsule at the mercy of
   * whatever sits at that address later.
   */
  externalReferences?: readonly ExternalReference[];
}

/** The package version recorded in the manifest for reproducibility. */
export const PRODUCT_GRAPH_PACKAGE_VERSION = '0.1.0';

/**
 * Build a complete, self-contained capsule from a product graph.
 *
 * The result carries no wall-clock timestamp and no remote dependency, so the
 * same graph always produces byte-identical output and the capsule can be
 * opened without reaching anything.
 */
export function buildCapsule(graph: ProductGraph, options: BuildCapsuleOptions = {}): Capsule {
  const resolved = propagate(graph).graph;
  const externalReferences = [...(options.externalReferences ?? [])]
    .sort((a, b) => comparePaths(a.id, b.id));

  const sections = [...buildSections(resolved)].sort((a, b) => comparePaths(a.path, b.path));

  const fileEntries: CapsuleFileEntry[] = sections.map(file => ({
    path: file.path,
    sha256: sha256Hex(file.content),
    bytes: byteLength(file.content),
  }));

  const productGraphHash = hashValue(resolved);

  const manifest: CapsuleManifest = {
    formatId: CAPSULE_FORMAT_ID,
    capsuleVersion: CAPSULE_VERSION,
    // Derived from the graph, so the same product always carries the same id.
    revisionId: `rev_${productGraphHash.slice(0, 16)}`,
    productGraphHash,
    sourceGraphId: resolved.id,
    productName: resolved.name,
    toolVersions: {
      capsuleFormat: CAPSULE_VERSION,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      productGraphPackage: PRODUCT_GRAPH_PACKAGE_VERSION,
    },
    files: fileEntries,
    externalReferences,
    remoteDependencies: 'none',
    contentHash: hashValue({ files: fileEntries, externalReferences }),
  };

  const manifestFile: CapsuleFile = {
    path: MANIFEST_PATH,
    content: canonicalize(manifest),
  };

  // The checksum list covers every file including the manifest, but not
  // itself — nothing can hash its own final contents.
  const checksumFile: CapsuleFile = {
    path: CHECKSUMS_PATH,
    content: renderChecksums([...sections, manifestFile]),
  };

  const files = [...sections, manifestFile, checksumFile]
    .sort((a, b) => comparePaths(a.path, b.path));

  return { manifest, files };
}

/**
 * A `sha256sum`-compatible listing, sorted by path so the file is stable.
 */
export function renderChecksums(files: readonly CapsuleFile[]): string {
  const lines = [...files]
    .sort((a, b) => comparePaths(a.path, b.path))
    .map(file => `${sha256Hex(file.content)}  ${file.path}`);
  return `${lines.join('\n')}\n`;
}

/** Total size of everything carried inside the capsule. */
export function capsuleByteSize(capsule: Capsule): number {
  return capsule.files.reduce((total, file) => total + byteLength(file.content), 0);
}
