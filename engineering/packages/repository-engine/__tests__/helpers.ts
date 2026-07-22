import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type {
  FingerprintDescriptor, FingerprintIdentity,
  SoftwareFileSurface, ExportedSymbol, ImportRecord, EntryPoint,
  SourceFileEntry,
  SchematicSurface, PcbSurface, BomSurface,
  ConstraintSurface, DecisionSurface,
  SymbolSummary, NetSummary, FootprintSummary, PadSummary,
  BomGroupSummary, ConstraintSummaryEntry, DecisionSummaryEntry,
} from '../src/types.js';

const GIT_ID = [
  '-c', 'user.name=Test User',
  '-c', 'user.email=test@example.com',
];

export function makeTempDir(prefix = 'repo-engine-test-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function git(repoDir: string, ...args: string[]): string {
  return execFileSync('git', ['-C', repoDir, ...GIT_ID, ...args], { encoding: 'utf-8' });
}

export function createFixtureRepo(): string {
  const dir = makeTempDir();
  execFileSync('git', ['init', '-b', 'main', dir], { encoding: 'utf-8' });
  writeFileSync(join(dir, 'README.md'), '# Fixture\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-m', 'initial commit');
  return dir;
}

export function commitFile(repoDir: string, relPath: string, content: string, message: string): string {
  const abs = join(repoDir, relPath);
  const parent = abs.slice(0, abs.lastIndexOf('/'));
  mkdirSync(parent, { recursive: true });
  writeFileSync(abs, content);
  git(repoDir, 'add', '-A');
  git(repoDir, 'commit', '-m', message);
  return headSha(repoDir);
}

export function commitFiles(
  repoDir: string,
  files: Array<{ path: string; content: string }>,
  message: string,
): string {
  for (const f of files) {
    const abs = join(repoDir, f.path);
    const parent = abs.slice(0, abs.lastIndexOf('/'));
    mkdirSync(parent, { recursive: true });
    writeFileSync(abs, f.content);
  }
  git(repoDir, 'add', '-A');
  git(repoDir, 'commit', '-m', message);
  return headSha(repoDir);
}

export function headSha(repoDir: string): string {
  return git(repoDir, 'rev-parse', 'HEAD').trim();
}

export function treeSha(repoDir: string, commitRef = 'HEAD'): string {
  return git(repoDir, 'rev-parse', `${commitRef}^{tree}`).trim();
}

export function makeIdentity(overrides: Partial<FingerprintIdentity> = {}): FingerprintIdentity {
  return {
    schemaVersion: '0.1.0',
    fingerprintContractId: 'test',
    gitTreeId: 'aaaa',
    gitObjectFormat: 'sha1',
    toolchainProfileId: 'test',
    toolchainProfileHash: 'bbbb',
    canonicalizationProfile: 'rfc8785',
    descriptorHashAlgorithm: 'sha256',
    ...overrides,
  };
}

export function makeExport(name: string, overrides: Partial<ExportedSymbol> = {}): ExportedSymbol {
  return {
    semanticId: `software::test.ts::export::${name}`,
    name,
    kind: 'function',
    normalizedSignature: `function ${name}()`,
    bodyHash: `hash_${name}`,
    alphaNormalizedBodyHash: `alpha_hash_${name}`,
    ...overrides,
  };
}

export function makeSoftwareSurface(path: string, overrides: Partial<SoftwareFileSurface> = {}): SoftwareFileSurface {
  return {
    path,
    language: 'typescript',
    primaryLanguage: 'typescript',
    secondaryLanguages: [],
    namedAstNodeCount: 10,
    fileCount: 1,
    byteCount: 100,
    entryPoints: [],
    exportedSymbols: [],
    normalizedSignatures: [],
    bodyHash: 'body_hash',
    alphaNormalizedBodyHash: 'alpha_body_hash',
    imports: [],
    assertionSiteCount: 0,
    exportedSymbolCount: 0,
    assertionDensityBasisPoints: 0,
    ...overrides,
  };
}

export function makeSourceEntry(path: string, overrides: Partial<SourceFileEntry> = {}): SourceFileEntry {
  return {
    path,
    blobId: 'abc123',
    byteSize: 100,
    mode: '100644',
    domainClass: 'software',
    language: 'typescript',
    classification: 'source',
    parserProfile: 'regex-v0.1.0',
    parseStatus: 'ok',
    contentHash: `content_hash_${path}`,
    ...overrides,
  };
}

export function makeSymbolSummary(ref: string, overrides: Partial<SymbolSummary> = {}): SymbolSummary {
  return {
    reference: ref,
    value: '100nF',
    footprint: 'Capacitor_SMD:C_0402',
    libId: 'Device:C',
    mpn: null,
    pinCount: 2,
    semanticHash: `hash_${ref}`,
    semanticId: `schematic::${ref}`,
    ...overrides,
  };
}

export function makeNetSummary(name: string): NetSummary {
  return {
    name,
    semanticHash: `net_hash_${name}`,
    semanticId: `net::${name}`,
    connectedPins: [],
  };
}

export function makeFootprintSummary(ref: string, overrides: Partial<FootprintSummary> = {}): FootprintSummary {
  return {
    reference: ref,
    footprint: 'Capacitor_SMD:C_0402',
    layer: 'F.Cu',
    padCount: 2,
    semanticId: `pcb::${ref}`,
    ...overrides,
  };
}

export function makeBomGroup(value: string, footprint: string, overrides: Partial<BomGroupSummary> = {}): BomGroupSummary {
  return {
    referenceGroup: [],
    quantity: 1,
    value,
    footprint,
    manufacturer: '',
    mpn: '',
    supplierIds: {},
    approvedAlternatives: [],
    lifecycleStatus: null,
    unitCost: null,
    semanticHash: `bom_hash_${value}_${footprint}`,
    ...overrides,
  };
}

export function makeConstraint(id: string, overrides: Partial<ConstraintSummaryEntry> = {}): ConstraintSummaryEntry {
  return {
    id,
    category: 'electrical',
    severity: 'blocking',
    targetSemanticKeys: [],
    normalizedExpression: 'Vin <= 5V',
    unit: 'V',
    expectedValue: '5',
    source: null,
    semanticHash: `constraint_hash_${id}`,
    ...overrides,
  };
}

export function makeDecision(id: string, overrides: Partial<DecisionSummaryEntry> = {}): DecisionSummaryEntry {
  return {
    id,
    subject: `Decision ${id}`,
    selectedOptionHash: `decision_hash_${id}`,
    affectedSemanticKeys: [],
    status: 'accepted',
    ...overrides,
  };
}

export function makeFingerprint(overrides: Partial<FingerprintDescriptor> = {}): FingerprintDescriptor {
  return {
    identity: makeIdentity(),
    sourceInventory: [],
    softwareSurface: [],
    schematicSurface: null,
    pcbSurface: null,
    bomSurface: null,
    constraintSurface: null,
    decisionSurface: null,
    validationConfigSurface: null,
    descriptorHash: 'descriptor_hash',
    ...overrides,
  };
}
