#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildFingerprint } from '../fingerprint/fingerprint.js';

interface CliArgs {
  repo: string;
  tree: string;
  profile: string;
  canonical: boolean;
  out: string | null;
  stdout: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    repo: '.',
    tree: 'HEAD',
    profile: 'toolchain-profile.json',
    canonical: false,
    out: null,
    stdout: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--repo' && i + 1 < argv.length) args.repo = argv[++i];
    else if (arg === '--tree' && i + 1 < argv.length) args.tree = argv[++i];
    else if (arg === '--profile' && i + 1 < argv.length) args.profile = argv[++i];
    else if (arg === '--canonical') args.canonical = true;
    else if (arg === '--out' && i + 1 < argv.length) args.out = argv[++i];
    else if (arg === '--stdout') args.stdout = true;
  }

  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const repoPath = resolve(args.repo);
  const profilePath = resolve(args.profile);

  const result = await buildFingerprint({
    repoPath,
    commitRef: args.tree,
    toolchainProfilePath: profilePath,
    canonical: args.canonical,
  });

  if (args.out) {
    await writeFile(resolve(args.out), result.canonicalBytes, 'utf-8');
    const diagnosticsPath = resolve(args.out).replace(/\.json$/, '.diagnostics.json');
    await writeFile(diagnosticsPath, JSON.stringify(result.diagnostics, null, 2), 'utf-8');
  }

  if (args.stdout || (!args.out && !args.stdout)) {
    process.stdout.write(result.canonicalBytes);
  }
}

main().catch(err => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
