import { describe, it, expect } from 'vitest';
import { updateNodeParameters, propagate } from '@logichub-engineering/product-graph';
import { buildCapsule, capsuleByteSize } from '../src/build/capsule-builder.js';
import { verifyCapsule } from '../src/verify/capsule-verifier.js';
import {
  serializeCapsule,
  parseCapsule,
  importProductGraph,
} from '../src/io/capsule-io.js';
import {
  CapsuleSchema,
  CHECKSUMS_PATH,
  MANIFEST_PATH,
  type ExternalReference,
} from '../src/schemas/capsule.schema.js';
import { roverGraph } from './helpers.js';
import { byteLength, hashValue, sha256Hex } from '../src/canonical/hashing.js';
import { canonicalize } from '../src/canonical/canonical-json.js';
import { renderChecksums } from '../src/build/capsule-builder.js';

const EXPECTED_PATHS = [
  'README.md',
  'applications/engineering/surface.json',
  'applications/operator/surface.json',
  'applications/service/surface.json',
  'assumptions.json',
  'capsule-manifest.json',
  'checksums.sha256',
  'constraints.json',
  'evidence/evidence-manifest.json',
  'firmware/commands.json',
  'firmware/firmware-contract.json',
  'firmware/telemetry.json',
  'hardware/architecture.json',
  'hardware/bom.csv',
  'hardware/interfaces.json',
  'hardware/pin-map.json',
  'kit-match.json',
  'product-feasibility.json',
  'product-graph.json',
  'requirements.md',
  'validation/rules.json',
  'validation/verification-plan.md',
];

function fileIn(capsule: { files: { path: string; content: string }[] }, path: string): string {
  const found = capsule.files.find(f => f.path === path);
  if (found === undefined) throw new Error(`No file ${path}`);
  return found.content;
}

function capsuleWithAlteredGraphAndStaleIdentity() {
  const capsule = buildCapsule(roverGraph());
  const graph = JSON.parse(fileIn(capsule, 'product-graph.json'));
  graph.name = 'Altered product';
  const graphContent = canonicalize(graph);
  const files = capsule.files.map(file =>
    file.path === 'product-graph.json' ? { ...file, content: graphContent } : file);
  const fileEntries = capsule.manifest.files.map(entry =>
    entry.path === 'product-graph.json'
      ? { ...entry, sha256: sha256Hex(graphContent), bytes: byteLength(graphContent) }
      : entry);
  const manifest = {
    ...capsule.manifest,
    files: fileEntries,
    contentHash: hashValue({
      files: fileEntries,
      externalReferences: capsule.manifest.externalReferences,
    }),
  };
  const withManifest = files.map(file =>
    file.path === MANIFEST_PATH ? { ...file, content: canonicalize(manifest) } : file);
  const checksums = renderChecksums(withManifest.filter(file => file.path !== CHECKSUMS_PATH));
  return {
    manifest,
    files: withManifest.map(file =>
      file.path === CHECKSUMS_PATH ? { ...file, content: checksums } : file),
  };
}

