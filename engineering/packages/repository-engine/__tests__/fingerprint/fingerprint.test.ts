import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildFingerprint } from '../../src/fingerprint/fingerprint.js';
import {
  createFixtureRepo, commitFile, commitFiles,
  headSha, treeSha, git, makeTempDir,
} from '../helpers.js';

describe('buildFingerprint', () => {
  let repoDir: string;
  let commitRef: string;

  beforeAll(() => {
    repoDir = createFixtureRepo();

    mkdirSync(join(repoDir, 'firmware'), { recursive: true });
    mkdirSync(join(repoDir, 'constraints'), { recursive: true });
    mkdirSync(join(repoDir, 'decisions'), { recursive: true });

    writeFileSync(join(repoDir, 'toolchain-profile.json'), JSON.stringify({
      profileId: 'test-v0.1.0',
      canonicalizationProfile: 'rfc8785',
      descriptorHashAlgorithm: 'sha256',
      kicadParserVersion: 'kicad-sexpr-v7-logichub-0.1.0',
      softwareParserRuntime: 'regex-v0.1.0',
      softwareParserVersion: '0.1.0',
      grammars: {},
      resolverRules: 'node-esm',
      signatureNormalization: 'whitespace-collapse',
      pathNormalization: 'posix-forward-slash',
      unicodeNormalization: 'NFC',
      jcsImplementation: 'canonicalize',
      jcsVersion: '2.0.0',
    }, null, 2));

    writeFileSync(join(repoDir, 'firmware/main.ts'), [
      'import { readSensor } from "./sensor.js";',
      '',
      'export function setup(): void {',
      '  const value = readSensor();',
      '  console.log(value);',
      '}',
      '',
      'export function loop(): void {',
      '  // main loop',
      '}',
      '',
    ].join('\n'));

    writeFileSync(join(repoDir, 'firmware/sensor.ts'), [
      'export function readSensor(): number {',
      '  return Math.random() * 1024;',
      '}',
      '',
      'export const SENSOR_PIN = 3;',
      '',
    ].join('\n'));

    writeFileSync(join(repoDir, 'firmware/config.ts'), [
      'export const MAX_VOLTAGE = 5.0;',
      'export const SAMPLE_RATE = 1000;',
      '',
    ].join('\n'));

    writeFileSync(join(repoDir, 'constraints/electrical.constraints.json'), JSON.stringify([
      {
        id: 'voltage-limit',
        category: 'electrical',
        severity: 'blocking',
        expression: 'Vin <= 5V',
        unit: 'V',
        expectedValue: '5',
        targets: ['schematic::U1'],
      },
    ], null, 2));

    writeFileSync(join(repoDir, 'decisions/adr-001.json'), JSON.stringify({
      id: 'adr-001',
      subject: 'Voltage regulator selection',
      status: 'accepted',
      selectedOption: 'LDO-3.3V',
      affectedKeys: ['schematic::U1'],
    }, null, 2));

    git(repoDir, 'add', '-A');
    git(repoDir, 'commit', '-m', 'add firmware and engineering files');
    commitRef = headSha(repoDir);
  });

  afterAll(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  it('produces a valid fingerprint descriptor', async () => {
    const tree = treeSha(repoDir, commitRef);
    const result = await buildFingerprint({
      repoPath: repoDir,
      treeSha: tree,
      toolchainProfilePath: join(repoDir, 'toolchain-profile.json'),
    });

    expect(result.descriptor).toBeDefined();
    expect(result.descriptor.identity.schemaVersion).toBe('0.1.0');
    expect(result.descriptor.identity.gitTreeId).toBe(tree);
    expect(result.descriptor.descriptorHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('includes source inventory', async () => {
    const tree = treeSha(repoDir, commitRef);
    const result = await buildFingerprint({
      repoPath: repoDir,
      treeSha: tree,
      toolchainProfilePath: join(repoDir, 'toolchain-profile.json'),
    });

    expect(result.descriptor.sourceInventory.length).toBeGreaterThan(0);
    const paths = result.descriptor.sourceInventory.map(e => e.path);
    expect(paths).toContain('firmware/main.ts');
    expect(paths).toContain('firmware/sensor.ts');
  });

  it('extracts software surface', async () => {
    const tree = treeSha(repoDir, commitRef);
    const result = await buildFingerprint({
      repoPath: repoDir,
      treeSha: tree,
      toolchainProfilePath: join(repoDir, 'toolchain-profile.json'),
    });

    expect(result.descriptor.softwareSurface.length).toBeGreaterThan(0);
    const mainSurface = result.descriptor.softwareSurface.find(s => s.path === 'firmware/main.ts');
    expect(mainSurface).toBeDefined();
    expect(mainSurface!.exportedSymbols.length).toBeGreaterThan(0);

    const setupExport = mainSurface!.exportedSymbols.find(e => e.name === 'setup');
    expect(setupExport).toBeDefined();
    expect(setupExport!.kind).toBe('function');
  });

  it('extracts constraint surface', async () => {
    const tree = treeSha(repoDir, commitRef);
    const result = await buildFingerprint({
      repoPath: repoDir,
      treeSha: tree,
      toolchainProfilePath: join(repoDir, 'toolchain-profile.json'),
    });

    expect(result.descriptor.constraintSurface).not.toBeNull();
    expect(result.descriptor.constraintSurface!.constraints.length).toBeGreaterThan(0);
  });

  it('extracts decision surface', async () => {
    const tree = treeSha(repoDir, commitRef);
    const result = await buildFingerprint({
      repoPath: repoDir,
      treeSha: tree,
      toolchainProfilePath: join(repoDir, 'toolchain-profile.json'),
    });

    expect(result.descriptor.decisionSurface).not.toBeNull();
    expect(result.descriptor.decisionSurface!.decisions.length).toBeGreaterThan(0);
  });

  it('produces deterministic fingerprint hash', async () => {
    const tree = treeSha(repoDir, commitRef);
    const r1 = await buildFingerprint({
      repoPath: repoDir,
      treeSha: tree,
      toolchainProfilePath: join(repoDir, 'toolchain-profile.json'),
    });
    const r2 = await buildFingerprint({
      repoPath: repoDir,
      treeSha: tree,
      toolchainProfilePath: join(repoDir, 'toolchain-profile.json'),
    });

    expect(r1.descriptor.descriptorHash).toBe(r2.descriptor.descriptorHash);
    expect(r1.canonicalBytes).toEqual(r2.canonicalBytes);
  });

  it('returns diagnostics', async () => {
    const tree = treeSha(repoDir, commitRef);
    const result = await buildFingerprint({
      repoPath: repoDir,
      treeSha: tree,
      toolchainProfilePath: join(repoDir, 'toolchain-profile.json'),
    });

    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics.fileCount).toBeGreaterThan(0);
    expect(result.diagnostics.durationMs).toBeGreaterThanOrEqual(0);
  });
});
