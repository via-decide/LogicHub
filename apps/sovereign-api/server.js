import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Phase 1: Planning (Axiom)
app.post('/api/zayvora/plan', async (req, res) => {
  const { prompt, architecture } = req.body;
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        model: 'zayvora:axiom',
        prompt: `System: You are Zayvora Axiom, the Master Architect. Generate a technical PRD for this app.\nArchitecture: ${JSON.stringify(architecture)}\nPrompt: ${prompt}`,
        stream: false
      })
    });
    const data = await response.json();
    res.json({ prd: data.response });
  } catch (err) {
    res.status(500).json({ error: 'Axiom planning failed' });
  }
});

// Phase 2: Synthesis (Praxis)
app.post('/api/zayvora/synthesize', async (req, res) => {
  const { prompt, context, prd, filename, type } = req.body;
  try {
    const fullPrompt = `System: You are Zayvora Praxis, an expert Sovereign Engineer building ${filename} of type ${type}. Output ONLY raw code. No markdown.\n${prd ? `ARCHITECTURE PRD:\n${prd}\n` : ""}\nContext:\n${context}\n\nInstructions: ${prompt}`;
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        model: 'zayvora:praxis',
        prompt: fullPrompt,
        stream: false
      })
    });
    const data = await response.json();
    let code = data.response?.trim() || "";
    if (code.startsWith("```")) code = code.split('\n').slice(1, -1).join('\n');
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
    res.json({ code: cleaned });
  } catch (err) {
    res.status(500).json({ error: 'Engineer verification failed' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', sovereign: true }));

const PORT = 7001;
app.listen(PORT, () => {
  console.log(`
  🚀 LogicHub Sovereign API
  ─────────────────────────
  Port: ${PORT}
  Mode: Consolidated Handlers
  `);
});
