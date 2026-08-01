import fs from 'fs';
import path from 'path';

const dir = 'engineering/packages/kit-matching/src/kits';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') && !f.includes('index.ts') && !f.includes('motion') && !f.includes('environment') && !f.includes('product-interface'));

for (const file of files) {
  const p = path.join(dir, file);
  let content = fs.readFileSync(p, 'utf-8');
  
  if (!content.includes('Check polarity before connecting the battery')) {
    content = content.replace(/assemblySteps:\s*\[([\s\S]*?)\],\n\s*testProcedure:/, (match, steps) => {
      // Find the highest order
      let maxOrder = 1;
      const orderMatches = [...steps.matchAll(/order:\s*(\d+)/g)];
      for (const m of orderMatches) {
        maxOrder = Math.max(maxOrder, parseInt(m[1], 10));
      }
      const newStep = `{ order: ${maxOrder + 1}, instruction: 'Connect the battery pack.', cautions: ['Check polarity before connecting the battery.'] }`;
      return `assemblySteps: [${steps.trim()}${steps.trim().endsWith(',') ? '' : ','} ${newStep}],\n  testProcedure:`;
    });
    fs.writeFileSync(p, content, 'utf-8');
  }
}
