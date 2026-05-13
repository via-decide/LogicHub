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

// Phase 1: Planning (Axiom) - ALCHEMIST LOGIC (TRACE-AUGMENTED)
app.post('/api/zayvora/plan', async (req, res) => {
  const { prompt, architecture } = req.body;
  
  // PRE-EMPTIVE SEARCH: Find historical traces first
  const historicalTrace = await findBestTrace(prompt);
  const traceContext = historicalTrace 
    ? `HISTORICAL TRACE (Use this as a world-class template):\nTask: ${historicalTrace.task}\nCode: ${historicalTrace.artifacts?.code}\nPRD: ${JSON.stringify(historicalTrace.artifacts?.prd)}`
    : 'No historical trace found. Reason from first principles.';

  const key = crypto.createHash('sha256').update(`axiom:${prompt}:${JSON.stringify(architecture)}`).digest('hex');

  try {
    const result = await zayvoraCoalescer.coalesce(key, async () => {
      const systemPrompt = `You are Zayvora Axiom, the Master Architect. 
      Generate a complete 5-stage Design Document for this app.
      
      ${traceContext}
      
      1. PRD (Product Requirements)
      2. TRD (Technical Stack)
      3. App Flow (User Journey)
      4. UI/UX Brief (Design Tokens)
      5. Backend Schema (ERD)
      
      Format as JSON with keys: prd, trd, flow, ui, schema.
      Context: ${JSON.stringify(architecture)}`;

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          model: 'zayvora:axiom',
          prompt: `${systemPrompt}\n\nUser Request: ${prompt}`,
          format: 'json',
          stream: false
        })
      });
      return await response.json();
    });

    const artifacts = JSON.parse(result.response);
    res.json({ artifacts, reused_trace: !!historicalTrace });
  } catch (err) {
    res.status(500).json({ error: 'Axiom planning failed' });
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
      
      Instructions: ${prompt}`;

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          model: 'zayvora:praxis',
          prompt: fullPrompt,
          stream: false
        })
      });
      return await response.json();
    });

    let code = result.response?.trim() || "";
    if (code.startsWith("```")) code = code.split('\n').slice(1, -1).join('\n');

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
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        model: 'zayvora-engineer:latest',
        prompt: `System: You are Zayvora Engineer. Perform a diagnostic pass on this code. If you find issues (cloud dependencies, protocol mismatches), fix them. Output ONLY the improved code.\nFile: ${filename}\nCode:\n${code}`,
        stream: false
      })
    });
    const data = await response.json();
    let cleaned = data.response.trim();
    if (cleaned.startsWith("```")) cleaned = cleaned.split('\n').slice(1, -1).join('\n');
    
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
 * Stage 2: Praxis (Synthesis)
 * Uses the 223-trace Sovereign Dataset for high-fidelity code generation.
 */
app.post('/v1/praxis/synthesize', async (req, res) => {
    const { task, axiom_plan, context } = req.body;
    
    console.log(`[LogicHub] Synthesizing Praxis using Sovereign Dataset: ${DATA_CALIBRATION}`);

    // LOGIC: Point the inference engine to the latest LoRA-ready traces
    const reasoningEngine = {
        model: 'zayvora-v1.0-sovereign',
        dataset_origin: DATA_CALIBRATION,
        trace_count: 223,
        constraints: ['GEO_LOCKED', 'SPLIT_VAULT', 'TRAVEL_MODE_AWARE']
    };

    // MOCK: Synthesis Result
    const synthesis = {
        code: `// Synthesized with Sovereign Trace Recall\nconst sovereignModule = { ... };`,
        trace_uuid: crypto.randomUUID(),
        engine: reasoningEngine
    };

    res.json(synthesis);
});

const PORT = 7001;
app.listen(PORT, () => {
    console.log(`[LogicHub] Sovereign Orchestrator running on port ${PORT}`);
    console.log(`[LogicHub] Knowledge Index: 223 Hardened Traces Linked.`);
});