describe('Gate 6 — capsule export', () => {
  it('carries the full suggested structure', () => {
    const capsule = buildCapsule(roverGraph());
    expect(CapsuleSchema.safeParse(capsule).success).toBe(true);
    expect(capsule.files.map(f => f.path)).toEqual(EXPECTED_PATHS);
  });

  it('orders files canonically', () => {
    const paths = buildCapsule(roverGraph()).files.map(f => f.path);
    expect(paths).toEqual([...paths].sort());
  });

  it('derives the revision id from the graph hash', () => {
    const capsule = buildCapsule(roverGraph());
    expect(capsule.manifest.revisionId)
      .toBe(`rev_${capsule.manifest.productGraphHash.slice(0, 16)}`);
  });

  it('records tool and schema versions', () => {
    const { toolVersions } = buildCapsule(roverGraph()).manifest;
    expect(toolVersions.capsuleFormat.length).toBeGreaterThan(0);
    expect(toolVersions.schemaVersion.length).toBeGreaterThan(0);
    expect(toolVersions.productGraphPackage.length).toBeGreaterThan(0);
  });

  it('declares no remote dependency', () => {
    expect(buildCapsule(roverGraph()).manifest.remoteDependencies).toBe('none');
  });

  it('lists every content file with a checksum and byte length', () => {
    const capsule = buildCapsule(roverGraph());
    const listed = capsule.manifest.files.map(f => f.path);

    // The manifest and checksum file are not listed inside the manifest,
    // because neither can hash its own final contents.
    expect(listed).not.toContain(MANIFEST_PATH);
    expect(listed).not.toContain(CHECKSUMS_PATH);
    expect(listed).toHaveLength(EXPECTED_PATHS.length - 2);

    for (const entry of capsule.manifest.files) {
      expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(entry.bytes).toBeGreaterThan(0);
    }
  });

  it('writes a sha256sum-compatible checksum file', () => {
    const lines = fileIn(buildCapsule(roverGraph()), CHECKSUMS_PATH).trim().split('\n');
    for (const line of lines) {
      expect(line).toMatch(/^[a-f0-9]{64} {2}\S/);
    }
    // Covers everything except itself.
    expect(lines).toHaveLength(EXPECTED_PATHS.length - 1);
  });

  it('produces a byte-identical capsule from the same graph', () => {
    const graph = roverGraph();
    const baseline = JSON.stringify(buildCapsule(graph));
    for (let i = 0; i < 5; i += 1) {
      expect(JSON.stringify(buildCapsule(graph))).toBe(baseline);
    }
  });

  it('carries no wall-clock timestamp that would break reproduction', () => {
    const manifest = fileIn(buildCapsule(roverGraph()), MANIFEST_PATH);
    expect(manifest).not.toMatch(/generatedAt|builtAt|timestamp/i);
  });

  it('changes the graph hash when the product changes', () => {
    const graph = roverGraph();
    const battery = graph.nodes.find(n => n.type === 'battery')!;
    const changed = propagate(updateNodeParameters(graph, battery.id, { capacityMah: 4000 })).graph;

    const before = buildCapsule(graph).manifest;
    const after = buildCapsule(changed).manifest;

    expect(after.productGraphHash).not.toBe(before.productGraphHash);
    expect(after.revisionId).not.toBe(before.revisionId);
  });

  it('pins external references by version, URI and checksum', () => {
    const reference: ExternalReference = {
      id: 'enclosure-step',
      uri: 'https://example.invalid/enclosure.step',
      version: '2.1.0',
      sha256: 'a'.repeat(64),
      bytes: 12_000_000,
      description: 'Enclosure solid model, too large to carry inline.',
    };
    const capsule = buildCapsule(roverGraph(), { externalReferences: [reference] });
    expect(capsule.manifest.externalReferences).toEqual([reference]);
    expect(verifyCapsule(capsule).externalReferencesUnchecked).toBe(1);
  });

  it('stays well inside the 8 MB entry target for this product', () => {
    expect(capsuleByteSize(buildCapsule(roverGraph()))).toBeLessThan(8 * 1024 * 1024);
  });
});

