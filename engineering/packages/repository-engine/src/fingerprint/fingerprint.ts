import { GitExecutor } from '@logichub-engineering/git-adapter';
import type { FingerprintDescriptor, FingerprintDiagnostics, SoftwareFileSurface, SourceFileEntry } from '../types.js';
import {
  buildSourceInventory, computeContentHashes,
  resolveTreeSha, resolveCommitSha, detectObjectFormat,
  readBlobString,
} from './git-inventory.js';
import { loadToolchainProfile } from './toolchain-profile.js';
import { extractSoftwareSurface } from './software-surface.js';
import { extractKicadSurfaces } from './kicad-surface.js';
import { extractConstraintSurface } from './constraint-surface.js';
import { extractDecisionSurface } from './decision-surface.js';
import { isSoftwareFile, isConstraintFile, isDecisionFile } from '../util/domain-classifier.js';
import { sha256Hex } from '../util/hash.js';
import { jcsCanonicalize } from '../util/jcs.js';

export interface FingerprintOptions {
  repoPath: string;
  commitRef?: string;
  toolchainProfilePath?: string;
  canonical?: boolean;
}

export interface FingerprintResult {
  descriptor: FingerprintDescriptor;
  canonicalBytes: string;
  diagnostics: FingerprintDiagnostics;
}

export async function buildFingerprint(options: FingerprintOptions): Promise<FingerprintResult> {
  const {
    repoPath,
    commitRef = 'HEAD',
    toolchainProfilePath,
  } = options;

  const startTime = performance.now();
  const warnings: string[] = [];
  const errors: string[] = [];

  const executor = new GitExecutor({ timeoutMs: 60_000 });

  const commitSha = await resolveCommitSha(executor, repoPath, commitRef);
  const treeSha = await resolveTreeSha(executor, repoPath, commitRef);
  const objectFormat = await detectObjectFormat(executor, repoPath);

  const profilePath = toolchainProfilePath ??
    new URL('../../toolchain-profile.json', import.meta.url).pathname;
  const { profile, profileHash } = await loadToolchainProfile(profilePath);

  let inventory = await buildSourceInventory(executor, repoPath, treeSha);
  inventory = await computeContentHashes(executor, repoPath, inventory);

  const softwareSurface = await extractSoftwareFiles(executor, repoPath, inventory, warnings);
  const { schematic, pcb, bom } = await extractKicadSurfaces(executor, repoPath, treeSha);
  const constraintSurface = await extractConstraints(executor, repoPath, inventory);
  const decisionSurface = await extractDecisions(executor, repoPath, inventory);

  const descriptorWithoutHash: Omit<FingerprintDescriptor, 'descriptorHash'> = {
    identity: {
      schemaVersion: '0.1.0',
      fingerprintContractId: 'logichub_engineering_fingerprint_v1',
      gitTreeId: treeSha,
      gitObjectFormat: objectFormat,
      toolchainProfileId: profile.profileId,
      toolchainProfileHash: profileHash,
      canonicalizationProfile: profile.canonicalizationProfile,
      descriptorHashAlgorithm: profile.descriptorHashAlgorithm,
    },
    sourceInventory: inventory,
    softwareSurface,
    schematicSurface: schematic,
    pcbSurface: pcb,
    bomSurface: bom,
    constraintSurface,
    decisionSurface,
    validationConfigSurface: null,
  };

  const preHashCanonical = jcsCanonicalize(descriptorWithoutHash);
  const descriptorHash = sha256Hex(preHashCanonical);

  const descriptor: FingerprintDescriptor = {
    ...descriptorWithoutHash,
    descriptorHash,
  };

  const canonicalBytes = jcsCanonicalize(descriptor);
  const durationMs = Math.round(performance.now() - startTime);

  const diagnostics: FingerprintDiagnostics = {
    generatedAt: new Date().toISOString(),
    durationMs,
    fileCount: inventory.length,
    parsedFileCount: inventory.filter(e => e.parseStatus === 'ok').length,
    skippedFileCount: inventory.filter(e => e.parseStatus === 'skipped').length,
    unparseableFileCount: inventory.filter(e => e.parseStatus === 'unparseable').length,
    warnings,
    errors,
  };

  return { descriptor, canonicalBytes, diagnostics };
}

async function extractSoftwareFiles(
  executor: GitExecutor,
  repoPath: string,
  inventory: SourceFileEntry[],
  warnings: string[],
): Promise<SoftwareFileSurface[]> {
  const surfaces: SoftwareFileSurface[] = [];
  const softwareEntries = inventory.filter(e => isSoftwareFile(e.path) && e.language);

  for (const entry of softwareEntries) {
    try {
      const content = await readBlobString(executor, repoPath, entry.blobId);
      const surface = extractSoftwareSurface(entry.path, content, entry.language!);
      surfaces.push(surface);
      entry.parseStatus = 'ok';
    } catch (err) {
      warnings.push(`Failed to parse ${entry.path}: ${err instanceof Error ? err.message : String(err)}`);
      entry.parseStatus = 'unparseable';
    }
  }

  return surfaces;
}

async function extractConstraints(
  executor: GitExecutor,
  repoPath: string,
  inventory: SourceFileEntry[],
) {
  const constraintFiles = inventory.filter(e => isConstraintFile(e.path));
  if (constraintFiles.length === 0) return null;

  const files: Array<{ path: string; content: string }> = [];
  for (const entry of constraintFiles) {
    const content = await readBlobString(executor, repoPath, entry.blobId);
    files.push({ path: entry.path, content });
    entry.parseStatus = 'ok';
  }
  return extractConstraintSurface(files);
}

async function extractDecisions(
  executor: GitExecutor,
  repoPath: string,
  inventory: SourceFileEntry[],
) {
  const decisionFiles = inventory.filter(e => isDecisionFile(e.path));
  if (decisionFiles.length === 0) return null;

  const files: Array<{ path: string; content: string }> = [];
  for (const entry of decisionFiles) {
    const content = await readBlobString(executor, repoPath, entry.blobId);
    files.push({ path: entry.path, content });
    entry.parseStatus = 'ok';
  }
  return extractDecisionSurface(files);
}
