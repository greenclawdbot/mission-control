import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as projectService from '../services/projectService';

const projectParamsSchema = z.object({
  id: z.string().uuid()
});

const querySchema = z.object({
  archived: z.enum(['true', 'false']).optional()
});

const createProjectSchema = z.object({
  name: z.string().min(1),
  folderPath: z.string().min(1),
  color: z.string().nullable().optional()
});

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  folderPath: z.string().min(1).optional(),
  color: z.string().nullable().optional()
});

const setPathSchema = z.object({
  folderPath: z.string().min(1)
});

export async function projectRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/v1/projects/task-counts - Task counts per project (key "none" = unassigned)
  fastify.get('/projects/task-counts', async (_request: FastifyRequest, reply: FastifyReply) => {
    const counts = await projectService.getProjectTaskCounts();
    return { counts };
  });

  // GET /api/v1/projects - List projects (non-archived by default)
  fastify.get<{
    Querystring: z.infer<typeof querySchema>;
  }>('/projects', async (request: FastifyRequest<{ Querystring: z.infer<typeof querySchema> }>, reply: FastifyReply) => {
    const { archived } = request.query;
    const list = await projectService.listProjects(
      archived === 'true' ? true : archived === 'false' ? false : undefined
    );
    return { projects: list };
  });

  // GET /api/v1/projects/:id - Get one project
  fastify.get<{
    Params: z.infer<typeof projectParamsSchema>;
  }>('/projects/:id', async (request: FastifyRequest<{ Params: z.infer<typeof projectParamsSchema> }>, reply: FastifyReply) => {
    const project = await projectService.getProjectById(request.params.id);
    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }
    return { project };
  });

  // POST /api/v1/projects - Create project
  fastify.post<{
    Body: z.infer<typeof createProjectSchema>;
  }>('/projects', async (request: FastifyRequest<{ Body: z.infer<typeof createProjectSchema> }>, reply: FastifyReply) => {
    const data = createProjectSchema.parse(request.body);
    const project = await projectService.createProject(data);
    return reply.status(201).send({ project });
  });

  // PATCH /api/v1/projects/:id - Update project (name and/or folderPath)
  fastify.patch<{
    Params: z.infer<typeof projectParamsSchema>;
    Body: z.infer<typeof updateProjectSchema>;
  }>('/projects/:id', async (request: FastifyRequest<{
    Params: z.infer<typeof projectParamsSchema>;
    Body: z.infer<typeof updateProjectSchema>;
  }>, reply: FastifyReply) => {
    const project = await projectService.updateProject(request.params.id, request.body);
    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }
    return { project };
  });

  // PUT /api/v1/projects/:id/path - Set folder path only
  fastify.put<{
    Params: z.infer<typeof projectParamsSchema>;
    Body: z.infer<typeof setPathSchema>;
  }>('/projects/:id/path', async (request: FastifyRequest<{
    Params: z.infer<typeof projectParamsSchema>;
    Body: z.infer<typeof setPathSchema>;
  }>, reply: FastifyReply) => {
    const { folderPath } = setPathSchema.parse(request.body);
    const project = await projectService.setProjectPath(request.params.id, folderPath);
    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }
    return { project };
  });

  // DELETE /api/v1/projects/:id - Archive project (soft delete)
  fastify.delete<{
    Params: z.infer<typeof projectParamsSchema>;
  }>('/projects/:id', async (request: FastifyRequest<{ Params: z.infer<typeof projectParamsSchema> }>, reply: FastifyReply) => {
    const project = await projectService.archiveProject(request.params.id);
    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }
    return { project };
  });
}
