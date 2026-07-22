import { describe, it, expect } from 'vitest';
import { ToolExecutor } from '../src/kicad-executor.js';
import {
  collectToolMetadata, detectCapabilities, assertSupportedVersion,
  PINNED_KICAD_MAJOR,
} from '../src/toolchain.js';

describe('collectToolMetadata', () => {
  it('returns available=false when kicad-cli is not found', async () => {
    const executor = new ToolExecutor();
    const fakeExec = new ToolExecutor();
    const originalRun = fakeExec.run.bind(fakeExec);
    fakeExec.run = async (cmd, args, cwd) => {
      if (cmd === 'kicad-cli') {
        return { exitCode: 127, stdout: '', stderr: 'spawn failed: ENOENT' };
      }
      return originalRun(cmd, args, cwd);
    };

    const meta = await collectToolMetadata(fakeExec);
    expect(meta.available).toBe(false);
    expect(meta.supported).toBe(false);
    expect(meta.versionString).toBeNull();
    expect(meta.majorVersion).toBeNull();
    expect(meta.pinnedMajorVersion).toBe(PINNED_KICAD_MAJOR);
  });

  it('parses version from real kicad-cli if available', async () => {
    const executor = new ToolExecutor();
    const meta = await collectToolMetadata(executor);
    if (meta.available) {
      expect(meta.versionString).toBeTruthy();
      expect(meta.majorVersion).toBe(7);
      expect(meta.supported).toBe(true);
    }
  });

  it('reports pinned major version', async () => {
    expect(PINNED_KICAD_MAJOR).toBe(7);
  });
});

describe('assertSupportedVersion', () => {
  it('throws for unavailable toolchain', () => {
    expect(() => assertSupportedVersion({
      tool: 'kicad-cli',
      available: false,
      versionString: null,
      majorVersion: null,
      pinnedMajorVersion: 7,
      supported: false,
    })).toThrow(/not available/i);
  });

  it('throws for wrong major version', () => {
    expect(() => assertSupportedVersion({
      tool: 'kicad-cli',
      available: true,
      versionString: '8.0.0',
      majorVersion: 8,
      pinnedMajorVersion: 7,
      supported: false,
    })).toThrow(/not the pinned version/i);
  });

  it('does not throw for correct version', () => {
    expect(() => assertSupportedVersion({
      tool: 'kicad-cli',
      available: true,
      versionString: '7.0.11',
      majorVersion: 7,
      pinnedMajorVersion: 7,
      supported: true,
    })).not.toThrow();
  });
});

describe('detectCapabilities', () => {
  it('detects capabilities from real toolchain', async () => {
    const executor = new ToolExecutor();
    const caps = await detectCapabilities(executor);
    if (caps.metadata.available) {
      expect(caps.render).toBe(true);
      expect(caps.ercCli).toBe(false);
      expect(caps.drcCli).toBe(false);
    } else {
      expect(caps.render).toBe(false);
      expect(caps.ercCli).toBe(false);
      expect(caps.drcCli).toBe(false);
      expect(caps.drcPython).toBe(false);
    }
  });
});
