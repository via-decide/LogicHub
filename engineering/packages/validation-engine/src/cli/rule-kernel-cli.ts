#!/usr/bin/env node
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseProduct, parseCase, evaluateCase, KERNEL_VERSION } from '../kernel/evaluator.js';
import { RULE_REGISTRY, getRule } from '../rules/registry.js';
import { compareWithOutcome, DocumentedOutcomeSchema } from '../kernel/compare.js';
import type { RuleResultStatus } from '../contracts/rule-result.schema.js';
import { jcsCanonicalize } from '../util/jcs.js';

interface EvaluateArgs {
  product: string;
  case: string;
  rule: string;
  out: string | null;
  stdout: boolean;
}

interface CompareArgs {
  result: string;
  outcome: string;
}

interface ReplayArgs {
  product: string;
  casesDir: string;
  out: string | null;
}

function usage(): never {
  process.stderr.write(`rule-kernel v${KERNEL_VERSION}

Usage:
  rule-kernel validate   --product <path> [--case <path>]
  rule-kernel evaluate   --product <path> --case <path> [--rule <id>|all] [--out <path>] [--stdout]
  rule-kernel explain    <ruleId>
  rule-kernel compare    --result <path> --outcome <path>
  rule-kernel replay-all --product <path> --cases-dir <dir> [--out <path>]

Subcommands:
  validate    Parse and validate product/case JSON against schemas
  evaluate    Run rules against a product case, emit evaluation document
  explain     Print the self-documenting definition for a rule
  compare     Compare a kernel result status with a documented outcome
  replay-all  Evaluate all case files in a directory
`);
  process.exit(1);
}

function parseEvaluateArgs(argv: string[]): EvaluateArgs {
  const args: EvaluateArgs = { product: '', case: '', rule: 'all', out: null, stdout: false };
  for (let i = 3; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--product' && i + 1 < argv.length) args.product = argv[++i];
    else if (arg === '--case' && i + 1 < argv.length) args.case = argv[++i];
    else if (arg === '--rule' && i + 1 < argv.length) args.rule = argv[++i];
    else if (arg === '--out' && i + 1 < argv.length) args.out = argv[++i];
    else if (arg === '--stdout') args.stdout = true;
  }
  if (!args.product || !args.case) {
    process.stderr.write('Error: --product and --case are required for evaluate\n');
    process.exit(1);
  }
  return args;
}

async function readJson(path: string): Promise<unknown> {
  const raw = await readFile(resolve(path), 'utf-8');
  return JSON.parse(raw) as unknown;
}

async function cmdValidate(argv: string[]): Promise<void> {
  let productPath = '';
  let casePath = '';
  for (let i = 3; i < argv.length; i++) {
    if (argv[i] === '--product' && i + 1 < argv.length) productPath = argv[++i];
    else if (argv[i] === '--case' && i + 1 < argv.length) casePath = argv[++i];
  }
  if (!productPath) {
    process.stderr.write('Error: --product is required for validate\n');
    process.exit(1);
  }
  const product = parseProduct(await readJson(productPath));
  process.stdout.write(`Product '${product.productId}' rev '${product.productRevision}' — valid\n`);

  if (casePath) {
    const pc = parseCase(await readJson(casePath));
    process.stdout.write(`Case '${pc.caseId}' — valid (${pc.rules === 'all' ? 'all rules' : pc.rules.length + ' rules'})\n`);
  }
}

async function cmdEvaluate(argv: string[]): Promise<void> {
  const args = parseEvaluateArgs(argv);
  const product = parseProduct(await readJson(args.product));
  const rawCase = await readJson(args.case) as Record<string, unknown>;

  if (args.rule !== 'all') {
    rawCase['rules'] = [args.rule];
  }

  const pc = parseCase(rawCase);
  const doc = evaluateCase(product, pc);
  const json = JSON.stringify(doc, null, 2);

  if (args.out) {
    await writeFile(resolve(args.out), json, 'utf-8');
    process.stderr.write(`Evaluation written to ${resolve(args.out)}\n`);
    process.stderr.write(`Overall status: ${doc.overallStatus}  (${doc.ruleResults.length} rules)\n`);
    process.stderr.write(`Document hash:  ${doc.documentHash}\n`);
  }
  if (args.stdout || !args.out) {
    process.stdout.write(json + '\n');
  }
}

