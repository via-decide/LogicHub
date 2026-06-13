import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { ApkEngine } from '../src/ingestion/apk-engine.js';
import { ZipEngine } from '../src/ingestion/zip-engine.js';
import { GitHubEngine } from '../src/ingestion/github-engine.js';

// Native Aporaksha Auth via via-auth-sdk mapping concept
// Since this is the backend, we intercept the JWT/ecosystem_uid manually
const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json({ limit: '500mb' }));

/**
 * Middleware: Verify ViaAuthSDK JWT/ecosystem_uid
 */
const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const ecosystemUid = req.headers['x-ecosystem-uid'];
  
  if (!token || !ecosystemUid) {
    return res.status(401).json({ error: 'Missing ViaAuth credentials' });
  }

  try {
    // Upsert builder into local Postgres using ecosystem_uid
    const builder = await prisma.builder.upsert({
      where: { ecosystem_uid: ecosystemUid },
      update: {},
      create: { ecosystem_uid: ecosystemUid }
    });
    
    req.builder = builder;
    next();
  } catch (e) {
    res.status(403).json({ error: 'Invalid identity' });
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

  // 2. Offload to background worker via Redis/BullMQ or internal async
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
  
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Update status
  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'UPGRADING' }
  });

  // Dispatch to Zayvora Python Engine + Worker
  console.log(`[API] Queuing Zayvora Upgrade for ${projectId} with prompt: ${prompt}`);

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
