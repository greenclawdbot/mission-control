import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as auditService from '../services/auditService';

const querySchema = z.object({
  entityType: z.string().optional(),
  actor: z.string().optional(),
  eventType: z.string().optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val) : undefined)
});

const taskParamsSchema = z.object({
  id: z.string().uuid()
});

export async function auditRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/audit - List all audit events
  fastify.get<{
    Querystring: z.infer<typeof querySchema>;
  }>('/audit', async (request: FastifyRequest<{ Querystring: z.infer<typeof querySchema> }>, reply: FastifyReply) => {
    const { entityType, actor, eventType, limit } = querySchema.parse(request.query);

    const events = await auditService.getAllAuditEvents({
      entityType,
      actor,
      eventType,
      limit
    });

    return { events: events.map(e => ({
      ...e,
      timestamp: e.timestamp.toISOString()
    })) };
  });

  // GET /api/tasks/:id/events - Get audit events for a task
  fastify.get<{
    Params: z.infer<typeof taskParamsSchema>;
  }>('/tasks/:id/events', async (request: FastifyRequest<{ Params: z.infer<typeof taskParamsSchema> }>, reply: FastifyReply) => {
    const events = await auditService.getTaskAuditEvents(request.params.id);

    return { events: events.map(e => ({
      ...e,
      timestamp: e.timestamp.toISOString()
    })) };
  });
}
