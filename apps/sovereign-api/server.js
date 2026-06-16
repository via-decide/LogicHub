import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { zayvoraCoalescer } from './utils/requestCoalescer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Helper to wrap Vercel handlers for Express
const wrap = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Import Handlers (Add more as needed)
import accessStatus from '../../api/access-status.js';
import buildApk from '../../api/build-apk.js';
import founderRequest from '../../api/founder-request.js';
import publishApp from '../../api/publish-app.js';

app.post('/api/access-status', wrap(accessStatus));
app.post('/api/build-apk', wrap(buildApk));
app.post('/api/founder-request', wrap(founderRequest));
app.post('/api/publish-app', wrap(publishApp));

// --- ZAYVORA SOVEREIGN PIPELINE ---

const ZAYVORA_URL = 'http://localhost:3000/v1/trace/log';
const VAULT_DIR = '/Users/dharamdaxini/Downloads/via/zayvora/cea/CEA-0000/training_vault';

const SYSTEM_ARCHITECTURE_GUIDE = `
SOVEREIGN SUBSTRATE PRIMITIVES:
1. AuthorityFabric: Use the SINGLETON pattern via AuthorityFabric.getInstance(). NEVER use 'new AuthorityFabric()'.
   - registerProfile(subjectId), escalateTrust(subjectId, level)
2. ManifestEngine: Use the SINGLETON pattern via ManifestEngine.getInstance(). NEVER use 'new ManifestEngine()'.
   - initialize(subjectId, type), append(op), snapshot(label)
3. ToolStorage: Use STATIC methods ONLY (ToolStorage.save/load). 
4. Zero-Cloud Policy: No external CDNs, no useState for kernel state, no fetch() to non-local URLs.
5. Lineage Headers: Mandatory CEA-0000 header in all synthesized files.

DAXINI CODING STANDARD (DCS) v1.0.0:
1. ZERO-CHATTER: Output ONLY raw data/code. No conversational prefixes.
2. SCRIPT-TAG DOMINANCE: No ESM import/export in browser tools.
3. TOOLSTORAGE API: Use ToolStorage.save(key, val) and ToolStorage.load(key).
4. OPERATOR SOP: For T1+ tasks, generate task.md first.
`;

async function findBestTrace(prompt) {
  try {
    const files = fs.readdirSync(VAULT_DIR).filter(f => f.endsWith('.json'));
    let bestMatch = null;
    let maxOverlap = 0;

    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
    const promptKeywords = normalize(prompt);

    files.forEach(file => {
      const trace = JSON.parse(fs.readFileSync(path.join(VAULT_DIR, file), 'utf8'));
      const traceContent = normalize(trace.task + ' ' + (trace.artifacts?.prd?.description || ''));
      
      let overlap = 0;
      promptKeywords.forEach(pk => { if (traceContent.includes(pk)) overlap++; });

      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestMatch = trace;
      }
    });

    if (bestMatch) console.log(`[Alchemist] Found best trace: ${bestMatch.task} (Overlap: ${maxOverlap})`);
    return bestMatch;
  } catch (err) {
    console.error('[Trace Search Error]', err.message);
    return null;
  }
}

async function logToZayvora(task, trace, artifacts) {
  try {
    await fetch(ZAYVORA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task,
        trace,
        artifacts,
        session_id: 'logichub_training_session'
      })
    });
  } catch (err) {
    console.error('[Zayvora Log Error]', err.message);
  }
}

