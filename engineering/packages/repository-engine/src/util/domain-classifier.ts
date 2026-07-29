import type { DomainClass, FileClassification } from '../types.js';

const SOFTWARE_EXTENSIONS: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.pyw': 'python',
  '.pyi': 'python',
};

const FIRMWARE_EXTENSIONS: Record<string, string> = {
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.hpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hxx': 'cpp',
  '.ino': 'arduino',
};

const ELECTRONICS_EXTENSIONS = new Set([
  '.kicad_pro',
  '.kicad_sch',
  '.kicad_pcb',
  '.kicad_sym',
  '.kicad_mod',
  '.kicad_dru',
  '.kicad_wks',
  '.sch',
  '.brd',
  '.lib',
]);

const BOM_EXTENSIONS = new Set(['.csv', '.tsv']);

const CONFIG_EXTENSIONS = new Set([
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.cfg',
  '.env',
  '.properties',
]);

const DOC_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.rst',
  '.adoc',
  '.html',
  '.pdf',
]);

const BUILD_EXTENSIONS = new Set([
  '.cmake',
  '.make',
  '.mk',
]);

const BUILD_FILES = new Set([
  'Makefile',
  'CMakeLists.txt',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
]);

const VENDOR_DIRS = new Set([
  'node_modules',
  'vendor',
  '.yarn',
  'bower_components',
  '__pycache__',
  '.venv',
  'venv',
]);

const TEST_PATTERNS = [
  /\/__tests__\//,
  /\/test\//,
  /\/tests\//,
  /\/spec\//,
  /\.test\./,
  /\.spec\./,
  /_test\./,
  /_spec\./,
];

const GENERATED_PATTERNS = [
  /\/dist\//,
  /\/build\//,
  /\/out\//,
  /\/generated\//,
  /\.d\.ts$/,
  /\.min\./,
  /\.bundle\./,
  /\.map$/,
  /lock\.json$/,
  /lock\.yaml$/,
  /pnpm-lock/,
  /package-lock/,
  /yarn\.lock/,
];

export function classifyDomain(path: string): DomainClass {
  const ext = getExtension(path);
  const basename = getBasename(path);

  if (isConstraintFile(path)) return 'constraint';
  if (isDecisionFile(path)) return 'decision';
  if (isBomFile(path)) return 'bom';
  if (ELECTRONICS_EXTENSIONS.has(ext)) return 'electronics';
  if (SOFTWARE_EXTENSIONS[ext]) return 'software';
  if (FIRMWARE_EXTENSIONS[ext]) return 'firmware';
  if (DOC_EXTENSIONS.has(ext)) return 'documentation';
  if (BUILD_EXTENSIONS.has(ext) || BUILD_FILES.has(basename)) return 'build';
  if (CONFIG_EXTENSIONS.has(ext)) return 'configuration';

  return 'unknown';
}

export function classifyFile(path: string): FileClassification {
  const parts = path.split('/');
  for (const part of parts) {
    if (VENDOR_DIRS.has(part)) return 'vendor';
  }
  for (const pattern of GENERATED_PATTERNS) {
    if (pattern.test(path)) return 'generated';
  }
  for (const pattern of TEST_PATTERNS) {
    if (pattern.test(path)) return 'test';
  }
  return 'source';
}

export function getLanguage(path: string): string | null {
  const ext = getExtension(path);
  return SOFTWARE_EXTENSIONS[ext] ?? FIRMWARE_EXTENSIONS[ext] ?? null;
}

export function isSoftwareFile(path: string): boolean {
  const ext = getExtension(path);
  return ext in SOFTWARE_EXTENSIONS || ext in FIRMWARE_EXTENSIONS;
}

export function isElectronicsFile(path: string): boolean {
  return ELECTRONICS_EXTENSIONS.has(getExtension(path));
}

export function isConstraintFile(path: string): boolean {
  return path.endsWith('.constraints.json') || path.includes('/constraints/') || path.startsWith('constraints/');
}

export function isDecisionFile(path: string): boolean {
  return (path.includes('/decisions/') || path.startsWith('decisions/')) && path.endsWith('.json');
}

export function isBomFile(path: string): boolean {
  const lower = path.toLowerCase();
  const basename = getBasename(lower);
  return (basename.includes('bom') && BOM_EXTENSIONS.has(getExtension(path))) ||
    path.endsWith('.bom.json') || path.endsWith('.bom.csv');
}

export function getParserProfile(path: string, language: string | null): string {
  if (language) return `tree-sitter-${language}`;
  const ext = getExtension(path);
  if (ELECTRONICS_EXTENSIONS.has(ext)) return 'kicad-sexpr-v7';
  if (ext === '.json') return 'json-native';
  if (ext === '.csv' || ext === '.tsv') return 'csv-native';
  return 'none';
}

function getExtension(path: string): string {
  const basename = path.split('/').pop() ?? '';
  const parts = basename.split('.');
  if (parts.length <= 1) return '';
  if (parts.length > 2 && parts[parts.length - 2] === 'kicad') {
    return '.' + parts.slice(-2).join('.');
  }
  return '.' + parts[parts.length - 1];
}

function getBasename(path: string): string {
  return path.split('/').pop() ?? '';
}
