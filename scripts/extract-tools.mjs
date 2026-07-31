import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const htmlDir = join(import.meta.dirname, '../tmp_tools/hardware_production_tools/hardware_production_tools_merged/html');
const outDir = join(import.meta.dirname, '../engineering/apps/web/src/app/tools/data');

mkdirSync(outDir, { recursive: true });

function extractBetween(text, startTag, endTag) {
  const start = text.indexOf(startTag);
  if (start === -1) return null;
  const end = text.indexOf(endTag, start + startTag.length);
  if (end === -1) return null;
  return text.slice(start + startTag.length, end).trim();
}

function stripTags(html) {
  return html.replace(/<[^>]*>?/gm, '').trim();
}

function unescapeHtml(html) {
  return html.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

const files = readdirSync(htmlDir).filter(f => f.endsWith('.html'));

const allToolExports = [];

for (const file of files) {
  const content = readFileSync(join(htmlDir, file), 'utf8');
  
  const id = basename(file, '.html');
  // camelCase the id for variable name
  const varName = id.replace(/-([a-z0-9])/g, g => g[1].toUpperCase());
  
  const titleHtml = extractBetween(content, '<h1>', '</h1>');
  const title = titleHtml ? stripTags(titleHtml) : id;
  
  const eyebrowHtml = extractBetween(content, '<div class="eyebrow">', '</div>');
  const eyebrow = eyebrowHtml ? stripTags(eyebrowHtml) : 'Tool';
  
  const leadHtml = extractBetween(content, '<p class="lead">', '</p>');
  const lead = leadHtml ? unescapeHtml(stripTags(leadHtml)) : '';
  
  const modelSection = extractBetween(content, '<section id="model">', '</section>');
  const contractFields = [];
  if (modelSection) {
    const rows = modelSection.split('<tr>');
    for (let i = 2; i < rows.length; i++) { // skip header
      const row = rows[i];
      const cols = row.split('<td>');
      if (cols.length >= 3) {
        contractFields.push({
          layer: stripTags(cols[1].split('</td>')[0]),
          t_meaning: stripTags(cols[2].split('</td>')[0])
        });
      }
    }
  }
  
  const projectsSection = extractBetween(content, '<section id="projects">', '</section>');
  const projects = [];
  if (projectsSection) {
    const cards = projectsSection.split('<div class="card">');
    for (let i = 1; i < cards.length; i++) {
      const card = cards[i];
      const nameMatch = extractBetween(card, '<h3>', '</h3>');
      const name = nameMatch ? stripTags(nameMatch) : 'Unknown';
      if (name.includes('8MB') || name.toLowerCase().includes('air-gapped')) {
        continue;
      }
      
      let pContent = '';
      const parts = card.split('<p>');
      for (let j = 1; j < parts.length; j++) {
        pContent += stripTags(parts[j].split('</p>')[0]) + ' ';
      }
      
      projects.push({
        name,
        content: unescapeHtml(pContent.trim())
      });
    }
  }
  
  const stagesSection = extractBetween(content, '<section id="stages">', '</section>');
  const stages = [];
  if (stagesSection) {
    const stgs = stagesSection.split('<div class="stage">');
    for (let i = 1; i < stgs.length; i++) {
      const stg = stgs[i];
      const numMatch = extractBetween(stg, '<div class="num">', '</div>');
      const num = numMatch ? stripTags(numMatch) : (i).toString();
      
      let descMatch = extractBetween(stg, '<div>', '</div>');
      // Some might have multiple paragraphs or different structure
      if (!descMatch) descMatch = stripTags(stg.split('</div>')[0]);
      else descMatch = stripTags(descMatch);
      
      stages.push({
        num,
        desc: unescapeHtml(descMatch)
      });
    }
  }
  
  const checklistSection = extractBetween(content, '<section id="checklist">', '</section>');
  const checklist = [];
  if (checklistSection) {
    const items = checklistSection.split('<li>');
    for (let i = 1; i < items.length; i++) {
      checklist.push(unescapeHtml(stripTags(items[i].split('</li>')[0])));
    }
  }
  
  const toolData = {
    id,
    title,
    eyebrow,
    lead,
    contractFields,
    projects,
    stages,
    checklist
  };

  const tsContent = `import { ToolData } from './types';

export const ${varName}: ToolData = ${JSON.stringify(toolData, null, 2)};
`;

  writeFileSync(join(outDir, `${id}.ts`), tsContent);
  allToolExports.push({ id, varName });
}

// Generate an index file
const indexContent = allToolExports.map(e => `import { ${e.varName} } from './${e.id}';`).join('\n') + 
'\n\nexport const allTools = [\n  ' + allToolExports.map(e => e.varName).join(',\n  ') + '\n];\n';

writeFileSync(join(outDir, 'index.ts'), indexContent);
console.log('Successfully extracted tools data.');
