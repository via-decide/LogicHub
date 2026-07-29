import { createLogicHubError } from '@logichub-engineering/shared';
import type { ToolExecutor } from './kicad-executor.js';
import type { ToolMetadata } from './types.js';

/** KiCad major versions this adapter supports. */
export const SUPPORTED_KICAD_VERSIONS = [7, 8] as const;
/** @deprecated Use SUPPORTED_KICAD_VERSIONS — kept for backward-compatible ToolMetadata fields. */
export const PINNED_KICAD_MAJOR = 8;

export interface ToolchainCapabilities {
  metadata: ToolMetadata;
  /** kicad-cli sch/pcb export svg (KiCad >= 7). */
  render: boolean;
  /** kicad-cli sch erc (KiCad >= 8 only — no headless ERC exists in 7). */
  ercCli: boolean;
  /** kicad-cli pcb drc (KiCad >= 8). */
  drcCli: boolean;
  /** python3 pcbnew.WriteDRCReport (KiCad 7 fallback for real DRC). */
  drcPython: boolean;
}

export async function collectToolMetadata(executor: ToolExecutor): Promise<ToolMetadata> {
  const result = await executor.run('kicad-cli', ['version'], process.cwd());
  if (result.exitCode !== 0) {
    return {
      tool: 'kicad-cli',
      available: false,
      versionString: null,
      majorVersion: null,
      pinnedMajorVersion: PINNED_KICAD_MAJOR,
      supported: false,
    };
  }
  const versionString = result.stdout.trim();
  const major = Number.parseInt(versionString.split('.')[0] ?? '', 10);
  const majorVersion = Number.isNaN(major) ? null : major;
  return {
    tool: 'kicad-cli',
    available: true,
    versionString,
    majorVersion,
    pinnedMajorVersion: PINNED_KICAD_MAJOR,
    supported: majorVersion !== null && (SUPPORTED_KICAD_VERSIONS as readonly number[]).includes(majorVersion),
  };
}

export async function detectCapabilities(executor: ToolExecutor): Promise<ToolchainCapabilities> {
  const metadata = await collectToolMetadata(executor);
  const major = metadata.majorVersion ?? 0;

  let drcPython = false;
  if (metadata.available) {
    const py = await executor.run('python3', ['-c', 'import pcbnew; print(pcbnew.Version())'], process.cwd());
    drcPython = py.exitCode === 0;
  }

  return {
    metadata,
    render: metadata.available && major >= 7,
    ercCli: metadata.available && major >= 8,
    drcCli: metadata.available && major >= 8,
    drcPython,
  };
}

export function assertSupportedVersion(metadata: ToolMetadata): void {
  if (!metadata.available) {
    throw createLogicHubError('LH_KICAD_VERSION_UNSUPPORTED',
      'kicad-cli is not available in this environment',
      { diagnostics: { supportedVersions: [...SUPPORTED_KICAD_VERSIONS] } });
  }
  if (!metadata.supported) {
    throw createLogicHubError('LH_KICAD_VERSION_UNSUPPORTED',
      `KiCad major version ${metadata.majorVersion} is not in the supported range [${SUPPORTED_KICAD_VERSIONS.join(', ')}]`,
      { diagnostics: { detected: metadata.versionString, supportedVersions: [...SUPPORTED_KICAD_VERSIONS] } });
  }
}
