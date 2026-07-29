import type {
  SoftwareFileSurface, ExportedSymbol, ImportRecord, EntryPoint,
} from '../types.js';
import { sha256Hex } from '../util/hash.js';
import { sortByKeys, sortStrings } from '../util/deterministic.js';

const ASSERTION_PATTERNS = [
  /\bassert\s*[.(]/,
  /\bexpect\s*\(/,
  /\bit\s*\(/,
  /\btest\s*\(/,
  /\bdescribe\s*\(/,
  /\bassertEquals?\s*\(/,
  /\bassertTrue\s*\(/,
  /\bassertFalse\s*\(/,
  /\bASSERT/,
  /\bstatic_assert\s*\(/,
];

const ENTRY_POINT_FILES = new Set([
  'main.ts', 'main.js', 'index.ts', 'index.js', 'mod.ts',
  'app.ts', 'app.js', 'server.ts', 'server.js',
  'main.c', 'main.cpp', 'main.py', '__main__.py',
  'setup.py', 'main.ino',
]);

export function extractSoftwareSurface(
  path: string, content: string, language: string,
): SoftwareFileSurface {
  const lines = content.split('\n');
  const exports = extractExports(content, language, path);
  const imports = extractImports(content, language);
  const assertionCount = countAssertions(lines);
  const bodyHash = sha256Hex(normalizeBody(content));
  const alphaNormalized = alphaNormalizeBody(content, language);
  const alphaNormalizedBodyHash = sha256Hex(alphaNormalized);
  const basename = path.split('/').pop() ?? '';

  const entryPoints: EntryPoint[] = [];
  if (ENTRY_POINT_FILES.has(basename)) {
    entryPoints.push({
      domain: language === 'c' || language === 'cpp' || language === 'arduino' ? 'firmware' : 'software',
      sourceType: language,
      normalizedPath: path,
      semanticId: `entry::${path}`,
    });
  }

  const namedNodes = countNamedAstNodes(content, language);
  const totalLines = lines.length;
  const densityBp = totalLines > 0
    ? Math.floor((assertionCount * 10000) / totalLines)
    : 0;

  return {
    path,
    language,
    primaryLanguage: language,
    secondaryLanguages: [],
    namedAstNodeCount: namedNodes,
    fileCount: 1,
    byteCount: Buffer.byteLength(content, 'utf-8'),
    entryPoints: sortByKeys(entryPoints, [e => e.domain, e => e.normalizedPath]),
    exportedSymbols: sortByKeys(exports, [
      e => e.kind,
      e => e.name,
      e => e.semanticId,
    ]),
    normalizedSignatures: sortStrings(exports.map(e => e.normalizedSignature)),
    bodyHash,
    alphaNormalizedBodyHash,
    imports: sortByKeys(imports, [i => i.source]),
    assertionSiteCount: assertionCount,
    exportedSymbolCount: exports.length,
    assertionDensityBasisPoints: densityBp,
  };
}

function extractExports(content: string, language: string, path: string): ExportedSymbol[] {
  const exports: ExportedSymbol[] = [];

  if (language === 'typescript' || language === 'javascript') {
    extractTsJsExports(content, path, exports);
  } else if (language === 'python') {
    extractPythonExports(content, path, exports);
  } else if (language === 'c' || language === 'cpp' || language === 'arduino') {
    extractCCppExports(content, path, exports);
  }

  return exports;
}

function extractTsJsExports(content: string, path: string, out: ExportedSymbol[]): void {
  const exportFnRe = /export\s+(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*([^\s{]+))?\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = exportFnRe.exec(content)) !== null) {
    const name = match[1];
    const params = normalizeParams(match[2]);
    const ret = match[3]?.trim() ?? 'void';
    const body = extractFunctionBody(content, match.index + match[0].length - 1);
    out.push({
      semanticId: `software::${path}::export::${name}`,
      name,
      kind: 'function',
      normalizedSignature: `function ${name}(${params}): ${ret}`,
      bodyHash: sha256Hex(normalizeBody(body)),
      alphaNormalizedBodyHash: sha256Hex(alphaNormalizeBody(body, 'typescript')),
    });
  }

  const exportClassRe = /export\s+(?:abstract\s+)?class\s+(\w+)(?:\s+(?:extends|implements)\s+[^{]*)?\s*\{/g;
  while ((match = exportClassRe.exec(content)) !== null) {
    const name = match[1];
    const body = extractFunctionBody(content, match.index + match[0].length - 1);
    out.push({
      semanticId: `software::${path}::export::${name}`,
      name,
      kind: 'class',
      normalizedSignature: `class ${name}`,
      bodyHash: sha256Hex(normalizeBody(body)),
      alphaNormalizedBodyHash: sha256Hex(alphaNormalizeBody(body, 'typescript')),
    });
  }

  const exportConstRe = /export\s+(?:const|let|var)\s+(\w+)\s*(?::\s*([^=]+))?\s*=/g;
  while ((match = exportConstRe.exec(content)) !== null) {
    const name = match[1];
    const type = match[2]?.trim() ?? 'unknown';
    out.push({
      semanticId: `software::${path}::export::${name}`,
      name,
      kind: 'const',
      normalizedSignature: `const ${name}: ${type}`,
      bodyHash: sha256Hex(name),
      alphaNormalizedBodyHash: sha256Hex(name),
    });
  }

  const exportTypeRe = /export\s+(type|interface)\s+(\w+)/g;
  while ((match = exportTypeRe.exec(content)) !== null) {
    const keyword = match[1] as 'type' | 'interface';
    const name = match[2];
    out.push({
      semanticId: `software::${path}::export::${name}`,
      name,
      kind: keyword,
      normalizedSignature: `${keyword} ${name}`,
      bodyHash: sha256Hex(name),
      alphaNormalizedBodyHash: sha256Hex(name),
    });
  }

  const exportEnumRe = /export\s+(?:const\s+)?enum\s+(\w+)/g;
  while ((match = exportEnumRe.exec(content)) !== null) {
    const name = match[1];
    out.push({
      semanticId: `software::${path}::export::${name}`,
      name,
      kind: 'enum',
      normalizedSignature: `enum ${name}`,
      bodyHash: sha256Hex(name),
      alphaNormalizedBodyHash: sha256Hex(name),
    });
  }
}

function extractPythonExports(content: string, path: string, out: ExportedSymbol[]): void {
  const defRe = /^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(\S+))?\s*:/gm;
  let match: RegExpExecArray | null;
  while ((match = defRe.exec(content)) !== null) {
    const name = match[1];
    if (name.startsWith('_')) continue;
    const params = normalizeParams(match[2]);
    const ret = match[3] ?? 'None';
    out.push({
      semanticId: `software::${path}::export::${name}`,
      name,
      kind: 'function',
      normalizedSignature: `def ${name}(${params}) -> ${ret}`,
      bodyHash: sha256Hex(name),
      alphaNormalizedBodyHash: sha256Hex(name),
    });
  }

  const classRe = /^class\s+(\w+)(?:\([^)]*\))?\s*:/gm;
  while ((match = classRe.exec(content)) !== null) {
    const name = match[1];
    if (name.startsWith('_')) continue;
    out.push({
      semanticId: `software::${path}::export::${name}`,
      name,
      kind: 'class',
      normalizedSignature: `class ${name}`,
      bodyHash: sha256Hex(name),
      alphaNormalizedBodyHash: sha256Hex(name),
    });
  }
}

function extractCCppExports(content: string, path: string, out: ExportedSymbol[]): void {
  const fnRe = /^(?:extern\s+(?:"C"\s+)?)?(?:static\s+)?(?:inline\s+)?(?:const\s+)?(?:unsigned\s+)?(\w[\w*&\s]*?)\s+(\w+)\s*\(([^)]*)\)\s*(?:const\s*)?(?:noexcept\s*)?[{;]/gm;
  let match: RegExpExecArray | null;
  while ((match = fnRe.exec(content)) !== null) {
    const retType = match[1].trim();
    const name = match[2];
    if (name.startsWith('_') || ['if', 'for', 'while', 'switch', 'return', 'sizeof', 'typeof', 'alignof'].includes(name)) continue;
    const params = normalizeParams(match[3]);
    out.push({
      semanticId: `firmware::${path}::symbol::${name}`,
      name,
      kind: 'function',
      normalizedSignature: `${retType} ${name}(${params})`,
      bodyHash: sha256Hex(name),
      alphaNormalizedBodyHash: sha256Hex(name),
    });
  }
}

function extractImports(content: string, language: string): ImportRecord[] {
  const imports: ImportRecord[] = [];

  if (language === 'typescript' || language === 'javascript') {
    const importRe = /import\s+(?:type\s+)?(?:\{([^}]*)\}|(\w+)|\*\s+as\s+(\w+))(?:\s*,\s*(?:\{([^}]*)\}|(\w+)))?\s+from\s+['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = importRe.exec(content)) !== null) {
      const source = match[6];
      const specifiers: string[] = [];
      if (match[1]) specifiers.push(...match[1].split(',').map(s => s.trim()).filter(Boolean));
      if (match[2]) specifiers.push(match[2]);
      if (match[3]) specifiers.push(`* as ${match[3]}`);
      if (match[4]) specifiers.push(...match[4].split(',').map(s => s.trim()).filter(Boolean));
      if (match[5]) specifiers.push(match[5]);
      imports.push({
        source,
        specifiers: sortStrings(specifiers),
        isRelative: source.startsWith('.'),
        isDynamic: false,
      });
    }

    const dynamicRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicRe.exec(content)) !== null) {
      imports.push({
        source: match[1],
        specifiers: [],
        isRelative: match[1].startsWith('.'),
        isDynamic: true,
      });
    }
  } else if (language === 'python') {
    const fromImportRe = /^from\s+(\S+)\s+import\s+(.+)$/gm;
    let match: RegExpExecArray | null;
    while ((match = fromImportRe.exec(content)) !== null) {
      imports.push({
        source: match[1],
        specifiers: sortStrings(match[2].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)),
        isRelative: match[1].startsWith('.'),
        isDynamic: false,
      });
    }
    const importRe = /^import\s+(\S+)(?:\s+as\s+\S+)?$/gm;
    while ((match = importRe.exec(content)) !== null) {
      if (match[0].startsWith('import(')) continue;
      imports.push({
        source: match[1],
        specifiers: [match[1].split('.').pop()!],
        isRelative: false,
        isDynamic: false,
      });
    }
  } else if (language === 'c' || language === 'cpp' || language === 'arduino') {
    const includeRe = /^#include\s+[<"]([^>"]+)[>"]/gm;
    let match: RegExpExecArray | null;
    while ((match = includeRe.exec(content)) !== null) {
      imports.push({
        source: match[1],
        specifiers: [],
        isRelative: !match[0].includes('<'),
        isDynamic: false,
      });
    }
  }

  return imports;
}

function countAssertions(lines: string[]): number {
  let count = 0;
  for (const line of lines) {
    for (const pattern of ASSERTION_PATTERNS) {
      if (pattern.test(line)) {
        count++;
        break;
      }
    }
  }
  return count;
}

function countNamedAstNodes(content: string, language: string): number {
  let count = 0;
  if (language === 'typescript' || language === 'javascript') {
    count += (content.match(/\bfunction\s+\w+/g) ?? []).length;
    count += (content.match(/\bclass\s+\w+/g) ?? []).length;
    count += (content.match(/\b(?:const|let|var)\s+\w+/g) ?? []).length;
    count += (content.match(/\b(?:type|interface)\s+\w+/g) ?? []).length;
    count += (content.match(/\benum\s+\w+/g) ?? []).length;
    count += (content.match(/\bimport\s/g) ?? []).length;
    count += (content.match(/\bexport\s/g) ?? []).length;
  } else if (language === 'python') {
    count += (content.match(/\bdef\s+\w+/g) ?? []).length;
    count += (content.match(/\bclass\s+\w+/g) ?? []).length;
    count += (content.match(/\bimport\s/g) ?? []).length;
    count += (content.match(/\bfrom\s+\S+\s+import/g) ?? []).length;
  } else if (language === 'c' || language === 'cpp' || language === 'arduino') {
    count += (content.match(/\w+\s+\w+\s*\([^)]*\)\s*[{;]/g) ?? []).length;
    count += (content.match(/#include/g) ?? []).length;
    count += (content.match(/#define\s+\w+/g) ?? []).length;
    count += (content.match(/\bstruct\s+\w+/g) ?? []).length;
    count += (content.match(/\btypedef\s/g) ?? []).length;
  }
  return count;
}

function normalizeBody(body: string): string {
  return body
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/#.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function alphaNormalizeBody(body: string, language: string): string {
  let normalized = normalizeBody(body);
  if (language === 'typescript' || language === 'javascript') {
    normalized = normalized
      .replace(/\b(?:const|let|var)\s+(\w+)/g, (_, name) => `const $${name.length}`)
      .replace(/\bfunction\s+(\w+)/g, (_, name) => `function $${name.length}`);
  }
  return normalized;
}

function normalizeParams(params: string): string {
  return params
    .split(',')
    .map(p => p.trim())
    .filter(Boolean)
    .join(', ');
}

function extractFunctionBody(content: string, openBraceIdx: number): string {
  let depth = 0;
  let i = openBraceIdx;
  while (i < content.length) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) return content.slice(openBraceIdx, i + 1);
    }
    i++;
  }
  return content.slice(openBraceIdx);
}
