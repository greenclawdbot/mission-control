import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as stageSettingsService from '../services/stageSettingsService';

const querySchema = z.object({
  projectId: z.string().uuid().optional()
});

const projectParamsSchema = z.object({
  projectId: z.string().uuid()
});

const stageUpdateSchema = z.object({
  systemPrompt: z.string().nullable().optional(),
  defaultModel: z.string().nullable().optional(),
  planningDestinationStatus: z.string().nullable().optional(),
  readyInstructions: z.string().nullable().optional(),
  projectContextTemplate: z.string().nullable().optional()
});

const globalUpdateSchema = z.record(z.string(), stageUpdateSchema);
const projectUpdateSchema = z.record(z.string(), stageUpdateSchema);

export async function settingsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/v1/settings/stages?projectId= - Effective stage settings for a project (merged)
  fastify.get<{
    Querystring: z.infer<typeof querySchema>;
  }>('/settings/stages', async (request: FastifyRequest<{ Querystring: z.infer<typeof querySchema> }>, reply: FastifyReply) => {
    const { projectId } = request.query;
    const settings = await stageSettingsService.getEffectiveSettings(projectId);
    return { settings };
  });

  // GET /api/v1/settings/stages/global - All global stage rows
  fastify.get('/settings/stages/global', async (_request, reply: FastifyReply) => {
    const rows = await stageSettingsService.getGlobalStageSettings();
    return { settings: rows };
  });

  // PATCH /api/v1/settings/stages/global - Upsert global stage settings
  fastify.patch<{
    Body: z.infer<typeof globalUpdateSchema>;
  }>('/settings/stages/global', async (request: FastifyRequest<{ Body: z.infer<typeof globalUpdateSchema> }>, reply: FastifyReply) => {
    const body = globalUpdateSchema.parse(request.body);
    const settings = await stageSettingsService.updateGlobalStageSettings(body);
    return { settings };
  });

  // GET /api/v1/settings/stages/projects/:projectId - Project overrides
  fastify.get<{
    Params: z.infer<typeof projectParamsSchema>;
  }>('/settings/stages/projects/:projectId', async (request: FastifyRequest<{ Params: z.infer<typeof projectParamsSchema> }>, reply: FastifyReply) => {
    const rows = await stageSettingsService.getProjectStageOverrides(request.params.projectId);
    return { settings: rows };
  });

  // PATCH /api/v1/settings/stages/projects/:projectId - Upsert project overrides
  fastify.patch<{
    Params: z.infer<typeof projectParamsSchema>;
    Body: z.infer<typeof projectUpdateSchema>;
  }>('/settings/stages/projects/:projectId', async (request: FastifyRequest<{
    Params: z.infer<typeof projectParamsSchema>;
    Body: z.infer<typeof projectUpdateSchema>;
  }>, reply: FastifyReply) => {
    const body = projectUpdateSchema.parse(request.body);
    const settings = await stageSettingsService.updateProjectStageOverrides(request.params.projectId, body);
    return { settings };
  });
}
