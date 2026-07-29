import { z } from 'zod';

export const Sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const CapsuleFileEntrySchema = z.object({
  path: z.string().min(1),
  sha256: Sha256HexSchema,
  bytes: z.number().int().nonnegative(),
});
export type CapsuleFileEntry = z.infer<typeof CapsuleFileEntrySchema>;

/**
 * A file too large to carry inside the capsule, referenced instead.
 *
 * A reference is only usable if it says which version it means and what it
 * should hash to; a bare URI would make the capsule depend on whatever
 * happens to be at that address later.
 */
export const ExternalReferenceSchema = z.object({
  id: z.string().min(1),
  uri: z.string().min(1),
  version: z.string().min(1),
  sha256: Sha256HexSchema,
  bytes: z.number().int().nonnegative(),
  description: z.string(),
});
export type ExternalReference = z.infer<typeof ExternalReferenceSchema>;

export const ToolVersionsSchema = z.object({
  capsuleFormat: z.string().min(1),
  schemaVersion: z.string().min(1),
  productGraphPackage: z.string().min(1),
});
export type ToolVersions = z.infer<typeof ToolVersionsSchema>;

export const CapsuleManifestSchema = z.object({
  formatId: z.literal('logichub.capsule'),
  capsuleVersion: z.string().min(1),
  /** Derived from the graph hash, so the same product always has the same id. */
  revisionId: z.string().min(1),
  productGraphHash: Sha256HexSchema,
  sourceGraphId: z.string().min(1),
  productName: z.string().min(1),
  toolVersions: ToolVersionsSchema,
  /** Every file carried in the capsule, in canonical path order. */
  files: z.array(CapsuleFileEntrySchema),
  externalReferences: z.array(ExternalReferenceSchema),
  /**
   * Always 'none'. A capsule that needed to reach the network to be understood
   * would not be portable, so nothing in it may resolve at open time.
   */
  remoteDependencies: z.literal('none'),
  /** Hash over the file table, binding the manifest to its contents. */
  contentHash: Sha256HexSchema,
});
export type CapsuleManifest = z.infer<typeof CapsuleManifestSchema>;

export const CapsuleFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});
export type CapsuleFile = z.infer<typeof CapsuleFileSchema>;

export const CapsuleSchema = z.object({
  manifest: CapsuleManifestSchema,
  /** Every file including the manifest and checksums, in canonical order. */
  files: z.array(CapsuleFileSchema),
});
export type Capsule = z.infer<typeof CapsuleSchema>;

export const CAPSULE_FORMAT_ID = 'logichub.capsule';
export const CAPSULE_VERSION = '1.0.0';
export const MANIFEST_PATH = 'capsule-manifest.json';
export const CHECKSUMS_PATH = 'checksums.sha256';

/**
 * Canonical path ordering. Byte-wise comparison, so the order does not shift
 * with the machine's locale.
 */
export function comparePaths(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
