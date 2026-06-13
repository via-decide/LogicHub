import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

const PORT = process.env.PORT || 3002;
const wss = new WebSocketServer({ port: PORT });

console.log(`[WebSocket Gateway] Active on port ${PORT}`);

// Maintain active project connections
// Map<projectId, Set<WebSocket>>
const projectChannels = new Map();

/**
 * Handle new WebSocket connections from the LogicHub Builder client
 */
wss.on('connection', (ws, req) => {
  console.log('[WebSocket Gateway] New client connected');

  ws.on('message', (messageAsString) => {
    try {
      const payload = JSON.parse(messageAsString);

      // 1. Authentication & Subscription
      if (payload.action === 'subscribe') {
        const { projectId, ecosystemUid } = payload;
        // In a real system, we'd validate the ecosystemUid/token here
        
        if (!projectChannels.has(projectId)) {
          projectChannels.set(projectId, new Set());
        }
        projectChannels.get(projectId).add(ws);
        
        console.log(`[WebSocket Gateway] Client subscribed to project: ${projectId}`);
        ws.send(JSON.stringify({ event: 'subscribed', projectId }));
      }
      
      // 2. Internal Broadcasts (from Analyzer/Upgrade Workers)
      else if (payload.action === 'internal_broadcast') {
        // Prevent external clients from faking internal broadcasts
        // In production, require a shared secret or internal-only port
        const { projectId, event, data } = payload;
        broadcastToProject(projectId, event, data);
      }

    } catch (e) {
      console.error('[WebSocket Gateway] Malformed message', e);
    }
  });

  ws.on('close', () => {
    // Cleanup disconnected clients
    for (const [projectId, clients] of projectChannels.entries()) {
      clients.delete(ws);
      if (clients.size === 0) {
        projectChannels.delete(projectId);
      }
    }
    console.log('[WebSocket Gateway] Client disconnected');
  });
});

/**
 * Broadcast an event to all clients subscribed to a specific project
 * Supports the contracts: analysis.started, analysis.progress, upgrade.completed, etc.
 */
export function broadcastToProject(projectId, eventName, payload) {
  const clients = projectChannels.get(projectId);
  if (!clients) return; // No active listeners

  const message = JSON.stringify({
    event: eventName,
    projectId: projectId,
    timestamp: new Date().toISOString(),
    data: payload
  });

  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  }
}

// Example usage to be called by worker scripts or Redis pub/sub handlers:
// broadcastToProject('proj_123', 'analysis.progress', { step: 'Extracting metadata', percent: 45 });
// broadcastToProject('proj_123', 'upgrade.started', { targetVersion: 'v2.0.0' });
