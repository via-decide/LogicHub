#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildGraphMap, edgesToNdjson } from '../graphmap/graphmap.js';
import { jcsCanonicalize } from '../util/jcs.js';
import type { FingerprintDescriptor } from '../types.js';

interface CliArgs {
  repo: string;
  tree: string;
  fingerprint: string;
  emit: string | null;
  condense: string | null;
  manifest: string | null;
  minConfidence: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    repo: '.',
    tree: 'HEAD',
    fingerprint: 'fingerprint.json',
    emit: null,
    condense: null,
    manifest: null,
    minConfidence: 'direct',
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--repo' && i + 1 < argv.length) args.repo = argv[++i];
    else if (arg === '--tree' && i + 1 < argv.length) args.tree = argv[++i];
    else if (arg === '--fingerprint' && i + 1 < argv.length) args.fingerprint = argv[++i];
    else if (arg === '--emit' && i + 1 < argv.length) args.emit = argv[++i];
    else if (arg === '--condense' && i + 1 < argv.length) args.condense = argv[++i];
    else if (arg === '--manifest' && i + 1 < argv.length) args.manifest = argv[++i];
    else if (arg === '--min-confidence' && i + 1 < argv.length) args.minConfidence = argv[++i];
  }

  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const fingerprintContent = await readFile(resolve(args.fingerprint), 'utf-8');
  const fingerprint = JSON.parse(fingerprintContent) as FingerprintDescriptor;

  const result = buildGraphMap(fingerprint);

  if (args.emit) {
    await writeFile(resolve(args.emit), edgesToNdjson(result.edges), 'utf-8');
  }

  if (args.condense) {
    await writeFile(resolve(args.condense), jcsCanonicalize(result.condensedDag), 'utf-8');
  }

  if (args.manifest) {
    await writeFile(resolve(args.manifest), jcsCanonicalize(result.manifest), 'utf-8');
  }

  if (!args.emit && !args.condense && !args.manifest) {
    process.stdout.write(edgesToNdjson(result.edges));
  }
}

main().catch(err => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