function cmdExplain(argv: string[]): void {
  const ruleId = argv[3];
  if (!ruleId) {
    process.stderr.write('Usage: rule-kernel explain <ruleId>\n\nAvailable rules:\n');
    for (const r of RULE_REGISTRY) {
      process.stderr.write(`  ${r.ruleId}  (v${r.definition.ruleVersion})\n`);
    }
    process.exit(1);
  }
  const rule = getRule(ruleId);
  if (!rule) {
    process.stderr.write(`Unknown rule '${ruleId}'. Available: ${RULE_REGISTRY.map(r => r.ruleId).join(', ')}\n`);
    process.exit(1);
  }
  const def = rule.definition;
  process.stdout.write(`${def.ruleId} v${def.ruleVersion} — ${def.ruleName}\n\n`);
  process.stdout.write(`Purpose: ${def.purpose}\n\n`);

  process.stdout.write(`Target objects: ${def.targetObjects.join(', ')}\n\n`);

  process.stdout.write(`Required inputs:\n`);
  for (const inp of def.requiredInputs) {
    process.stdout.write(`  - ${inp.name} [${inp.unit}]: ${inp.description}\n`);
  }

  if (def.optionalInputs.length > 0) {
    process.stdout.write(`\nOptional inputs:\n`);
    for (const inp of def.optionalInputs) {
      process.stdout.write(`  - ${inp.name} [${inp.unit}]: ${inp.description}\n`);
    }
  }

  process.stdout.write(`\nFormulas:\n`);
  for (const f of def.formulas) {
    process.stdout.write(`  ${f.id}: ${f.expression}\n    ${f.description}\n`);
  }

  process.stdout.write(`\nThresholds:\n`);
  for (const t of def.thresholds) {
    process.stdout.write(`  ${t.name} = ${t.value}${t.unit ? ' ' + t.unit : ''}: ${t.description}\n`);
  }

  process.stdout.write(`\nOutput states: ${def.outputStates.join(', ')}\n`);

  process.stdout.write(`\nAssumptions:\n`);
  for (const a of def.assumptions) process.stdout.write(`  - ${a}\n`);

  process.stdout.write(`\nLimitations:\n`);
  for (const l of def.limitations) process.stdout.write(`  - ${l}\n`);

  process.stdout.write(`\nFailure modes:\n`);
  for (const f of def.failureModes) process.stdout.write(`  - ${f}\n`);

  process.stdout.write(`\nPhysical validation:\n`);
  for (const p of def.physicalValidationProcedure) process.stdout.write(`  - ${p}\n`);
}

async function cmdCompare(argv: string[]): Promise<void> {
  let resultPath = '';
  let outcomePath = '';
  for (let i = 3; i < argv.length; i++) {
    if (argv[i] === '--result' && i + 1 < argv.length) resultPath = argv[++i];
    else if (argv[i] === '--outcome' && i + 1 < argv.length) outcomePath = argv[++i];
  }
  if (!resultPath || !outcomePath) {
    process.stderr.write('Error: --result and --outcome are required for compare\n');
    process.exit(1);
  }
  const resultDoc = await readJson(resultPath) as { status?: string; ruleResults?: Array<{ ruleId: string; status: string }> };
  const outcomeRaw = await readJson(outcomePath);
  const outcome = DocumentedOutcomeSchema.parse(outcomeRaw);

  if (resultDoc.ruleResults && Array.isArray(resultDoc.ruleResults)) {
    process.stdout.write('Comparing evaluation document (per-rule):\n\n');
    for (const rr of resultDoc.ruleResults) {
      const classification = compareWithOutcome(rr.status as RuleResultStatus, outcome);
      process.stdout.write(`  ${rr.ruleId}: ${rr.status} → ${classification}\n`);
    }
    if (resultDoc.status) {
      const overall = compareWithOutcome(resultDoc.status as RuleResultStatus, outcome);
      process.stdout.write(`\n  overall: ${resultDoc.status} → ${overall}\n`);
    }
  } else if (resultDoc.status) {
    const classification = compareWithOutcome(resultDoc.status as RuleResultStatus, outcome);
    process.stdout.write(`${resultDoc.status} → ${classification}\n`);
  } else {
    process.stderr.write('Error: result file must have a "status" or "ruleResults" field\n');
    process.exit(1);
  }
}

async function cmdReplayAll(argv: string[]): Promise<void> {
  let productPath = '';
  let casesDir = '';
  let outPath: string | null = null;
  for (let i = 3; i < argv.length; i++) {
    if (argv[i] === '--product' && i + 1 < argv.length) productPath = argv[++i];
    else if (argv[i] === '--cases-dir' && i + 1 < argv.length) casesDir = argv[++i];
    else if (argv[i] === '--out' && i + 1 < argv.length) outPath = argv[++i];
  }
  if (!productPath || !casesDir) {
    process.stderr.write('Error: --product and --cases-dir are required for replay-all\n');
    process.exit(1);
  }

  const product = parseProduct(await readJson(productPath));
  const dir = resolve(casesDir);
  const entries = await readdir(dir);
  const caseFiles = entries.filter(e => e.endsWith('.json')).sort();

  const results: Array<{ caseId: string; file: string; overallStatus: string; documentHash: string; ruleCount: number }> = [];

  for (const file of caseFiles) {
    const raw = await readJson(join(dir, file));
    try {
      const pc = parseCase(raw);
      const doc = evaluateCase(product, pc);
      results.push({
        caseId: doc.caseId,
        file,
        overallStatus: doc.overallStatus,
        documentHash: doc.documentHash,
        ruleCount: doc.ruleResults.length,
      });
      process.stderr.write(`  ${file}: ${doc.overallStatus} (${doc.ruleResults.length} rules)\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ caseId: '(parse error)', file, overallStatus: 'error', documentHash: '', ruleCount: 0 });
      process.stderr.write(`  ${file}: ERROR — ${msg}\n`);
    }
  }

  const summary = { kernelVersion: KERNEL_VERSION, productId: product.productId, casesEvaluated: results.length, results };
  const json = JSON.stringify(summary, null, 2);

  if (outPath) {
    await writeFile(resolve(outPath), json, 'utf-8');
    process.stderr.write(`\nReplay summary written to ${resolve(outPath)}\n`);
  } else {
    process.stdout.write(json + '\n');
  }
}

async function main(): Promise<void> {
  const subcommand = process.argv[2];
  switch (subcommand) {
    case 'validate':  return cmdValidate(process.argv);
    case 'evaluate':  return cmdEvaluate(process.argv);
    case 'explain':   return cmdExplain(process.argv);
    case 'compare':   return cmdCompare(process.argv);
    case 'replay-all': return cmdReplayAll(process.argv);
    default:          return usage();
  }
}

main().catch(err => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
