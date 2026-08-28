import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitRepository } from '@logichub-engineering/git-adapter';
import { KicadAdapter, type KicadProjectFiles } from '@logichub-engineering/kicad-adapter';

export interface VisualDiffSide {
  status: 'available' | 'skipped';
  render?: { filename: string; mediaType: string; contentBase64: string; toolVersion: string };
  reason?: string;
}

export interface VisualDiffPane {
  base: VisualDiffSide;
  proposed: VisualDiffSide;
}

export interface VisualDiffResult {
  schematic: VisualDiffPane;
  pcb: VisualDiffPane;
}

export interface RevisionRenderTarget {
  /** Local path to the git repo the revision was imported from. */
  repoPath: string;
  gitCommitSha: string;
}

/**
 * Side-by-side rendered-SVG visual diff (v1 bar per master spec section 3.1
 * — no pixel-level image diffing). renderSchematic/renderPcbLayers throw
 * when kicad-cli is unavailable or the file is missing; that's normalized
 * here into the same honest `status: 'skipped'` convention kicad-adapter
 * already uses for ERC/DRC, rather than letting the tab silently disappear
 * or fabricating a render.
 */
export class VisualDiffService {
  private readonly kicad: KicadAdapter;

  constructor(kicad?: KicadAdapter) {
    this.kicad = kicad ?? new KicadAdapter();
  }

  async compare(base: RevisionRenderTarget, proposed: RevisionRenderTarget): Promise<VisualDiffResult> {
    const [baseSide, proposedSide] = await Promise.all([
      this.renderRevision(base),
      this.renderRevision(proposed),
    ]);
    return {
      schematic: { base: baseSide.schematic, proposed: proposedSide.schematic },
      pcb: { base: baseSide.pcb, proposed: proposedSide.pcb },
    };
  }

  private async renderRevision(
    target: RevisionRenderTarget
  ): Promise<{ schematic: VisualDiffSide; pcb: VisualDiffSide }> {
    const git = await GitRepository.open(target.repoPath);
    const workDir = await mkdtemp(join(tmpdir(), 'logichub-visual-diff-'));
    try {
      await git.restoreWorkingTree(target.gitCommitSha, workDir);
      const files = await this.kicad.inspectProject(workDir);

      const [schematic, pcb] = await Promise.all([
        this.renderOne(files, Boolean(files.schematicFile), () => this.kicad.renderSchematic(files)),
        this.renderOne(files, Boolean(files.pcbFile), () => this.kicad.renderPcbLayers(files)),
      ]);
      return { schematic, pcb };
    } finally {
      await git.removeWorkingTree(workDir).catch(() => undefined);
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async renderOne(
    _files: KicadProjectFiles,
    hasFile: boolean,
    render: () => Promise<{ filename: string; mediaType: string; content: Buffer; toolVersion: string }>
  ): Promise<VisualDiffSide> {
    if (!hasFile) {
      return { status: 'skipped', reason: 'This revision has no corresponding KiCad file.' };
    }
    try {
      const result = await render();
      return {
        status: 'available',
        render: {
          filename: result.filename,
          mediaType: result.mediaType,
          contentBase64: result.content.toString('base64'),
          toolVersion: result.toolVersion,
        },
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { status: 'skipped', reason: `Render unavailable: ${reason}` };
    }
  }
}
