import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { taskRoutes } from './routes/tasks';
import { auditRoutes } from './routes/audit';
import { registerGitHubRoutes } from './routes/github';
import { addSSEClient, removeSSEClient, emitTaskEvent, emitRunEvent, emitPulseEvent, startPulseEmitter } from './sseServer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildApp() {
  const fastify = Fastify({
    logger: true
  });

  // CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true
  });

  // API Routes
  await fastify.register(taskRoutes, { prefix: '/api/v1' });
  await fastify.register(auditRoutes, { prefix: '/api/v1' });
  await fastify.register(registerGitHubRoutes);

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // SSE endpoint
  fastify.get('/api/v1/events', (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Send connection message
    const clientId = addSSEClient(reply.raw);
    reply.raw.write(`data: ${JSON.stringify({ type: 'connected', clientId, timestamp: new Date().toISOString() })}\n\n`);

    // Handle disconnect
    request.raw.on('close', () => {
      removeSSEClient(clientId);
    });
  });

  // Test event endpoint
  fastify.post('/api/v1/test-event', async () => {
    emitTaskEvent('task:updated', {
      id: 'test',
      title: 'Test Task',
      status: 'InProgress',
      executionState: 'running',
      assignee: 'clawdbot',
      priority: 'Medium',
      tags: [],
      planChecklist: [],
      currentStepIndex: 0,
      progressLog: [],
      blockedBy: [],
      timeSpent: 0,
      needsApproval: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return { sent: true };
  });

  // Start the pulse emitter for countdown timer
  startPulseEmitter(emitPulseEvent);

  // Serve static files
  const webDistPath = path.join(__dirname, '../../web/dist');
  
  await fastify.register(fastifyStatic, {
    root: webDistPath,
    prefix: '/'
  });

  // SPA fallback
  fastify.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });

  return fastify;
}

// Export for use in other modules
export { emitTaskEvent, emitRunEvent };
export { addSSEClient, removeSSEClient, getClientCount } from './sseServer';

