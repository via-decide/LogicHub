#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const args = process.argv.slice(2);
const runMode = args.includes('--run');
const listFileArg = args.find((arg) => arg.startsWith('--file='));
const listFile = listFileArg ? listFileArg.split('=')[1] : 'deploy/deployments-to-recover.txt';

if (!fs.existsSync(listFile)) {
  console.warn(`⚠️ Deployment list file not found: ${listFile}. Bypassing recovery loop.`);
  process.exit(0);
}

const deployments = fs
  .readFileSync(listFile, 'utf-8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

if (deployments.length === 0) {
  console.warn(`⚠️ No deployments found in ${listFile}. Bypassing recovery loop.`);
  process.exit(0);
}

console.log(`📋 Loaded ${deployments.length} deployment(s) from ${listFile}`);

for (const deployment of deployments) {
  const command = ['vercel', 'redeploy', deployment, '--yes'];

  if (!runMode) {
    console.log(`🟡 DRY RUN: npx ${command.join(' ')}`);
    continue;
  }

  console.log(`🚀 Redeploying: ${deployment}`);
  const result = spawnSync('npx', command, { stdio: 'inherit' });

  if (result.status !== 0) {
    console.error(`❌ Failed redeploy for ${deployment}`);
    continue;
  }

  console.log(`✅ Redeployed: ${deployment}`);
}

if (!runMode) {
  console.log('\nℹ️ Dry run complete. Re-run with --run to execute redeploys.');
}
