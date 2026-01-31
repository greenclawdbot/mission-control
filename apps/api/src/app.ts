import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { taskRoutes } from './routes/tasks';
import { auditRoutes } from './routes/audit';
import { emitTaskEvent, emitRunEvent } from './sseServer';

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

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
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

  // Serve static files from web/dist
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

// Export for use in taskService
export { emitTaskEvent, emitRunEvent };

