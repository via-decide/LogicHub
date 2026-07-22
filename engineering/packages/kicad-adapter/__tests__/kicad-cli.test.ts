import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { KicadAdapter } from '../src/operations.js';
import { inspectProject } from '../src/project-inspector.js';
import { collectToolMetadata } from '../src/toolchain.js';
import { ToolExecutor } from '../src/kicad-executor.js';

const FIXTURE_BASE = join(__dirname, '../../../fixtures/kicad/smart-plant-pot/base');

async function kicadAvailable(): Promise<boolean> {
  const executor = new ToolExecutor();
  const meta = await collectToolMetadata(executor);
  return meta.available && meta.supported;
}

async function dirHash(dir: string): Promise<string> {
  const entries = await readdir(dir);
  const hash = createHash('sha256');
  for (const entry of entries.sort()) {
    const content = await readFile(join(dir, entry));
    hash.update(entry);
    hash.update(content);
  }
  return hash.digest('hex');
}

describe('kicad-cli integration', async () => {
  const available = await kicadAvailable();

  describe.skipIf(!available)('renders', () => {
    let adapter: KicadAdapter;

    beforeAll(() => {
      adapter = new KicadAdapter({ timeoutMs: 60_000 });
    });

    it('renders schematic SVG', async () => {
      const files = await inspectProject(FIXTURE_BASE);
      const result = await adapter.renderSchematic(files);
      expect(result.filename).toBe('schematic.svg');
      expect(result.mediaType).toBe('image/svg+xml');
      expect(result.content.length).toBeGreaterThan(100);
      expect(result.content.toString('utf-8')).toContain('<svg');
      expect(result.toolVersion).toBeTruthy();
    });

    it('renders PCB SVG', async () => {
      const files = await inspectProject(FIXTURE_BASE);
      const result = await adapter.renderPcbLayers(files);
      expect(result.filename).toBe('pcb.svg');
      expect(result.mediaType).toBe('image/svg+xml');
      expect(result.content.length).toBeGreaterThan(100);
      expect(result.content.toString('utf-8')).toContain('<svg');
    });

    it('does not modify source directory', async () => {
      const hashBefore = await dirHash(FIXTURE_BASE);
      const files = await inspectProject(FIXTURE_BASE);
      await adapter.renderSchematic(files);
      await adapter.renderPcbLayers(files);
      const hashAfter = await dirHash(FIXTURE_BASE);
      expect(hashAfter).toBe(hashBefore);
    });
  });

  describe.skipIf(!available)('DRC', () => {
    let adapter: KicadAdapter;

    beforeAll(() => {
      adapter = new KicadAdapter({ timeoutMs: 60_000 });
    });

    it('runs DRC on base fixture', async () => {
      const files = await inspectProject(FIXTURE_BASE);
      const result = await adapter.runDrc(files);
      expect(['pass', 'warning']).toContain(result.status);
      expect(result.toolVersion).toBeTruthy();
      expect(result.diagnostics.every(d => d.severity !== 'error')).toBe(true);
    });

    it('does not modify source directory', async () => {
      const hashBefore = await dirHash(FIXTURE_BASE);
      const files = await inspectProject(FIXTURE_BASE);
      await adapter.runDrc(files);
      const hashAfter = await dirHash(FIXTURE_BASE);
      expect(hashAfter).toBe(hashBefore);
    });
  });

  describe.skipIf(!available)('ERC', () => {
    it('returns skipped for KiCad 7 (no headless ERC)', async () => {
      const adapter = new KicadAdapter({ timeoutMs: 60_000 });
      const files = await inspectProject(FIXTURE_BASE);
      const result = await adapter.runErc(files);
      expect(result.status).toBe('skipped');
      expect(result.diagnostics.some(d => d.message.includes('KiCad 7') || d.message.includes('KiCad 8'))).toBe(true);
    });
  });
});