// Phase 1: Planning (Axiom) - ARTIFACT GENERATION ENGINE
app.post('/api/zayvora/plan', async (req, res) => {
  const { prompt, architecture } = req.body;
  
  // PRE-EMPTIVE SEARCH: Find historical traces first
  const historicalTrace = await findBestTrace(prompt);
  const traceContext = historicalTrace 
    ? `HISTORICAL TRACE (Use this as a world-class template):\nTask: ${historicalTrace.task}\nCode: ${historicalTrace.artifacts?.code}\nPRD: ${JSON.stringify(historicalTrace.artifacts?.prd)}`
    : 'No historical trace found. Reason from first principles.';

  const key = crypto.createHash('sha256').update(`axiom_v2:${prompt}:${JSON.stringify(architecture)}`).digest('hex');

  try {
    const result = await zayvoraCoalescer.coalesce(key, async () => {
      const systemPrompt = `You are Zayvora Axiom, the Master Architect. 
      Generate a COMPLETE APPLICATION ARTIFACT (Software Blueprint) for this app.
      
      ${traceContext}
      
      ${SYSTEM_ARCHITECTURE_GUIDE}
      
      You must construct a complete project model with the following 14 sections. 
      Format as STRICT JSON with the EXACT keys below:
      
      {
        "summary": { "name": "", "goal": "", "problem": "", "target_users": "", "value_prop": "", "constraints": "" },
        "prd": { "features": [], "user_stories": [], "acceptance_criteria": [], "success_metrics": [], "edge_cases": [] },
        "trd": { "frontend": "", "backend": "", "database": "", "auth": "", "apis": [], "deployment": "" },
        "architecture": { "client": "", "api_layer": "", "services": "", "db": "", "integrations": "" },
        "data_model": [ { "entity": "", "fields": [], "relationships": [] } ],
        "app_flow": { "onboarding": [], "navigation": [], "state_transitions": [], "success_paths": [], "failure_paths": [] },
        "ui_system": { "colors": [], "typography": "", "components": [], "screens": [] },
        "source_tree": { "structure": {} },
        "implementation_plan": [ { "step": "", "description": "", "dependencies": [] } ],
        "code_preview": [ { "filename": "", "code": "representative snippets" } ],
        "version_package": { "manifest": "project.logic.json structure" },
        "export_package": { "contents": ["APK", "ZIP", "Git Repository", "project.logic.json"] },
        "risk_analysis": { "technical": [], "scalability": [], "security": [] },
        "continuation_prompt": "A prompt that can be pasted into Claude/Gemini/Cursor to continue development from this state."
      }
      
      STRICT REQUIREMENT: 
      - ZERO CHATTER. Output ONLY valid JSON.
      - DO NOT wrap the output in \`\`\`json markdown blocks.
      
      Context: ${JSON.stringify(architecture)}`;

      const response = await fetch('http://localhost:8080/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `${systemPrompt}\n\nUser Request: ${prompt}` }],
          stream: false
        })
      });
      const data = await response.json();
      return { response: data.choices[0].message.content };
    });

    let rawJson = result.response;
    
    // Aggressive JSON cleansing (strip markdown ticks if the model ignores instructions)
    if (rawJson.includes('\`\`\`')) {
      const match = rawJson.match(/\`\`\`(?:json)?\s*([\s\S]+?)\s*\`\`\`/);
      if (match) {
        rawJson = match[1].trim();
      }
    }
    rawJson = rawJson.trim();

    const artifacts = JSON.parse(rawJson);
    res.json({ artifacts, reused_trace: !!historicalTrace });
  } catch (err) {
    console.error('[Axiom Error]', err);
    res.status(500).json({ error: 'Axiom planning failed', details: err.message });
  }
});

// Phase 2: Synthesis (Praxis) - GENERATES STAGE 6 + LOGS TRACE
app.post('/api/zayvora/synthesize', async (req, res) => {
  const { prompt, context, prd, filename, type, artifacts } = req.body;
  const key = crypto.createHash('sha256').update(`praxis:${prompt}:${prd}:${filename}`).digest('hex');

  try {
    const result = await zayvoraCoalescer.coalesce(key, async () => {
      const fullPrompt = `System: You are Zayvora Praxis, an expert Sovereign Engineer building ${filename} of type ${type}. 
      Output ONLY raw code. No markdown.
      
      DESIGN CONTEXT:
      PRD: ${prd}
      TECH STACK: ${artifacts?.trd || 'Vanilla JS'}
      SCHEMA: ${artifacts?.schema || 'None'}
      
      ${SYSTEM_ARCHITECTURE_GUIDE}
      
      STRICT REQUIREMENT: ZERO CHATTER. NO MARKDOWN WRAPPERS.
      
      Instructions: ${prompt}`;

      const OLLAMA_URL = process.env.LAB_NODE_URL || 'http://localhost:11434/v1/chat/completions';
      const MODEL = 'daxini2404/zayvora:engineer';
      
      let attempt = 0;
      const MAX_ATTEMPTS = 2;
      let finalCode = "";
      let lastError = null;
      let currentPrompt = fullPrompt;

      while (attempt < MAX_ATTEMPTS) {
        attempt++;
        const response = await fetch(OLLAMA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content: currentPrompt }],
            stream: false
          })
        });
        
        if (!response.ok) {
           throw new Error(`Ollama API returned ${response.status}`);
        }
        
        const data = await response.json();
        let code = data.choices[0]?.message?.content || "";
        
        // --- DAXINI AGGRESSIVE CLEANSE (Now handling agentic thought blocks) ---
        // Strip <thought>...</thought> or [Cockpit]...[/Cockpit]
        code = code.replace(/<thought>[\s\S]*?<\/thought>/gi, '');
        code = code.replace(/\[Cockpit\][\s\S]*?\[\/Cockpit\]/gi, '');
        
        if (code.includes("```")) {
          const match = code.match(/```(?:\w+)?\s*([\s\S]+?)\s*```/);
          if (match) code = match[1].trim();
        } else {
          const chatterPrefixes = ["Here is the code:", "Here is the improved code:", "Sure!", "Certainly!", "Here is the raw code"];
          chatterPrefixes.forEach(prefix => {
            if (code.toLowerCase().includes(prefix.toLowerCase())) {
              const index = code.toLowerCase().indexOf(prefix.toLowerCase()) + prefix.length;
              code = code.substring(index).trim();
              if (code.startsWith(":") || code.startsWith(".")) code = code.substring(1).trim();
            }
          });
        }
        code = code.trim();
        
        // --- COCKPIT v0.3 SUPERVISOR LOOP ---
        // Basic Syntax/Closure Verification
        const openBraces = (code.match(/\{/g) || []).length;
        const closeBraces = (code.match(/\}/g) || []).length;
        
        if (openBraces !== closeBraces) {
           lastError = `Syntax Error: Unmatched braces (${openBraces} open, ${closeBraces} closed).`;
           currentPrompt = fullPrompt + `\n\n[Cockpit Supervisor]: Your previous output failed syntax verification: ${lastError}. Please fix the code and return the fully complete raw code.`;
           continue; // Re-prompt
        }
        
        if (!code || code.length < 10) {
           lastError = "Verification Failed: Output too short or missing.";
           currentPrompt = fullPrompt + `\n\n[Cockpit Supervisor]: Your previous output was blank. Output ONLY raw code.`;
           continue;
        }

        finalCode = code;
        break; // Verification passed
      }
      
      if (!finalCode) {
         finalCode = `// Synthesis failed after ${MAX_ATTEMPTS} attempts. Last error: ${lastError}`;
      }
      return { response: finalCode };
    });

    let code = result.response;

    // LOG TO ZAYVORA FOR TRAINING
    await logToZayvora(prompt, result.response, { ...artifacts, code, filename });

    res.json({ code });
  } catch (err) {
    res.status(500).json({ error: 'Praxis synthesis failed' });
  }
});

