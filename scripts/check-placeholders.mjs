// LogicHub/scripts/check-placeholders.mjs
// Fails while any legal document still carries an unfilled business fact.
//
// The policy pages are drafted complete except for facts only the business can
// supply — registered entity, address, GST number, grievance officer. Those are
// left as obvious markers rather than invented, and this check stops a document
// reaching production with one still in it.
//
// Run: node scripts/check-placeholders.mjs
// Exits non-zero, listing every file and token, when anything is unfilled.

import { readFileSync, existsSync } from 'node:fs';
import { PLACEHOLDER_TOKENS } from './site-constants.mjs';

const DOCUMENTS = [
  'privacy.html',
  'terms.html',
  'refund-policy.html',
  'shipping-policy.html',
  'cookies.html',
  'contact.html',
  'waitlist.html',
];

const findings = [];

for (const file of DOCUMENTS) {
  if (!existsSync(file)) {
    findings.push({ file, token: '(file missing)', count: 0 });
    continue;
  }

  const content = readFileSync(file, 'utf8');
  for (const token of PLACEHOLDER_TOKENS) {
    const count = content.split(token).length - 1;
    if (count > 0) findings.push({ file, token, count });
  }
}

if (findings.length === 0) {
  console.log(`All ${DOCUMENTS.length} legal documents are filled in.`);
  process.exit(0);
}

console.error('Unfilled business facts remain. These must not be published.\n');

const byFile = new Map();
for (const finding of findings) {
  if (!byFile.has(finding.file)) byFile.set(finding.file, []);
  byFile.get(finding.file).push(finding);
}

for (const [file, items] of [...byFile.entries()].sort()) {
  console.error(`  ${file}`);
  for (const item of items.sort((a, b) => (a.token < b.token ? -1 : 1))) {
    const times = item.count === 1 ? 'once' : `${item.count} times`;
    console.error(`    ${item.token}${item.count ? ` (${times})` : ''}`);
  }
}

console.error(
  '\nFill each of these with the real registered detail. Do not guess at any of '
  + 'them: a wrong company address or GST number in a published policy is worse '
  + 'than an obviously missing one.',
);

process.exit(1);
