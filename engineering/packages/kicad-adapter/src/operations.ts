import { readFile, readdir, mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLogicHubError } from '@logichub-engineering/shared';
import type { EngineeringObject } from '@logichub-engineering/contracts';
import { ToolExecutor } from './kicad-executor.js';
import { inspectProject, validateProjectFiles } from './project-inspector.js';
import { parseSchematic } from './extractors/schematic-extractor.js';
import { parsePcb } from './extractors/pcb-extractor.js';
import { extractBom } from './extractors/bom-extractor.js';
import {
  schematicToObjects, pcbToObjects, bomToObjects,
  type ExtractionContext,
} from './extractors/engineering-objects.js';
import {
  collectToolMetadata, detectCapabilities, assertSupportedVersion,
  type ToolchainCapabilities,
} from './toolchain.js';
import type {
  KicadProjectFiles, ProjectValidation, BomItem,
  ToolMetadata, CheckResult, RenderResult, FileDiagnostic,
} from './types.js';

export interface KicadAdapterOptions {
  timeoutMs?: number;
  onAudit?: (record: import('./kicad-executor.js').ToolCommandAudit) => void;
}

export class KicadAdapter {
  private readonly executor: ToolExecutor;
  private cachedCapabilities: ToolchainCapabilities | null = null;

  constructor(options: KicadAdapterOptions = {}) {
    this.executor = new ToolExecutor({
      timeoutMs: options.timeoutMs,
      onAudit: options.onAudit,
    });
  }

  async inspectProject(projectDir: string): Promise<KicadProjectFiles> {
    return inspectProject(projectDir);
  }

  async validateProjectFiles(files: KicadProjectFiles): Promise<ProjectValidation> {
    return validateProjectFiles(files);
  }

  async extractSchematicObjects(
    ctx: ExtractionContext, schematicPath: string,
  ): Promise<EngineeringObject[]> {
    const sch = await parseSchematic(schematicPath);
    return schematicToObjects(ctx, sch);
  }

  async extractPcbObjects(
    ctx: ExtractionContext, pcbPath: string,
  ): Promise<EngineeringObject[]> {
    const pcb = await parsePcb(pcbPath);
    return pcbToObjects(ctx, pcb);
  }

  async extractBom(
    ctx: ExtractionContext, schematicPath: string,
  ): Promise<{ items: BomItem[]; objects: EngineeringObject[] }> {
    const sch = await parseSchematic(schematicPath);
    const items = extractBom(sch);
    const objects = bomToObjects(ctx, schematicPath, items);
    return { items, objects };
  }

  async renderSchematic(files: KicadProjectFiles): Promise<RenderResult> {
    if (!files.schematicFile) {
      throw createLogicHubError('LH_KICAD_IMPORT_FAILED',
        'Cannot render schematic: no .kicad_sch file in project');
    }
    const caps = await this.getCapabilities();
    assertSupportedVersion(caps.metadata);
    if (!caps.render) {
      throw createLogicHubError('LH_KICAD_IMPORT_FAILED',
        'Schematic rendering requires kicad-cli with SVG export support');
    }

    const { tmpDir, cleanup } = await this.isolatedCopy(files);
    try {
      const schInTmp = join(tmpDir, files.schematicFile.slice(files.projectDir.length));
      const outputDir = join(tmpDir, 'svg-out');

      const result = await this.executor.run('kicad-cli', [
        'sch', 'export', 'svg',
        '--output', outputDir,
        schInTmp,
      ], tmpDir);

      if (result.exitCode !== 0) {
        throw createLogicHubError('LH_KICAD_IMPORT_FAILED',
          `kicad-cli sch export svg failed (exit ${result.exitCode}): ${result.stderr.slice(0, 500)}`,
          { diagnostics: { exitCode: result.exitCode } });
      }

      const svgFiles = (await readdir(outputDir)).filter(f => f.endsWith('.svg'));
      if (svgFiles.length === 0) {
        throw createLogicHubError('LH_KICAD_IMPORT_FAILED',
          'kicad-cli sch export svg produced no SVG files');
      }
      const content = await readFile(join(outputDir, svgFiles[0]!));
      return {
        filename: 'schematic.svg',
        mediaType: 'image/svg+xml',
        content,
        toolVersion: caps.metadata.versionString!,
      };
    } finally {
      await cleanup();
    }
  }

