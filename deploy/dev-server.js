#!/usr/bin/env node
import { spawn } from 'node:child_process';

const port = process.env.PORT || '5173';
const child = spawn('python3', ['-m', 'http.server', port], { stdio: 'inherit' });

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