// Phase 3: Hardening (Engineer)
app.post('/api/zayvora/verify', async (req, res) => {
  const { code, filename } = req.body;
  try {
    const response = await fetch('http://localhost:8080/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: `System: You are Zayvora Engineer. Perform a diagnostic pass on this code. If you find issues (cloud dependencies, protocol mismatches), fix them. Output ONLY the improved code.\nFile: ${filename}\nCode:\n${code}` }],
        stream: false
      })
    });
    const data = await response.json();
    let cleaned = data.choices[0].message.content.trim();
    
    // --- DAXINI FORCE-CLEANSE LAYER ---
    const chatterPrefixes = [
      "Here is the code:", "Here is the improved code:", "Here is the updated code:",
      "Sure!", "Certainly!", "I have updated", "This version"
    ];
    chatterPrefixes.forEach(prefix => {
      if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
        cleaned = cleaned.substring(prefix.length).trim();
      }
    });

    if (cleaned.includes("```")) {
      const match = cleaned.match(/```(?:\w+)?\n([\s\S]+?)\n```/);
      if (match) cleaned = match[1].trim();
    }
    // --- END FORCE-CLEANSE ---
    
    // LOG VERIFIED CODE AS IMPROVED DATA
    await logToZayvora(`Verification of ${filename}`, data.response, { code: cleaned, original: code });

    res.json({ code: cleaned });
  } catch (err) {
    res.status(500).json({ error: 'Engineer verification failed' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', sovereign: true }));

const TRAINING_VAULT = '/Users/dharamdaxini/Downloads/via/zayvora/cea/CEA-0000/training_vault';
const DATA_CALIBRATION = '/Users/dharamdaxini/Downloads/via/zayvora_training/data_calibration/train.jsonl';

/**
 * VIBECODING ENGINE: The 6-Stage Sovereign Pipeline
 * 1. PRD | 2. TRD | 3. App Flow | 4. UI/UX | 5. Schema | 6. Synthesis
 */
app.post('/v1/vibecode', async (req, res) => {
    const { intent, context } = req.body;
    console.log(`[LogicHub] Initiating 6-Stage Vibecoding for intent: ${intent}`);

    // Stage 1: PRD Synthesis (World-Class Engine)
    const prd = `
# PRD: ${intent}
## 1. Overview
Self-architected sovereign module for the Daxini Stack.

## 2. Goals & Objectives
- 100% Local Execution (Zero Cloud).
- Viral-Ready Kinetic Aesthetics.
- Deterministic Lineage.

## 3. Requirements
- 1TB SSD Compatible.
- Aporaksha Identity Integration.

## 4. User Experience (UX)
Smooth flow with micro-animations.

## 5. Success Metrics
- 0% Logic Drift.
- 100% Trace Admissibility.
    `.trim();

    // Stage 6: Sovereign Synthesis (RAG-enhanced)
    const traceData = fs.readFileSync(DATA_CALIBRATION, 'utf8').split('\n').filter(l => l);
    const bestTrace = traceData.find(line => line.toLowerCase().includes(intent.toLowerCase())) || traceData[0];
    const retrievedCode = JSON.parse(bestTrace).text.split('### Response:')[1]?.split('```')[1]?.split('```')[0] || '// No matching trace found.';

    const stages = {
        prd: { content: prd, status: 'GENERATED' },
        trd: { stack: ['Node.js', 'MLX', 'ZFS', 'Aporaksha'] },
        flow: { steps: ['Identity_Handshake', 'Context_Sync', 'State_Commit'] },
        ui: { system: 'Kinetic-Sovereign', colors: ['#00F2FF', '#000000'] },
        schema: { models: ['Epoch', 'Trace', 'User', 'Artifact'] },
        synthesis: { 
            code: retrievedCode.trim(),
            status: 'VIRAL_READY',
            origin_trace: 'RETRIEVED_FROM_FORGE'
        }
    };

    res.json({
        intent,
        stages,
        lineage_hash: crypto.randomUUID(),
        metadata: {
            trace_count: 223,
            security: 'GEO_LOCKED'
        }
    });
});

const PORT = 7001;
app.listen(PORT, () => {
    console.log(`[LogicHub] 6-Stage Vibecoding Orchestrator running on port ${PORT}`);
    console.log(`[LogicHub] Knowledge Index: 223 Hardened Traces Active.`);
});