describe('Gate 6 — capsule contents', () => {
  it('writes UNKNOWN in the bill of materials rather than blanks or zeros', () => {
    const csv = fileIn(buildCapsule(roverGraph()), 'hardware/bom.csv');
    const [header, ...rows] = csv.trim().split('\n');

    expect(header).toContain('manufacturerPartNumber');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const cells = row.split(',');
      // Part number, SKU, cost and currency are all unsourced.
      expect(cells.slice(4, 8).every(c => c === 'UNKNOWN'), row).toBe(true);
      expect(row).toContain('UNSOURCED');
    }
  });

  it('records an empty evidence manifest and says why', () => {
    const evidence = JSON.parse(
      fileIn(buildCapsule(roverGraph()), 'evidence/evidence-manifest.json'),
    );
    expect(evidence.entries).toEqual([]);
    expect(evidence.note).toMatch(/No physical evidence has been captured/);
  });

  it('states that derived values are not measurements', () => {
    const assumptions = JSON.parse(fileIn(buildCapsule(roverGraph()), 'assumptions.json'));
    expect(assumptions.note).toMatch(/not measured/i);
    expect(assumptions.nodes.length).toBeGreaterThan(0);
  });

  it('does not present feasibility verdicts as a claim about a built product', () => {
    const feasibility = JSON.parse(
      fileIn(buildCapsule(roverGraph()), 'product-feasibility.json'),
    );
    expect(feasibility.note).toMatch(/not a statement that any product here has been built/);
  });

  it('lists what would still have to be measured', () => {
    const plan = fileIn(buildCapsule(roverGraph()), 'validation/verification-plan.md');
    expect(plan).toMatch(/Nothing in this capsule has been verified against hardware/);
    expect(plan).toMatch(/No thermal model has been run/);
    expect(plan).toMatch(/No regulatory or safety certification is claimed/);
  });

  it('records the pin map', () => {
    const pinMap = JSON.parse(fileIn(buildCapsule(roverGraph()), 'hardware/pin-map.json'));
    expect(pinMap.assignments).toHaveLength(2);
    expect(pinMap.assignments[0]).toMatchObject({ nodeId: 'n2_controller', function: 'motorLeft' });
  });

  it('carries all three application surfaces separately', () => {
    const capsule = buildCapsule(roverGraph());
    const operator = JSON.parse(fileIn(capsule, 'applications/operator/surface.json'));
    const engineering = JSON.parse(fileIn(capsule, 'applications/engineering/surface.json'));
    const service = JSON.parse(fileIn(capsule, 'applications/service/surface.json'));

    expect(operator.authority).toBe('operator');
    expect(engineering.authority).toBe('engineering');
    expect(service.authority).toBe('service');
  });

  it('states that firmware owns the interlocks', () => {
    const contract = JSON.parse(
      fileIn(buildCapsule(roverGraph()), 'firmware/firmware-contract.json'),
    );
    expect(contract.target).toBe('esp32');
    expect(contract.note).toMatch(/cannot disable, override, or bypass/);
  });
});

describe('Gate 6 — verification', () => {
  it('verifies a freshly built capsule', () => {
    const result = verifyCapsule(buildCapsule(roverGraph()));
    expect(result.findings).toEqual([]);
    expect(result.verified).toBe(true);
    expect(result.filesChecked).toBe(EXPECTED_PATHS.length - 2);
  });

  it('catches an altered file', () => {
    const capsule = buildCapsule(roverGraph());
    const tampered = {
      ...capsule,
      files: capsule.files.map(f =>
        f.path === 'requirements.md' ? { ...f, content: `${f.content}tampered` } : f),
    };

    const result = verifyCapsule(tampered);
    expect(result.verified).toBe(false);
    expect(result.findings.map(f => f.code)).toContain('capsule.checksum-mismatch');
  });

  it('catches an altered graph even when the file tables and checksums are regenerated', () => {
    const result = verifyCapsule(capsuleWithAlteredGraphAndStaleIdentity());
    expect(result.verified).toBe(false);
    expect(result.findings.map(f => f.code))
      .toContain('capsule.product-graph-hash-mismatch');
  });

  it('catches a removed file', () => {
    const capsule = buildCapsule(roverGraph());
    const tampered = {
      ...capsule,
      files: capsule.files.filter(f => f.path !== 'requirements.md'),
    };

    const result = verifyCapsule(tampered);
    expect(result.verified).toBe(false);
    expect(result.findings.map(f => f.code)).toContain('capsule.file-missing');
  });

  it('catches a file smuggled in without being listed', () => {
    const capsule = buildCapsule(roverGraph());
    const tampered = {
      ...capsule,
      files: [...capsule.files, { path: 'extra.json', content: '{}\n' }],
    };

    const result = verifyCapsule(tampered);
    expect(result.verified).toBe(false);
    expect(result.findings.map(f => f.code)).toContain('capsule.file-unlisted');
  });

  it('catches a manifest whose file table was edited', () => {
    const capsule = buildCapsule(roverGraph());
    const tampered = {
      ...capsule,
      manifest: {
        ...capsule.manifest,
        files: capsule.manifest.files.map(f =>
          f.path === 'requirements.md' ? { ...f, sha256: 'b'.repeat(64) } : f),
      },
    };

    const result = verifyCapsule(tampered);
    expect(result.verified).toBe(false);
    const codes = result.findings.map(f => f.code);
    expect(codes).toContain('capsule.checksum-mismatch');
    expect(codes).toContain('capsule.manifest-content-hash-mismatch');
  });

  it('catches a capsule declaring a remote dependency', () => {
    const capsule = buildCapsule(roverGraph());
    const tampered = {
      ...capsule,
      manifest: { ...capsule.manifest, remoteDependencies: 'some' as never },
    };
    expect(verifyCapsule(tampered).findings.map(f => f.code))
      .toContain('capsule.remote-dependency');
  });

  it('catches an unpinned external reference', () => {
    const capsule = buildCapsule(roverGraph(), {
      externalReferences: [{
        id: 'unpinned',
        uri: 'https://example.invalid/thing.bin',
        version: '1.0.0',
        sha256: 'not-a-hash',
        bytes: 10,
        description: 'Missing a usable checksum.',
      }],
    });
    expect(verifyCapsule(capsule).findings.map(f => f.code))
      .toContain('capsule.external-reference-unpinned');
  });

  it('never reports an unchecked external reference as verified content', () => {
    // The referenced bytes are not in the capsule, so nothing about them can
    // be confirmed from inside it.
    const result = verifyCapsule(buildCapsule(roverGraph(), {
      externalReferences: [{
        id: 'model',
        uri: 'https://example.invalid/model.step',
        version: '1.0.0',
        sha256: 'c'.repeat(64),
        bytes: 999,
        description: 'External model.',
      }],
    }));
    expect(result.externalReferencesUnchecked).toBe(1);
    expect(result.filesChecked).toBe(EXPECTED_PATHS.length - 2);
  });
});

