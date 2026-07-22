import type { GraphEdge } from './types.js';
import type { SoftwareFileSurface } from '../types.js';
import { sha256Hex } from '../util/hash.js';
import { jcsCanonicalize } from '../util/jcs.js';

export function generateSoftwareEdges(surfaces: SoftwareFileSurface[]): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const exportIndex = buildExportIndex(surfaces);

  for (const surface of surfaces) {
    const moduleId = `software::${surface.path}`;

    for (const exp of surface.exportedSymbols) {
      edges.push(makeEdge(moduleId, 'EXPORTS', exp.semanticId, 'direct', 'exact_ast_reference', {
        sourcePath: surface.path,
        semanticLocator: `export::${exp.name}`,
      }));
    }

    for (const imp of surface.imports) {
      const resolvedModule = resolveImportSource(surface.path, imp.source);
      const targetModuleId = resolvedModule ? `software::${resolvedModule}` : `external::${imp.source}`;
      const resolution = imp.isRelative ? 'direct' : 'declared';
      const basis = imp.isRelative ? 'exact_ast_reference' : 'explicit_manifest';

      edges.push(makeEdge(moduleId, 'IMPORTS', targetModuleId, resolution, basis, {
        sourcePath: surface.path,
        semanticLocator: `import::${imp.source}`,
      }));

      if (imp.isRelative && !imp.isDynamic) {
        for (const spec of imp.specifiers) {
          const cleanSpec = spec.replace(/\s+as\s+\w+/, '').trim();
          if (cleanSpec.startsWith('* as ')) continue;
          const targetSymbol = exportIndex.get(`${resolvedModule}::${cleanSpec}`);
          if (targetSymbol) {
            edges.push(makeEdge(moduleId, 'CALLS', targetSymbol, 'member_resolved', 'exact_ast_reference', {
              sourcePath: surface.path,
              semanticLocator: `import::${imp.source}::${cleanSpec}`,
            }));
          }
        }
      }
    }

    for (const ep of surface.entryPoints) {
      edges.push(makeEdge(`entry::${ep.normalizedPath}`, 'DECLARES', moduleId, 'direct', 'exact_ast_reference', {
        sourcePath: surface.path,
        semanticLocator: `entry_point`,
      }));
    }
  }

  return edges;
}

function buildExportIndex(surfaces: SoftwareFileSurface[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const surface of surfaces) {
    for (const exp of surface.exportedSymbols) {
      index.set(`${surface.path}::${exp.name}`, exp.semanticId);
    }
  }
  return index;
}

function resolveImportSource(importerPath: string, source: string): string | null {
  if (!source.startsWith('.')) return null;

  const importerDir = importerPath.split('/').slice(0, -1).join('/');
  const parts = source.split('/');
  const resolved: string[] = importerDir ? importerDir.split('/') : [];

  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') { resolved.pop(); continue; }
    resolved.push(part);
  }

  let resolvedPath = resolved.join('/');
  resolvedPath = resolvedPath.replace(/\.js$/, '.ts').replace(/\.mjs$/, '.ts');
  if (!resolvedPath.includes('.')) {
    resolvedPath += '.ts';
  }
  return resolvedPath;
}

function makeEdge(
  from: string, type: GraphEdge['type'], to: string,
  resolution: GraphEdge['resolution'],
  confidenceBasis: GraphEdge['confidenceBasis'],
  evidence: GraphEdge['evidence'],
): GraphEdge {
  const edgeId = sha256Hex(jcsCanonicalize({
    from, type, to, resolution,
    normalizedEvidenceIdentity: evidence.semanticLocator,
  }));

  return {
    edgeId,
    from,
    type,
    to,
    resolution,
    confidenceBasis,
    domain: 'software',
    evidence,
  };
}
