import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { computeSemDiff } from '../semdiff/semdiff.js';
import { buildGraphMap } from '../graphmap/graphmap.js';
import { jcsCanonicalize } from '../util/jcs.js';
import type { FingerprintDescriptor } from '../types.js';

interface CliArgs {
  baseFingerprintPath: string;
  proposedFingerprintPath: string;
  outDir: string;
  stdout: boolean;
  includeGraphs: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    baseFingerprintPath: '',
    proposedFingerprintPath: '',
    outDir: '.',
    stdout: false,
    includeGraphs: true,
  };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--base':
        args.baseFingerprintPath = argv[++i];
        break;
      case '--proposed':
        args.proposedFingerprintPath = argv[++i];
        break;
      case '--out':
        args.outDir = argv[++i];
        break;
      case '--stdout':
        args.stdout = true;
        break;
      case '--no-graphs':
        args.includeGraphs = false;
        break;
    }
  }

  if (!args.baseFingerprintPath || !args.proposedFingerprintPath) {
    console.error('Usage: semdiff --base <fingerprint.json> --proposed <fingerprint.json> [--out <dir>] [--stdout] [--no-graphs]');
    process.exit(1);
  }

  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  const baseRaw = await readFile(resolve(args.baseFingerprintPath), 'utf-8');
  const proposedRaw = await readFile(resolve(args.proposedFingerprintPath), 'utf-8');

  const baseFingerprint: FingerprintDescriptor = JSON.parse(baseRaw);
  const proposedFingerprint: FingerprintDescriptor = JSON.parse(proposedRaw);

  const baseGraph = args.includeGraphs ? buildGraphMap(baseFingerprint) : null;
  const proposedGraph = args.includeGraphs ? buildGraphMap(proposedFingerprint) : null;

  const result = computeSemDiff({
    base: { fingerprint: baseFingerprint, graphMap: baseGraph },
    proposed: { fingerprint: proposedFingerprint, graphMap: proposedGraph },
  });

  if (args.stdout) {
    const output = {
      deltas: result.deltas,
      impacts: result.impacts,
      staleEvidence: result.staleEvidence,
      replay: result.replay,
      replayVerified: result.replayVerified,
      replayErrors: result.replayErrors,
      prSummary: result.prSummary,
    };
    process.stdout.write(jcsCanonicalize(output) + '\n');
  } else {
    const outDir = resolve(args.outDir);
    await writeFile(resolve(outDir, 'delta.json'), jcsCanonicalize(result.deltas) + '\n');
    await writeFile(resolve(outDir, 'impact.json'), jcsCanonicalize(result.impacts) + '\n');
    await writeFile(resolve(outDir, 'replay.json'), jcsCanonicalize(result.replay) + '\n');
    await writeFile(resolve(outDir, 'engineering-pr-summary.json'), jcsCanonicalize(result.prSummary) + '\n');
    console.log(`SemDiff output written to ${outDir}`);
    console.log(`  Deltas: ${result.deltas.length}`);
    console.log(`  Impacts: ${result.impacts.length}`);
    console.log(`  Replay operations: ${result.replay.operationCount}`);
    console.log(`  Replay verified: ${result.replayVerified}`);
    if (result.replayErrors.length > 0) {
      console.log(`  Replay errors: ${result.replayErrors.join(', ')}`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
