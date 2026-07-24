import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const errors=[]; const title='LogicHub.app — Sovereign Execution Boundary'; const hero='Review and route AI code without exporting the repository.';
const forbidden=['AI APP BUILDER','Build Android Apps With AI','Authentication failed','localhost:7001','localhost:7002','localhost:7003','localhost:7004','localhost:7006','href="#"'];
const files=['index.html','public/index.html']; const contents=files.map(f=>readFileSync(f,'utf8'));
for (const [i,html] of contents.entries()) { const f=files[i]; if(!html.includes(`<title>${title}</title>`)) errors.push(`${f}: title mismatch`); if(!html.includes(hero)) errors.push(`${f}: hero missing`); if(!html.includes('meta name="logichub-product" content="sovereign-execution-boundary"')) errors.push(`${f}: product marker missing`); if(!html.includes('body data-product="sovereign-execution-boundary"')) errors.push(`${f}: body marker missing`); for(const m of forbidden) if(html.includes(m)) errors.push(`${f}: forbidden marker ${m}`); if(/firebase|Authentication failed/i.test(html)) errors.push(`${f}: root loads builder auth marker`); }
if(contents[0]!==contents[1]) errors.push('root and public outputs differ');
const bundlePath='public/downloads/logichub-demo-evidence-bundle-v0.4.1.json'; const hashPath=`${bundlePath}.sha256`;
if(!existsSync(bundlePath)||!existsSync(hashPath)) errors.push('demonstration evidence bundle or hash missing'); else { const actual=createHash('sha256').update(readFileSync(bundlePath)).digest('hex'); const stated=readFileSync(hashPath,'utf8').split(/\s+/)[0]; if(actual!==stated) errors.push('bundle hash mismatch'); if(!contents[0].includes(actual)) errors.push('displayed bundle hash missing'); }
const builder=readFileSync('public/builder/index.html','utf8'); if(!/AI App Builder|Builder Operating System|Make App/i.test(builder)) errors.push('builder preservation marker missing');
const manifest=JSON.parse(readFileSync('public/builder/manifest.json','utf8')); if(manifest.id!=='/builder/'||manifest.start_url!=='/builder/'||manifest.scope!=='/builder/') errors.push('builder manifest scope mismatch');
const sw=readFileSync('public/builder/sw.js','utf8'); if(sw.includes("'/index.html'")||sw.includes("'./index.html'")) errors.push('builder service worker caches root index');
if(errors.length){ console.error(errors.join('\n')); process.exit(1); } console.log('root source verification passed');
