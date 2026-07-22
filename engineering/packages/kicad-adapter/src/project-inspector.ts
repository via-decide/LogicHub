import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { createLogicHubError } from '@logichub-engineering/shared';
import { parseKicadFile } from './sexpr/parser.js';
import type { FileDiagnostic, KicadProjectFiles, ProjectValidation } from './types.js';

/**
 * Locate the KiCad project files in a directory. Read-only: this never
 * writes into the source directory.
 */
export async function inspectProject(projectDir: string): Promise<KicadProjectFiles> {
  let entries: string[];
  try {
    entries = await readdir(projectDir);
  } catch {
    throw createLogicHubError('LH_KICAD_PROJECT_INVALID',
      `Project directory does not exist or is unreadable: '${projectDir}'`,
      { diagnostics: { projectDir } });
  }

  const proFiles = entries.filter(e => e.endsWith('.kicad_pro'));
  if (proFiles.length === 0) {
    throw createLogicHubError('LH_KICAD_PROJECT_INVALID',
      `No .kicad_pro file found in '${projectDir}'`,
      { diagnostics: { projectDir, entries } });
  }
  if (proFiles.length > 1) {
    throw createLogicHubError('LH_KICAD_PROJECT_INVALID',
      `Multiple .kicad_pro files found in '${projectDir}'`,
      { diagnostics: { projectDir, proFiles } });
  }

  const proFile = proFiles[0]!;
  const projectName = basename(proFile, '.kicad_pro');
  const schematicFile = entries.includes(`${projectName}.kicad_sch`) ? `${projectName}.kicad_sch` : null;
  const pcbFile = entries.includes(`${projectName}.kicad_pcb`) ? `${projectName}.kicad_pcb` : null;

  return {
    projectDir,
    proFile: join(projectDir, proFile),
    schematicFile: schematicFile ? join(projectDir, schematicFile) : null,
    pcbFile: pcbFile ? join(projectDir, pcbFile) : null,
    projectName,
  };
}

/**
 * Parse-check every project file and collect diagnostics. Structural
 * failures are reported as diagnostics, not thrown, so callers can record
 * a complete validation result.
 */
export async function validateProjectFiles(files: KicadProjectFiles): Promise<ProjectValidation> {
  const diagnostics: FileDiagnostic[] = [];

  try {
    const proRaw = await readFile(files.proFile, 'utf-8');
    JSON.parse(proRaw);
  } catch (err) {
    diagnostics.push({
      severity: 'error',
      message: `Invalid .kicad_pro (not valid JSON): ${(err as Error).message}`,
      code: 'LH_KICAD_PROJECT_INVALID',
      location: files.proFile,
    });
  }

  if (files.schematicFile) {
    try {
      const raw = await readFile(files.schematicFile, 'utf-8');
      parseKicadFile(raw, 'kicad_sch');
    } catch (err) {
      diagnostics.push({
        severity: 'error',
        message: `Invalid schematic: ${(err as Error).message}`,
        code: 'LH_KICAD_PROJECT_INVALID',
        location: files.schematicFile,
      });
    }
  } else {
    diagnostics.push({
      severity: 'warning',
      message: 'Project has no schematic file',
      location: files.projectDir,
    });
  }

  if (files.pcbFile) {
    try {
      const raw = await readFile(files.pcbFile, 'utf-8');
      parseKicadFile(raw, 'kicad_pcb');
    } catch (err) {
      diagnostics.push({
        severity: 'error',
        message: `Invalid PCB: ${(err as Error).message}`,
        code: 'LH_KICAD_PROJECT_INVALID',
        location: files.pcbFile,
      });
    }
  } else {
    diagnostics.push({
      severity: 'warning',
      message: 'Project has no PCB file',
      location: files.projectDir,
    });
  }

  return {
    valid: diagnostics.every(d => d.severity !== 'error'),
    diagnostics,
  };
}
