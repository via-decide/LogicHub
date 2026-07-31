// LogicHub/scripts/check-no-tracking.mjs
// Enforces the claim made on the cookie policy page.
//
// cookies.html states that this site sets no analytics or advertising cookies
// and runs no third-party trackers. That is true today. This check keeps it true
// by failing the build the first time a tag is added without the policy being
// updated first — the same idea as the Gate 9 claim guard, where a statement is
// enforced rather than merely written.
//
// Run: node scripts/check-no-tracking.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Trackers whose presence would make the cookie policy false. */
const TRACKERS = [
  { pattern: /googletagmanager\.com/i, name: 'Google Tag Manager' },
  { pattern: /google-analytics\.com/i, name: 'Google Analytics' },
  { pattern: /\bgtag\s*\(/i, name: 'gtag()' },
  { pattern: /connect\.facebook\.net/i, name: 'Meta Pixel' },
  { pattern: /\bfbq\s*\(/i, name: 'Meta Pixel fbq()' },
  { pattern: /hotjar\.com/i, name: 'Hotjar' },
  { pattern: /clarity\.ms/i, name: 'Microsoft Clarity' },
  { pattern: /segment\.(com|io)\/analytics/i, name: 'Segment' },
  { pattern: /mixpanel/i, name: 'Mixpanel' },
  { pattern: /@vercel\/analytics/i, name: 'Vercel Analytics' },
  { pattern: /plausible\.io/i, name: 'Plausible' },
];

const SCAN_DIRS = ['.', 'pages', 'site', 'public', 'apps/web/src'];
const SCAN_EXTENSIONS = ['.html', '.tsx', '.ts', '.jsx', '.js'];
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'artifacts', 'scripts', 'tests',
]);

function* walk(dir, depth = 0) {
  if (depth > 4) return;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    let info;
    try {
      info = statSync(full);
    } catch {
      continue;
    }
    if (info.isDirectory()) {
      yield* walk(full, depth + 1);
    } else if (SCAN_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      yield full;
    }
  }
}

const seen = new Set();
const findings = [];

for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    if (seen.has(file)) continue;
    seen.add(file);

    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    // The policy page names the trackers it disclaims, so it is not evidence
    // of one being present.
    if (file.endsWith('cookies.html')) continue;

    for (const tracker of TRACKERS) {
      if (tracker.pattern.test(content)) {
        findings.push({ file, tracker: tracker.name });
      }
    }
  }
}

if (findings.length === 0) {
  console.log(`No tracking found across ${seen.size} files. The cookie policy holds.`);
  process.exit(0);
}

console.error('Tracking code found, but the cookie policy says there is none.\n');
for (const finding of findings.sort((a, b) => (a.file < b.file ? -1 : 1))) {
  console.error(`  ${finding.file}: ${finding.tracker}`);
}
console.error(
  '\nEither remove it, or update cookies.html and add a consent mechanism before '
  + 'anything is collected. Do not leave the policy claiming something untrue.',
);

process.exit(1);