  async renderPcbLayers(
    files: KicadProjectFiles,
    layers = 'F.Cu,B.Cu,Edge.Cuts',
  ): Promise<RenderResult> {
    if (!files.pcbFile) {
      throw createLogicHubError('LH_KICAD_IMPORT_FAILED',
        'Cannot render PCB: no .kicad_pcb file in project');
    }
    const caps = await this.getCapabilities();
    assertSupportedVersion(caps.metadata);
    if (!caps.render) {
      throw createLogicHubError('LH_KICAD_IMPORT_FAILED',
        'PCB rendering requires kicad-cli with SVG export support');
    }

    const { tmpDir, cleanup } = await this.isolatedCopy(files);
    try {
      const pcbInTmp = join(tmpDir, files.pcbFile.slice(files.projectDir.length));
      const outputFile = join(tmpDir, 'pcb.svg');

      const result = await this.executor.run('kicad-cli', [
        'pcb', 'export', 'svg',
        '--output', outputFile,
        '--layers', layers,
        pcbInTmp,
      ], tmpDir);

      if (result.exitCode !== 0) {
        throw createLogicHubError('LH_KICAD_IMPORT_FAILED',
          `kicad-cli pcb export svg failed (exit ${result.exitCode}): ${result.stderr.slice(0, 500)}`,
          { diagnostics: { exitCode: result.exitCode } });
      }

      const content = await readFile(outputFile);
      return {
        filename: 'pcb.svg',
        mediaType: 'image/svg+xml',
        content,
        toolVersion: caps.metadata.versionString!,
      };
    } finally {
      await cleanup();
    }
  }

  async runErc(files: KicadProjectFiles): Promise<CheckResult> {
    if (!files.schematicFile) {
      return {
        status: 'skipped',
        diagnostics: [{ severity: 'info', message: 'No schematic file in project' }],
        report: null,
        toolVersion: null,
      };
    }
    const caps = await this.getCapabilities();
    if (!caps.metadata.available || !caps.metadata.supported) {
      return {
        status: 'skipped',
        diagnostics: [{
          severity: 'info',
          message: caps.metadata.available
            ? `KiCad ${caps.metadata.majorVersion} is not the pinned version ${caps.metadata.pinnedMajorVersion}`
            : 'kicad-cli is not available in this environment',
        }],
        report: null,
        toolVersion: caps.metadata.versionString,
      };
    }

    if (!caps.ercCli) {
      return {
        status: 'skipped',
        diagnostics: [{
          severity: 'info',
          message: 'KiCad 7 does not provide headless ERC — requires KiCad 8+',
        }],
        report: null,
        toolVersion: caps.metadata.versionString,
      };
    }

    const { tmpDir, cleanup } = await this.isolatedCopy(files);
    try {
      const schInTmp = join(tmpDir, files.schematicFile.slice(files.projectDir.length));
      const reportFile = join(tmpDir, 'erc-report.json');

      const result = await this.executor.run('kicad-cli', [
        'sch', 'erc',
        '--format', 'json',
        '--output', reportFile,
        schInTmp,
      ], tmpDir);

      let report: Buffer | null = null;
      try { report = await readFile(reportFile); } catch { /* may not exist */ }

      const diagnostics = this.parseCheckReport(report);
      return {
        status: this.inferCheckStatus(result.exitCode, diagnostics),
        diagnostics,
        report,
        toolVersion: caps.metadata.versionString!,
      };
    } finally {
      await cleanup();
    }
  }

  async runDrc(files: KicadProjectFiles): Promise<CheckResult> {
    if (!files.pcbFile) {
      return {
        status: 'skipped',
        diagnostics: [{ severity: 'info', message: 'No PCB file in project' }],
        report: null,
        toolVersion: null,
      };
    }
    const caps = await this.getCapabilities();
    if (!caps.metadata.available || !caps.metadata.supported) {
      return {
        status: 'skipped',
        diagnostics: [{
          severity: 'info',
          message: caps.metadata.available
            ? `KiCad ${caps.metadata.majorVersion} is not the pinned version ${caps.metadata.pinnedMajorVersion}`
            : 'kicad-cli is not available in this environment',
        }],
        report: null,
        toolVersion: caps.metadata.versionString,
      };
    }

    if (caps.drcPython) {
      return this.runDrcViaPython(files, caps);
    }

    if (!caps.drcCli) {
      return {
        status: 'skipped',
        diagnostics: [{
          severity: 'info',
          message: 'KiCad 7 does not provide headless DRC CLI — requires KiCad 8+ or python3 pcbnew',
        }],
        report: null,
        toolVersion: caps.metadata.versionString,
      };
    }

    const { tmpDir, cleanup } = await this.isolatedCopy(files);
    try {
      const pcbInTmp = join(tmpDir, files.pcbFile.slice(files.projectDir.length));
      const reportFile = join(tmpDir, 'drc-report.json');

      const result = await this.executor.run('kicad-cli', [
        'pcb', 'drc',
        '--format', 'json',
        '--output', reportFile,
        pcbInTmp,
      ], tmpDir);

      let report: Buffer | null = null;
      try { report = await readFile(reportFile); } catch { /* may not exist */ }

      const diagnostics = this.parseCheckReport(report);
      return {
        status: this.inferCheckStatus(result.exitCode, diagnostics),
        diagnostics,
        report,
        toolVersion: caps.metadata.versionString!,
      };
    } finally {
      await cleanup();
    }
  }

