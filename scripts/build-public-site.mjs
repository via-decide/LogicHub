import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const title = 'LogicHub.app — Bounded Hardware Verification &amp; Execution';
const hero = 'Anyone can generate a hardware design. LogicHub is where it gets verified.';
const forbidden = ['AI APP BUILDER','Build Android Apps With AI','Authentication failed','localhost:7001','localhost:7002','localhost:7003','localhost:7004','localhost:7006'];
const sha = execSync('git rev-parse HEAD').toString().trim();
const bundle = readFileSync('public/downloads/logichub-demo-evidence-bundle-v0.4.1.json');
const bundleHash = createHash('sha256').update(bundle).digest('hex');
writeFileSync('public/downloads/logichub-demo-evidence-bundle-v0.4.1.json.sha256', `${bundleHash}  logichub-demo-evidence-bundle-v0.4.1.json\n`);
let html = readFileSync('site/index.html','utf8').replaceAll('__LOGICHUB_BUILD_ID__', sha).replaceAll('__DEMO_BUNDLE_SHA256__', bundleHash);
if (!html.includes(`<title>${title}</title>`) || !html.includes(hero)) throw new Error('Required root markers missing');
for (const marker of forbidden) if (html.includes(marker)) throw new Error(`Forbidden marker in root: ${marker}`);
writeFileSync('index.html', html);
writeFileSync('public/index.html', html);

if (existsSync('site/how-it-works.html')) {
  let hiw = readFileSync('site/how-it-works.html', 'utf8').replaceAll('__LOGICHUB_BUILD_ID__', sha);
  writeFileSync('how-it-works.html', hiw);
  writeFileSync('public/how-it-works.html', hiw);
}

copyFileSync('manifest.json', 'public/manifest.json');
copyFileSync('sw.js', 'public/sw.js');
console.log(JSON.stringify({ buildId: sha, rootSha256: createHash('sha256').update(html).digest('hex'), bundleHash }, null, 2));
