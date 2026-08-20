import { sha256Hex, byteLength, hashValue } from '../canonical/hashing.js';
import {
  CAPSULE_FORMAT_ID,
  CHECKSUMS_PATH,
  MANIFEST_PATH,
  type Capsule,
  type CapsuleFile,
} from '../schemas/capsule.schema.js';
import type {
  VerificationFinding,
  VerificationResult,
} from '../schemas/verification.schema.js';
import { renderChecksums } from '../build/capsule-builder.js';

const PRODUCT_GRAPH_PATH = 'product-graph.json';

/**
 * Verify a capsule end to end.
 *
 * Every file listed in the manifest must be present and hash to what the
 * manifest says; every file present must be listed. The checksum file must
 * agree with both. External references are recorded as unchecked rather than
 * counted as passing, because their content is not carried here.
 *
 * `verified` is true only when nothing failed. There is no partial pass.
 */
export function verifyCapsule(capsule: Capsule): VerificationResult {
  const findings: VerificationFinding[] = [];
  const byPath = new Map(capsule.files.map(f => [f.path, f]));

  if (capsule.manifest.formatId !== CAPSULE_FORMAT_ID) {
    findings.push({
      code: 'capsule.wrong-format',
      severity: 'error',
      path: MANIFEST_PATH,
      message: `Expected format ${CAPSULE_FORMAT_ID}, found ${capsule.manifest.formatId}.`,
    });
  }

  if (capsule.manifest.remoteDependencies !== 'none') {
    findings.push({
      code: 'capsule.remote-dependency',
      severity: 'error',
      path: MANIFEST_PATH,
      message: 'The capsule declares a remote dependency, so it is not self-contained.',
    });
  }

  let filesChecked = 0;

  for (const entry of capsule.manifest.files) {
    const file = byPath.get(entry.path);
    if (file === undefined) {
      findings.push({
        code: 'capsule.file-missing',
        severity: 'error',
        path: entry.path,
        message: 'Listed in the manifest but not present in the capsule.',
      });
      continue;
    }

    filesChecked += 1;

    const actual = sha256Hex(file.content);
    if (actual !== entry.sha256) {
      findings.push({
        code: 'capsule.checksum-mismatch',
        severity: 'error',
        path: entry.path,
        message: `Expected ${entry.sha256}, computed ${actual}.`,
      });
    }

    const actualBytes = byteLength(file.content);
    if (actualBytes !== entry.bytes) {
      findings.push({
        code: 'capsule.size-mismatch',
        severity: 'error',
        path: entry.path,
        message: `Manifest records ${entry.bytes} bytes, file is ${actualBytes}.`,
      });
    }
  }

  // A file nobody vouches for is as much of a problem as a missing one.
  const listed = new Set(capsule.manifest.files.map(f => f.path));
  for (const file of capsule.files) {
    if (file.path === MANIFEST_PATH || file.path === CHECKSUMS_PATH) continue;
    if (!listed.has(file.path)) {
      findings.push({
        code: 'capsule.file-unlisted',
        severity: 'error',
        path: file.path,
        message: 'Present in the capsule but absent from the manifest.',
      });
    }
  }

  const expectedContentHash = hashValue({
    files: capsule.manifest.files,
    externalReferences: capsule.manifest.externalReferences,
  });
  if (capsule.manifest.contentHash !== expectedContentHash) {
    findings.push({
      code: 'capsule.manifest-content-hash-mismatch',
      severity: 'error',
      path: MANIFEST_PATH,
      message: 'The manifest content hash does not match its own file table.',
    });
  }

  const graphFile = byPath.get(PRODUCT_GRAPH_PATH);
  if (graphFile !== undefined) {
    try {
      const actualGraphHash = hashValue(JSON.parse(graphFile.content));
      if (actualGraphHash !== capsule.manifest.productGraphHash) {
        findings.push({
          code: 'capsule.product-graph-hash-mismatch',
          severity: 'error',
          path: PRODUCT_GRAPH_PATH,
          message: `Expected ${capsule.manifest.productGraphHash}, computed ${actualGraphHash}.`,
        });
      }
    } catch {
      findings.push({
        code: 'capsule.product-graph-invalid',
        severity: 'error',
        path: PRODUCT_GRAPH_PATH,
        message: 'The product graph is not valid JSON.',
      });
    }
  }

  findings.push(...verifyChecksumFile(capsule, byPath));

  for (const reference of capsule.manifest.externalReferences) {
    if (!/^[a-f0-9]{64}$/.test(reference.sha256)) {
      findings.push({
        code: 'capsule.external-reference-unpinned',
        severity: 'error',
        path: null,
        message: `External reference ${reference.id} carries no usable checksum.`,
      });
    }
  }

  return {
    verified: findings.every(f => f.severity !== 'error'),
    findings: findings.sort(compareFindings),
    filesChecked,
    externalReferencesUnchecked: capsule.manifest.externalReferences.length,
  };
}

function verifyChecksumFile(
  capsule: Capsule,
  byPath: Map<string, CapsuleFile>,
): VerificationFinding[] {
  const checksumFile = byPath.get(CHECKSUMS_PATH);
  if (checksumFile === undefined) {
    return [{
      code: 'capsule.checksums-missing',
      severity: 'error',
      path: CHECKSUMS_PATH,
      message: 'The capsule carries no checksum list.',
    }];
  }

  const covered = capsule.files.filter(f => f.path !== CHECKSUMS_PATH);
  const expected = renderChecksums(covered);

  if (checksumFile.content !== expected) {
    return [{
      code: 'capsule.checksums-mismatch',
      severity: 'error',
      path: CHECKSUMS_PATH,
      message: 'The checksum list does not match the files carried in the capsule.',
    }];
  }

  return [];
}

function compareFindings(a: VerificationFinding, b: VerificationFinding): number {
  const ap = a.path ?? '';
  const bp = b.path ?? '';
  if (ap !== bp) return ap < bp ? -1 : 1;
  return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
}
