import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { ApkEngine } from '../src/ingestion/apk-engine.js';
import { ZipEngine } from '../src/ingestion/zip-engine.js';
import { GitHubEngine } from '../src/ingestion/github-engine.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { trackEvent, ANALYTICS_EVENTS } from '../api/_analyticsService.js';

const execAsync = promisify(exec);

// Native Aporaksha Auth via via-auth-sdk mapping concept
// Since this is the backend, we intercept the JWT/ecosystem_uid manually
const prisma = new PrismaClient();
const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Ecosystem-Uid', 'X-Requested-With']
}));
app.use(express.json({ limit: '500mb' }));

/**
 * Middleware: Verify ViaAuthSDK JWT/ecosystem_uid securely against Aporaksha IdP
 */
const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const ecosystemUid = req.headers['x-ecosystem-uid'];
  
  if (!token || !ecosystemUid) {
    return res.status(401).json({ error: 'Missing ViaAuth credentials' });
  }

  try {
    // Secure verification via Aporaksha IdP
    const verifyRes = await fetch('https://aporaksha.com/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ action: 'validate' })
    });

    if (!verifyRes.ok) {
      const errData = await verifyRes.json();
      return res.status(403).json({ error: 'Invalid identity', details: errData });
    }

    const { valid, ecosystem_uid: verifiedUid } = await verifyRes.json();

    if (!valid || verifiedUid !== ecosystemUid) {
      return res.status(403).json({ error: 'Identity verification failed' });
    }

    // Upsert builder into local Postgres using ecosystem_uid
    const builder = await prisma.builder.upsert({
      where: { ecosystem_uid: ecosystemUid },
      update: {},
      create: { ecosystem_uid: ecosystemUid }
    });
    
    req.builder = builder;
    next();
  } catch (e) {
    console.error('[Auth] Verification Error:', e);
    res.status(500).json({ error: 'Internal Identity Error' });
  }
};

// ---------------------------------------------------------
// MODULE 7: ZAYVORA REST API Endpoints
// ---------------------------------------------------------

/**
 * POST /api/v1/reason
 * Direct raw reasoning endpoint to the Zayvora Python Engine
 */
app.post('/api/v1/reason', requireAuth, async (req, res) => {
  const { context, prompt } = req.body;
  
  // Note: In a real system, this would HTTP POST to the local Zayvora Python Engine (Port 3001)
  // For implementation architecture, we mock the local IPC relay.
  res.json({
    success: true,
    upgradePlan: `Mocked Zayvora Plan for: ${prompt.substring(0, 50)}...`
  });
});

/**
 * POST /api/v1/project/analyze
 * Async ingestion trigger
 */
app.post('/api/v1/project/analyze', requireAuth, async (req, res) => {
  const { sourceType, sourcePayload } = req.body; // sourceType: 'APK', 'ZIP', 'GITHUB'
  const userId = req.builder.ecosystem_uid;

  // 1. Create Project Record
  const project = await prisma.project.create({
    data: {
      builderId: req.builder.id,
      name: 'Importing Project...',
      sourceType: sourceType,
      status: 'ANALYZING',
      memoryContext: ''
    }
  });

  // 2. Analytics: project_created + source-type import event
  await trackEvent(ANALYTICS_EVENTS.PROJECT_CREATED, {
    userId,
    projectId: project.id,
    metadata: { sourceType },
  });
  const importEventMap = {
    APK:    ANALYTICS_EVENTS.APK_UPLOADED,
    ZIP:    ANALYTICS_EVENTS.ZIP_UPLOADED,
    GITHUB: ANALYTICS_EVENTS.GITHUB_IMPORTED,
  };
  if (importEventMap[sourceType]) {
    await trackEvent(importEventMap[sourceType], {
      userId,
      projectId: project.id,
      metadata: { sourceType },
    });
  }

  // 3. Offload to background worker via Redis/BullMQ or internal async
  // Emitting to WebSocket Gateway happens inside the worker
  console.log(`[API] Queuing analysis for project ${project.id} via ${sourceType}`);
  
  res.json({ success: true, projectId: project.id, status: 'ANALYZING' });
});

/**
 * POST /api/v1/project/upgrade
 * Triggers version generation
 */
app.post('/api/v1/project/upgrade', requireAuth, async (req, res) => {
  const { projectId, prompt } = req.body;
  
  if (projectId === 'mars_hex_01') {
    console.log(`[API] Queuing Zayvora Upgrade for Mars Simulation HEX-01 with prompt: ${prompt}`);
    try {
      const pyPath = path.resolve(__dirname, '../../daxini.space/bundle_zay.py');
      const { stdout } = await execAsync(`python3 ${pyPath}`);
      console.log('[Zayvora Engine] Executed local python backend bundle_zay.py for Mars:', stdout.trim());
    } catch (e) {
      console.error('[Zayvora Engine] Failed to execute bundle_zay.py for Mars:', e.message);
    }
    return res.json({ success: true, projectId, status: 'UPGRADING' });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Update status
  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'UPGRADING' }
  });

  // Dispatch to Zayvora Python Engine + Worker
  console.log(`[API] Queuing Zayvora Upgrade for ${projectId} with prompt: ${prompt}`);
  
  // Wire directly to the local Python engine (bundle_zay.py) as requested
  try {
    const pyPath = path.resolve(__dirname, '../../daxini.space/bundle_zay.py');
    const { stdout } = await execAsync(`python3 ${pyPath}`);
    console.log('[Zayvora Engine] Executed local python backend bundle_zay.py:', stdout.trim());
  } catch (e) {
    console.error('[Zayvora Engine] Failed to execute bundle_zay.py:', e.message);
  }

  res.json({ success: true, projectId, status: 'UPGRADING' });
});

/**
 * POST /api/v1/project/diff
 * Calculates change delta between two versions
 */
app.post('/api/v1/project/diff', requireAuth, async (req, res) => {
  const { versionA, versionB } = req.body;
  // Diff Engine logic mocked
  res.json({
    added: ['Chat Module', 'Offline Sync'],
    removed: ['Legacy Redux'],
    modified: ['Auth Flow'],
    riskScore: 72
  });
});

/**
 * POST /api/v1/project/version
 * Creates a discrete history snapshot
 */
app.post('/api/v1/project/version', requireAuth, async (req, res) => {
  const { projectId, versionCode, versionName, architectureMap, dependencyGraph, featureMap } = req.body;
  
  const version = await prisma.version.create({
    data: {
      projectId,
      versionCode,
      versionName,
      architectureMap,
      dependencyGraph,
      featureMap
    }
  });

  res.json({ success: true, versionId: version.id });
});

/**
 * POST /api/v1/project/chat
 * Streams contextual advice based on Project Memory
 */
app.post('/api/v1/project/chat', requireAuth, async (req, res) => {
  const { projectId, message } = req.body;
  
  // Set headers for SSE streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  
  res.write(`data: ${JSON.stringify({ chunk: `I see your architecture has ${project.memoryContext ? 'context' : 'no context yet'}. ` })}\n\n`);
  
  setTimeout(() => {
    res.write(`data: ${JSON.stringify({ chunk: `Regarding "${message}", consider upgrading your dependencies.` })}\n\n`);
    res.end();
  }, 1000);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[LogicHub API] Active on port ${PORT}`);
});
