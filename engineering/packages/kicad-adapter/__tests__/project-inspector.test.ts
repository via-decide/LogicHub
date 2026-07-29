import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { inspectProject, validateProjectFiles } from '../src/project-inspector.js';

const FIXTURE_BASE = join(__dirname, '../../../fixtures/kicad/smart-plant-pot/base');

describe('inspectProject', () => {
  it('finds project files in base fixture', async () => {
    const files = await inspectProject(FIXTURE_BASE);
    expect(files.projectName).toBe('smart-plant-pot');
    expect(files.proFile).toContain('smart-plant-pot.kicad_pro');
    expect(files.schematicFile).toContain('smart-plant-pot.kicad_sch');
    expect(files.pcbFile).toContain('smart-plant-pot.kicad_pcb');
  });

  it('throws for non-existent directory', async () => {
    await expect(inspectProject('/tmp/nonexistent-dir-xyz'))
      .rejects.toThrow(/does not exist or is unreadable/);
  });

  it('throws when no .kicad_pro file exists', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'kicad-test-'));
    await writeFile(join(tmp, 'readme.txt'), 'nothing here');
    await expect(inspectProject(tmp)).rejects.toThrow(/no.*kicad_pro/i);
  });

  it('throws when multiple .kicad_pro files exist', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'kicad-test-'));
    await writeFile(join(tmp, 'a.kicad_pro'), '{}');
    await writeFile(join(tmp, 'b.kicad_pro'), '{}');
    await expect(inspectProject(tmp)).rejects.toThrow(/multiple.*kicad_pro/i);
  });

  it('returns null for missing schematic/pcb', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'kicad-test-'));
    await writeFile(join(tmp, 'myproject.kicad_pro'), '{}');
    const files = await inspectProject(tmp);
    expect(files.schematicFile).toBeNull();
    expect(files.pcbFile).toBeNull();
    expect(files.projectName).toBe('myproject');
  });
});

describe('validateProjectFiles', () => {
  it('validates base fixture without errors', async () => {
    const files = await inspectProject(FIXTURE_BASE);
    const result = await validateProjectFiles(files);
    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
  });

  it('reports error for corrupt .kicad_pro', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'kicad-test-'));
    await writeFile(join(tmp, 'bad.kicad_pro'), 'not json');
    const files = await inspectProject(tmp);
    const result = await validateProjectFiles(files);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some(d => d.severity === 'error' && d.message.includes('JSON'))).toBe(true);
  });

  it('reports error for corrupt schematic', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'kicad-test-'));
    await writeFile(join(tmp, 'test.kicad_pro'), '{}');
    await writeFile(join(tmp, 'test.kicad_sch'), '(wrong_tag)');
    const files = await inspectProject(tmp);
    const result = await validateProjectFiles(files);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some(d => d.severity === 'error')).toBe(true);
  });

  it('reports warning for missing schematic/pcb', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'kicad-test-'));
    await writeFile(join(tmp, 'test.kicad_pro'), '{}');
    const files = await inspectProject(tmp);
    const result = await validateProjectFiles(files);
    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter(d => d.severity === 'warning')).toHaveLength(2);
  });
});