describe('Gate 6 — import and reproduce', () => {
  it('round-trips through serialize and parse unchanged', () => {
    const capsule = buildCapsule(roverGraph());
    const reparsed = parseCapsule(serializeCapsule(capsule));

    expect(reparsed.manifest).toEqual(capsule.manifest);
    expect(reparsed.files).toEqual(capsule.files);
  });

  it('verifies after a round trip', () => {
    const capsule = buildCapsule(roverGraph());
    expect(verifyCapsule(parseCapsule(serializeCapsule(capsule))).verified).toBe(true);
  });

  it('recovers the exact product graph it was built from', () => {
    const graph = roverGraph();
    const imported = importProductGraph(parseCapsule(serializeCapsule(buildCapsule(graph))));
    expect(imported).toEqual(graph);
  });

  it('reproduces a byte-identical capsule from the imported graph', () => {
    // This is the whole gate: export, verify, import, rebuild, compare.
    const original = buildCapsule(roverGraph());
    const imported = importProductGraph(parseCapsule(serializeCapsule(original)));
    const rebuilt = buildCapsule(imported);

    expect(rebuilt.manifest.productGraphHash).toBe(original.manifest.productGraphHash);
    expect(rebuilt.manifest.contentHash).toBe(original.manifest.contentHash);
    expect(JSON.stringify(rebuilt)).toBe(JSON.stringify(original));
  });

  it('rejects a capsule with no manifest', () => {
    const files = serializeCapsule(buildCapsule(roverGraph()));
    files.delete(MANIFEST_PATH);
    expect(() => parseCapsule(files)).toThrow(/no capsule-manifest\.json/);
  });

  it('rejects a capsule with no checksum list', () => {
    const files = serializeCapsule(buildCapsule(roverGraph()));
    files.delete(CHECKSUMS_PATH);
    expect(() => parseCapsule(files)).toThrow(/no checksums\.sha256/);
  });

  it('rejects a manifest that is not valid JSON', () => {
    const files = serializeCapsule(buildCapsule(roverGraph()));
    files.set(MANIFEST_PATH, '{not json');
    expect(() => parseCapsule(files)).toThrow(/not valid JSON/);
  });

  it('rejects a manifest that does not match the schema', () => {
    const files = serializeCapsule(buildCapsule(roverGraph()));
    files.set(MANIFEST_PATH, '{"formatId":"logichub.capsule"}');
    expect(() => parseCapsule(files)).toThrow(/failed validation/);
  });

  it('rejects an imported graph that does not match the schema', () => {
    const capsule = buildCapsule(roverGraph());
    const broken = {
      ...capsule,
      files: capsule.files.map(f =>
        f.path === 'product-graph.json' ? { ...f, content: '{"id":"g"}' } : f),
    };
    expect(() => importProductGraph(broken)).toThrow(/failed validation/);
  });

  it('rejects an imported graph that does not match the manifest identity', () => {
    expect(() => importProductGraph(capsuleWithAlteredGraphAndStaleIdentity()))
      .toThrow(/does not match the manifest productGraphHash/);
  });
});