  private async runDrcViaPython(
    files: KicadProjectFiles,
    caps: ToolchainCapabilities,
  ): Promise<CheckResult> {
    const { tmpDir, cleanup } = await this.isolatedCopy(files);
    try {
      const pcbInTmp = join(tmpDir, files.pcbFile!.slice(files.projectDir.length));
      const reportFile = join(tmpDir, 'drc-report.txt');

      const script = [
        'import pcbnew, sys',
        `board = pcbnew.LoadBoard("${pcbInTmp.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`,
        `rc = pcbnew.WriteDRCReport(board, "${reportFile.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}", pcbnew.EDA_UNITS_MILLIMETRES, True)`,
        'sys.exit(0 if rc else 1)',
      ].join('\n');

      const result = await this.executor.run('python3', ['-c', script], tmpDir);

      let report: Buffer | null = null;
      try { report = await readFile(reportFile); } catch { /* may not exist */ }

      const diagnostics = this.parseDrcTextReport(report);
      return {
        status: this.inferCheckStatus(result.exitCode, diagnostics),
        diagnostics,
        report,
        toolVersion: caps.metadata.versionString!,
      };
    } finally {
      await cleanup();
    }
  }

  async collectDiagnostics(files: KicadProjectFiles): Promise<FileDiagnostic[]> {
    const validation = await this.validateProjectFiles(files);
    const all: FileDiagnostic[] = [...validation.diagnostics];

    const erc = await this.runErc(files);
    all.push(...erc.diagnostics);

    const drc = await this.runDrc(files);
    all.push(...drc.diagnostics);

    return all;
  }

  async collectToolMetadata(): Promise<ToolMetadata> {
    return collectToolMetadata(this.executor);
  }

  getAuditLog(): readonly import('./kicad-executor.js').ToolCommandAudit[] {
    return this.executor.getAuditLog();
  }

  private async getCapabilities(): Promise<ToolchainCapabilities> {
    if (!this.cachedCapabilities) {
      this.cachedCapabilities = await detectCapabilities(this.executor);
    }
    return this.cachedCapabilities;
  }

  private async isolatedCopy(
    files: KicadProjectFiles,
  ): Promise<{ tmpDir: string; cleanup: () => Promise<void> }> {
    const tmpDir = await mkdtemp(join(tmpdir(), 'logichub-kicad-'));
    const destDir = join(tmpDir, 'project');
    await cp(files.projectDir, destDir, { recursive: true });
    return {
      tmpDir: destDir,
      cleanup: async () => { await rm(tmpDir, { recursive: true, force: true }); },
    };
  }

  private parseCheckReport(report: Buffer | null): FileDiagnostic[] {
    if (!report) return [];
    try {
      const json = JSON.parse(report.toString('utf-8'));
      const diagnostics: FileDiagnostic[] = [];
      for (const violation of json.violations ?? json.errors ?? []) {
        diagnostics.push({
          severity: violation.severity === 'error' ? 'error' : 'warning',
          message: violation.description ?? violation.message ?? String(violation),
          code: violation.type ?? undefined,
          location: violation.pos ?? undefined,
        });
      }
      return diagnostics;
    } catch {
      return [{ severity: 'info', message: 'Check report was not parseable as JSON' }];
    }
  }

  private parseDrcTextReport(report: Buffer | null): FileDiagnostic[] {
    if (!report) return [];
    const text = report.toString('utf-8');
    const diagnostics: FileDiagnostic[] = [];
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.includes(']:')) {
        const bracketEnd = trimmed.indexOf(']:');
        const code = trimmed.slice(1, bracketEnd);
        const message = trimmed.slice(bracketEnd + 3).trim();
        diagnostics.push({
          severity: code.startsWith('error') ? 'error' : 'warning',
          message,
          code,
        });
      }
    }
    return diagnostics;
  }

  private inferCheckStatus(
    exitCode: number, diagnostics: FileDiagnostic[],
  ): 'pass' | 'warning' | 'fail' | 'error' {
    if (exitCode !== 0) {
      return diagnostics.some(d => d.severity === 'error') ? 'fail' : 'error';
    }
    return diagnostics.some(d => d.severity === 'error')
      ? 'fail'
      : diagnostics.some(d => d.severity === 'warning') ? 'warning' : 'pass';
  }
}
