import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import path from 'path';
import { fileURLToPath } from 'url';
import { taskRoutes } from './routes/tasks';
import { auditRoutes } from './routes/audit';
import { handleWebSocketConnection } from './wsServer';

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

  // WebSocket support
  await fastify.register(fastifyWebsocket);
  fastify.get('/api/v1/ws', { websocket: true }, (socket, request) => {
    handleWebSocketConnection(socket);
  });

  // API Routes
  await fastify.register(taskRoutes, { prefix: '/api/v1' });
  await fastify.register(auditRoutes, { prefix: '/api/v1' });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Serve static files from web/dist
  const webDistPath = path.join(__dirname, '../../web/dist');
  
  await fastify.register(fastifyStatic, {
    root: webDistPath,
    prefix: '/'
  });

  // SPA fallback - serve index.html for non-API routes
  fastify.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });

  return fastify;
}
