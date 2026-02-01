import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as taskService from '../services/taskService';
import * as stageSettingsService from '../services/stageSettingsService';
import prisma from '../db/client';
import { Task, TaskStatus, ExecutionState, CreateTaskInput, UpdateTaskInput } from '@shared/src/types';
import { emitTaskEvent } from '../sseServer';

const DEFAULT_MODEL = 'minimax';

const taskParamsSchema = z.object({
  id: z.string().uuid()
});

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assignee: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  tags: z.array(z.string()).optional(),
  estimate: z.number().optional(),
  dueDate: z.string().optional(),
  planChecklist: z.array(z.string()).optional(),
  needsApproval: z.boolean().optional(),
  blockedBy: z.array(z.string()).optional(),
  projectId: z.string().uuid().nullable().optional()
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['New', 'Planning', 'Backlog', 'Ready', 'InProgress', 'Blocked', 'Review', 'Failed', 'Done']).optional(),
  executionState: z.enum(['queued', 'running', 'waiting', 'idle', 'failed', 'completed']).optional(),
  assignee: z.string().optional(),
  sessionKey: z.string().nullable().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  tags: z.array(z.string()).optional(),
  planChecklist: z.array(z.string()).optional(),
  currentStepIndex: z.number().optional(),
  blockedReason: z.string().optional(),
  blockedBy: z.array(z.string()).optional(),
  estimate: z.number().optional(),
  timeSpent: z.number().optional(),
  dueDate: z.string().optional(),
  needsApproval: z.boolean().optional(),
  approvedAt: z.string().optional(),
  approvedBy: z.string().optional(),
  results: z.string().optional(),
  botRunId: z.string().uuid().optional(),
  projectId: z.string().uuid().nullable().optional(),
  commits: z.array(z.object({
    sha: z.string(),
    message: z.string(),
    url: z.string().optional(),
    timestamp: z.string()
  })).optional()
});

const moveTaskSchema = z.object({
  status: z.enum(['New', 'Planning', 'Backlog', 'Ready', 'InProgress', 'Blocked', 'Review', 'Failed', 'Done'])
});

const querySchema = z.object({
  status: z.enum(['New', 'Planning', 'Backlog', 'Ready', 'InProgress', 'Blocked', 'Review', 'Failed', 'Done']).optional(),
  executionState: z.enum(['queued', 'running', 'waiting', 'idle', 'failed', 'completed']).optional(),
  assignee: z.string().optional(),
  priority: z.string().optional(),
  tags: z.string().optional(),
  projectId: z.union([z.string().uuid(), z.literal('none')]).optional()
});

export async function taskRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/tasks - List all tasks
  fastify.get<{
    Querystring: z.infer<typeof querySchema>;
  }>('/tasks', async (request: FastifyRequest<{ Querystring: z.infer<typeof querySchema> }>, reply: FastifyReply) => {
    const { status, executionState, assignee, priority, tags, projectId } = request.query;

    const tasks = await taskService.getAllTasks({
      status,
      executionState,
      assignee,
      priority,
      tags,
      projectId
    });

    return { tasks };
  });

  // GET /api/tasks/planning-items - List tasks in Planning for external polling (no claiming)
  const planningItemsQuerySchema = z.object({
    projectId: z.string().uuid().optional()
  });
  fastify.get<{
    Querystring: z.infer<typeof planningItemsQuerySchema>;
  }>('/tasks/planning-items', async (request: FastifyRequest<{ Querystring: z.infer<typeof planningItemsQuerySchema> }>, reply: FastifyReply) => {
    const { projectId } = planningItemsQuerySchema.parse(request.query);
    const where: { status: string; projectId?: string | null } = { status: 'Planning' };
    if (projectId) where.projectId = projectId;
    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        progressLog: { orderBy: { completedAt: 'desc' } },
        project: true
      }
    });
    const defaultContextTemplate = 'This task is for the project called {{projectName}} in the folder {{folderPath}}. Please work on that project only in that folder for this request unless otherwise specified.';
    const items = await Promise.all(tasks.map(async (t) => {
      const mapped = taskService.mapPrismaTaskToTask(t as Parameters<typeof taskService.mapPrismaTaskToTask>[0]);
      const settings = await stageSettingsService.getEffectiveSettingForStage('Planning', t.projectId);
      const workFolder = t.project && !t.project.archivedAt ? t.project.folderPath : null;
      const projectName = t.project && !t.project.archivedAt ? t.project.name : null;
      const model = settings.defaultModel && settings.defaultModel !== DEFAULT_MODEL ? settings.defaultModel : undefined;
      const planningMessages = await taskService.getPlanningConversationForTask(t.id);
      const planningConversationForPrompt =
        planningMessages.length === 0
          ? `Task: ${t.title}\n\nPlanning conversation so far:\n(no messages yet)`
          : `Task: ${t.title}\n\nPlanning conversation so far:\n${planningMessages.map((m) => `[${m.role}] (${m.createdAt}):\n${m.content}`).join('\n\n')}`;
      let planningPrompt: string | null = settings.systemPrompt ?? null;
      if (t.project && !t.project.archivedAt) {
        const template = (settings.projectContextTemplate && settings.projectContextTemplate.trim()) || defaultContextTemplate;
        const contextParagraph = template
          .replace(/\{\{projectName\}\}/g, t.project.name)
          .replace(/\{\{folderPath\}\}/g, t.project.folderPath);
        planningPrompt = contextParagraph.trim() + (settings.systemPrompt ? '\n\n' + settings.systemPrompt : '');
      }
      return {
        task: mapped,
        planningPrompt,
        planningConversationForPrompt,
        planningConversation: planningMessages,
        workFolder,
        ...(projectName != null && { projectName }),
        ...(model && { model })
      };
    }));
    return { items };
  });

  // POST /api/tasks/:id/planning-complete - External system sends plan; move task to configurable destination
  // Plan text: canonical field is "plan". Aliases accepted: planning, notes, planning_notes, findings (first non-empty wins).
  const planningCompleteSchema = z.object({
    plan: z.string().optional(),
    planning: z.string().optional(),
    notes: z.string().optional(),
    planning_notes: z.string().optional(),
    findings: z.string().optional(),
    planChecklist: z.array(z.string()).optional()
  });
  fastify.post<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: z.infer<typeof planningCompleteSchema>;
  }>('/tasks/:id/planning-complete', async (request: FastifyRequest<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: z.infer<typeof planningCompleteSchema>;
  }>, reply: FastifyReply) => {
    const body = planningCompleteSchema.parse(request.body);
    const planText = [body.plan, body.planning, body.notes, body.planning_notes, body.findings]
      .find((s): s is string => typeof s === 'string' && s.trim() !== '');
    const planChecklist = body.planChecklist;
    const taskId = request.params.id;
    const task = await taskService.getTaskById(taskId);
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }
    if (planText != null) {
      await taskService.appendPlanningAssistantMessage(taskId, planText.trim());
    }
    const settings = await stageSettingsService.getEffectiveSettingForStage('Planning', task.projectId);
    const destination = settings.planningDestinationStatus || 'Backlog';
    const updatePayload: { status: TaskStatus; planChecklist?: string[] } = { status: destination as TaskStatus };
    if (planChecklist != null) updatePayload.planChecklist = planChecklist;
    const updated = await taskService.updateTask(taskId, updatePayload, 'clawdbot');
    if (!updated) {
      return reply.status(404).send({ error: 'Task not found' });
    }
    // Return freshly fetched task so response includes planDocument (and any other DB state)
    const taskForResponse = await taskService.getTaskById(taskId);
    return { task: taskForResponse ?? updated };
  });

  // GET /api/tasks/:id - Get single task
  fastify.get<{
    Params: z.infer<typeof taskParamsSchema>;
  }>('/tasks/:id', async (request: FastifyRequest<{ Params: z.infer<typeof taskParamsSchema> }>, reply: FastifyReply) => {
    const task = await taskService.getTaskById(request.params.id);

    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    return { task };
  });

  // GET /api/tasks/:id/prompt-preview - Dev: exact API payload LLM would see for this task in a given stage (no side effects)
  const promptPreviewQuerySchema = z.object({
    stage: z.enum(['New', 'Planning', 'Backlog', 'Ready', 'InProgress', 'Blocked', 'Review', 'Failed', 'Done'])
  });
  fastify.get<{
    Params: z.infer<typeof taskParamsSchema>;
    Querystring: z.infer<typeof promptPreviewQuerySchema>;
  }>('/tasks/:id/prompt-preview', async (request: FastifyRequest<{
    Params: z.infer<typeof taskParamsSchema>;
    Querystring: z.infer<typeof promptPreviewQuerySchema>;
  }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { stage } = promptPreviewQuerySchema.parse(request.query);

    const taskRow = await prisma.task.findUnique({
      where: { id },
      include: {
        progressLog: { orderBy: { completedAt: 'desc' } },
        project: true
      }
    });
    if (!taskRow) {
      return reply.status(404).send({ error: 'Task not found' });
    }
    const mapped = taskService.mapPrismaTaskToTask(taskRow as Parameters<typeof taskService.mapPrismaTaskToTask>[0]);

    const defaultContextTemplate = 'This task is for the project called {{projectName}} in the folder {{folderPath}}. Please work on that project only in that folder for this request unless otherwise specified.';

    if (stage === 'Planning') {
      const settings = await stageSettingsService.getEffectiveSettingForStage('Planning', taskRow.projectId);
      const workFolder = taskRow.project && !taskRow.project.archivedAt ? taskRow.project.folderPath : null;
      const projectName = taskRow.project && !taskRow.project.archivedAt ? taskRow.project.name : null;
      const model = settings.defaultModel && settings.defaultModel !== DEFAULT_MODEL ? settings.defaultModel : undefined;
      const planningMessages = await taskService.getPlanningConversationForTask(id);
      const planningConversationForPrompt =
        planningMessages.length === 0
          ? `Task: ${taskRow.title}\n\nPlanning conversation so far:\n(no messages yet)`
          : `Task: ${taskRow.title}\n\nPlanning conversation so far:\n${planningMessages.map((m) => `[${m.role}] (${m.createdAt}):\n${m.content}`).join('\n\n')}`;
      let planningPrompt: string | null = settings.systemPrompt ?? null;
      if (taskRow.project && !taskRow.project.archivedAt) {
        const template = (settings.projectContextTemplate && settings.projectContextTemplate.trim()) || defaultContextTemplate;
        const contextParagraph = template
          .replace(/\{\{projectName\}\}/g, taskRow.project.name)
          .replace(/\{\{folderPath\}\}/g, taskRow.project.folderPath);
        planningPrompt = contextParagraph.trim() + (settings.systemPrompt ? '\n\n' + settings.systemPrompt : '');
      }
      return {
        task: mapped,
        planningPrompt,
        planningConversationForPrompt,
        planningConversation: planningMessages,
        workFolder,
        ...(projectName != null && { projectName }),
        ...(model && { model })
      };
    }

    if (stage === 'Ready') {
      const readySettings = await stageSettingsService.getEffectiveSettingForStage('Ready', taskRow.projectId);
      const readyInstructions = readySettings.readyInstructions ?? readySettings.systemPrompt ?? null;
      const workFolder = taskRow.project && !taskRow.project.archivedAt ? taskRow.project.folderPath : null;
      const projectName = taskRow.project && !taskRow.project.archivedAt ? taskRow.project.name : null;
      const model = readySettings.defaultModel && readySettings.defaultModel !== DEFAULT_MODEL ? readySettings.defaultModel : undefined;
      let readyPrompt: string | null = readyInstructions;
      if (taskRow.project && !taskRow.project.archivedAt) {
        const template = (readySettings.projectContextTemplate && readySettings.projectContextTemplate.trim()) || defaultContextTemplate;
        const contextParagraph = template
          .replace(/\{\{projectName\}\}/g, taskRow.project.name)
          .replace(/\{\{folderPath\}\}/g, taskRow.project.folderPath);
        readyPrompt = contextParagraph.trim() + (readyInstructions ? '\n\n' + readyInstructions : '');
      }
      const messages = await taskService.getConversationForTask(id);
      const conversationBlock =
        messages.length === 0
          ? `Task: ${taskRow.title}\n\nConversation so far:\n(no messages yet)`
          : `Task: ${taskRow.title}\n\nConversation so far:\n${messages.map((m) => `[${m.role}] (${m.createdAt}):\n${m.content}`).join('\n\n')}`;
      return {
        task: mapped,
        action: 'preview',
        readyPrompt,
        conversationForPrompt: conversationBlock,
        conversation: messages,
        planDocument: taskRow.planDocument ?? null,
        workFolder,
        ...(projectName != null && { projectName }),
        ...(model && { model })
      };
    }

    // Other stages: composite context (no dedicated LLM endpoint)
    const conversation = await taskService.getConversationForTask(id);
    const planningConversation = await taskService.getPlanningConversationForTask(id);
    return {
      task: mapped,
      conversation,
      planningConversation,
      note: 'No dedicated LLM endpoint for this stage. Shown: task + conversation + planning conversation.'
    };
  });

  // GET /api/tasks/:id/conversation - Get conversation messages for a task
  fastify.get<{
    Params: z.infer<typeof taskParamsSchema>;
  }>('/tasks/:id/conversation', async (request: FastifyRequest<{ Params: z.infer<typeof taskParamsSchema> }>, reply: FastifyReply) => {
    const task = await taskService.getTaskById(request.params.id);
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }
    const messages = await taskService.getConversationForTask(request.params.id);
    return { messages };
  });

  // POST /api/tasks/:id/conversation - Append a user message to the conversation
  const postConversationSchema = z.object({
    content: z.string().min(1)
  });
  fastify.post<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: z.infer<typeof postConversationSchema>;
  }>('/tasks/:id/conversation', async (request: FastifyRequest<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: z.infer<typeof postConversationSchema>;
  }>, reply: FastifyReply) => {
    const task = await taskService.getTaskById(request.params.id);
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }
    const { content } = postConversationSchema.parse(request.body);
    const message = await taskService.appendUserMessage(request.params.id, content);
    return reply.status(201).send({ message });
  });

  // GET /api/tasks/:id/planning-conversation - Get planning conversation messages for a task
  fastify.get<{
    Params: z.infer<typeof taskParamsSchema>;
  }>('/tasks/:id/planning-conversation', async (request: FastifyRequest<{ Params: z.infer<typeof taskParamsSchema> }>, reply: FastifyReply) => {
    const task = await taskService.getTaskById(request.params.id);
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }
    const messages = await taskService.getPlanningConversationForTask(request.params.id);
    return { messages };
  });

  // POST /api/tasks/:id/planning-conversation - Append a user message to the planning conversation; if task is not in Planning, move to Planning to queue for planner
  const postPlanningConversationSchema = z.object({
    content: z.string().min(1)
  });
  fastify.post<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: z.infer<typeof postPlanningConversationSchema>;
  }>('/tasks/:id/planning-conversation', async (request: FastifyRequest<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: z.infer<typeof postPlanningConversationSchema>;
  }>, reply: FastifyReply) => {
    const task = await taskService.getTaskById(request.params.id);
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }
    const { content } = postPlanningConversationSchema.parse(request.body);
    const message = await taskService.appendPlanningUserMessage(request.params.id, content);
    if (task.status !== 'Planning') {
      await taskService.updateTask(request.params.id, { status: 'Planning' }, 'human');
    }
    return reply.status(201).send({ message });
  });

  // POST /api/tasks - Create task
  fastify.post<{
    Body: z.infer<typeof createTaskSchema>;
  }>('/tasks', async (request: FastifyRequest<{ Body: z.infer<typeof createTaskSchema> }>, reply: FastifyReply) => {
    const data = createTaskSchema.parse(request.body);
    const task = await taskService.createTask(data as CreateTaskInput);
    return reply.status(201).send({ task });
  });

  // PATCH /api/tasks/:id - Update task
  fastify.patch<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: z.infer<typeof updateTaskSchema>;
  }>('/tasks/:id', async (request: FastifyRequest<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: z.infer<typeof updateTaskSchema>;
  }>, reply: FastifyReply) => {
    const task = await taskService.updateTask(
      request.params.id,
      request.body as UpdateTaskInput
    );

    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    return { task };
  });

  // PUT /api/tasks/:id/move - Move task between columns
  fastify.put<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: z.infer<typeof moveTaskSchema>;
  }>('/tasks/:id/move', async (request: FastifyRequest<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: z.infer<typeof moveTaskSchema>;
  }>, reply: FastifyReply) => {
    const task = await taskService.moveTask(
      request.params.id,
      request.body.status
    );

    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    return { task };
  });

  // DELETE /api/tasks/:id - Delete task
  fastify.delete<{
    Params: z.infer<typeof taskParamsSchema>;
  }>('/tasks/:id', async (request: FastifyRequest<{ Params: z.infer<typeof taskParamsSchema> }>, reply: FastifyReply) => {
    const deleted = await taskService.deleteTask(request.params.id, 'human');

    if (!deleted) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    return reply.status(204).send();
  });

  // POST /api/tasks/:id/heartbeat - Bot heartbeat
  fastify.post<{
    Params: z.infer<typeof taskParamsSchema>;
  }>('/tasks/:id/heartbeat', async (request: FastifyRequest<{ Params: z.infer<typeof taskParamsSchema> }>, reply: FastifyReply) => {
    const task = await taskService.updateHeartbeat(request.params.id);

    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    return { task };
  });

  // POST /api/tasks/:id/progress - Log bot progress
  fastify.post<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: { step: string; status: 'pending' | 'running' | 'done' | 'failed' | 'skipped' };
  }>('/tasks/:id/progress', async (request: FastifyRequest<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: { step: string; status: 'pending' | 'running' | 'done' | 'failed' | 'skipped' };
  }>, reply: FastifyReply) => {
    const task = await taskService.logProgress(
      request.params.id,
      request.body.step,
      request.body.status
    );

    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    return { task };
  });

  // GET /api/board/summary - Board summary stats
  fastify.get('/board/summary', async (_request, reply: FastifyReply) => {
    const summary = await taskService.getBoardSummary();
    return { summary };
  });

  // GET /api/board/columns - Tasks grouped by status
  fastify.get('/board/columns', async (_request, reply: FastifyReply) => {
    const columns = await taskService.getTasksByStatus();
    return { columns };
  });

  // Dependencies endpoints
  // GET /api/tasks/:id/dependencies
  fastify.get<{
    Params: z.infer<typeof taskParamsSchema>;
  }>('/tasks/:id/dependencies', async (request: FastifyRequest<{ Params: z.infer<typeof taskParamsSchema> }>, reply: FastifyReply) => {
    const dependencies = await taskService.getTaskDependencies(request.params.id);
    return { dependencies };
  });

  // POST /api/tasks/:id/dependencies - Add dependency
  fastify.post<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: { dependencyTaskId: string };
  }>('/tasks/:id/dependencies', async (request: FastifyRequest<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: { dependencyTaskId: string };
  }>, reply: FastifyReply) => {
    await taskService.addTaskDependency(request.params.id, request.body.dependencyTaskId);
    return reply.status(201).send({ success: true });
  });

  // DELETE /api/tasks/:id/dependencies/:depId - Remove dependency
  fastify.delete<{
    Params: z.infer<typeof taskParamsSchema> & { depId: string };
  }>('/tasks/:id/dependencies/:depId', async (request: FastifyRequest<{
    Params: z.infer<typeof taskParamsSchema> & { depId: string };
  }>, reply: FastifyReply) => {
    await taskService.removeTaskDependency(request.params.id, request.params.depId);
    return reply.status(204).send();
  });

  // PUT /api/tasks/:id/execution - Update execution state
  const executionStateSchema = z.object({
    executionState: z.enum(['queued', 'running', 'waiting', 'idle', 'failed', 'completed'])
  });

  fastify.put<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: z.infer<typeof executionStateSchema>;
  }>('/tasks/:id/execution', async (request: FastifyRequest<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: z.infer<typeof executionStateSchema>;
  }>, reply: FastifyReply) => {
    const { executionState } = executionStateSchema.parse(request.body);
    
    // Get current task for audit
    const currentTask = await taskService.getTaskById(request.params.id);
    if (!currentTask) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    const task = await taskService.updateTask(request.params.id, {
      executionState,
      lastActionAt: new Date().toISOString()
    });

    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    return { task };
  });

  // Bot Runs endpoints
  // GET /api/tasks/:id/runs - Get bot runs for a task
  fastify.get<{
    Params: z.infer<typeof taskParamsSchema>;
  }>('/tasks/:id/runs', async (request: FastifyRequest<{ Params: z.infer<typeof taskParamsSchema> }>, reply: FastifyReply) => {
    const runs = await taskService.getBotRunsForTask(request.params.id);
    return { runs };
  });

  // POST /api/tasks/:id/runs - Create a new bot run
  fastify.post<{
    Params: z.infer<typeof taskParamsSchema>;
  }>('/tasks/:id/runs', async (request: FastifyRequest<{ Params: z.infer<typeof taskParamsSchema> }>, reply: FastifyReply) => {
    const { attemptNumber, parentRunId } = request.body as { attemptNumber?: number; parentRunId?: string };
    const run = await taskService.createBotRun(request.params.id, attemptNumber, parentRunId);
    return reply.status(201).send(run);
  });

  // DELETE /api/tasks/clear-demo - Clear all demo tasks (dev only)
  fastify.delete('/tasks/clear-demo', async (_request, reply: FastifyReply) => {
    try {
      // Delete in correct order due to foreign key constraints
      await prisma.taskConversationMessage.deleteMany({});
      await prisma.taskProgressLogEntry.deleteMany({});
      await prisma.taskStateLog.deleteMany({});
      await prisma.auditEvent.deleteMany({});
      await prisma.botRun.deleteMany({});
      const result = await prisma.task.deleteMany({});
      return { deleted: result.count };
    } catch (error) {
      console.error('Failed to clear demo data:', error);
      return reply.status(500).send({ error: 'Failed to clear demo data' });
    }
  });

  // ============================================
  // State Logs Endpoints
  // ============================================

  // GET /api/tasks/:id/state-logs - Get state change history for a task
  fastify.get<{
    Params: z.infer<typeof taskParamsSchema>;
  }>('/tasks/:id/state-logs', async (request: FastifyRequest<{ Params: z.infer<typeof taskParamsSchema> }>, reply: FastifyReply) => {
    const logs = await taskService.getStateLogsForTask(request.params.id);
    return { logs };
  });

  // ============================================
  // Session Binding & Bot Autonomy Endpoints
  // ============================================

  // POST /api/tasks/:id/claim - Atomic claim with sessionKey
  const claimSchema = z.object({
    sessionKey: z.string().min(1)
  });

  fastify.post<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: z.infer<typeof claimSchema>;
  }>('/tasks/:id/claim', async (request: FastifyRequest<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: z.infer<typeof claimSchema>;
  }>, reply: FastifyReply) => {
    const { sessionKey } = claimSchema.parse(request.body);
    const taskId = request.params.id;

    // Atomic claim - only succeeds if sessionKey is NULL or same owner
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    // Check if already claimed
    if (task.sessionKey && task.sessionKey !== sessionKey) {
      return reply.status(409).send({ 
        error: 'Task already claimed',
        claimedBy: task.sessionKey,
        lockedAt: task.sessionLockedAt
      });
    }

    // Claim the task
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        sessionKey,
        sessionLockedAt: new Date(),
        status: 'InProgress',
        executionState: 'running'
      }
    });

    // Emit SSE event so clients know the task was claimed
    const mappedTask = taskService.mapPrismaTaskToTask(updatedTask as Parameters<typeof taskService.mapPrismaTaskToTask>[0]);
    emitTaskEvent('task:updated', mappedTask);

    return { 
      task: mappedTask,
      claimedAt: updatedTask.sessionLockedAt
    };
  });

  // POST /api/tasks/:id/release - Release claimed task
  const releaseSchema = z.object({
    sessionKey: z.string().min(1)
  });

  fastify.post<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: z.infer<typeof releaseSchema>;
  }>('/tasks/:id/release', async (request: FastifyRequest<{
    Params: z.infer<typeof taskParamsSchema>;
    Body: z.infer<typeof releaseSchema>;
  }>, reply: FastifyReply) => {
    const { sessionKey } = releaseSchema.parse(request.body);
    const taskId = request.params.id;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return reply.status(404).send({ error: 'Task not found' });
    }

    // Only owner can release
    if (task.sessionKey && task.sessionKey !== sessionKey) {
      return reply.status(403).send({ 
        error: 'Cannot release - task claimed by different session' 
      });
    }

    await prisma.task.update({
      where: { id: taskId },
      data: {
        sessionKey: null,
        sessionLockedAt: null
      }
    });

    // Re-fetch and emit SSE event so clients know the task was released
    const releasedTask = await prisma.task.findUnique({ where: { id: taskId } });
    if (releasedTask) {
      emitTaskEvent('task:updated', taskService.mapPrismaTaskToTask(releasedTask as Parameters<typeof taskService.mapPrismaTaskToTask>[0]));
    }

    return { released: true };
  });

  // POST /api/tasks/cleanup-stale - Release locks older than threshold
  const cleanupSchema = z.object({
    olderThanMinutes: z.number().min(1).default(5)
  });

  fastify.post('/tasks/cleanup-stale', async (request: FastifyRequest<{
    Body: z.infer<typeof cleanupSchema>;
  }>, reply: FastifyReply) => {
    const { olderThanMinutes } = cleanupSchema.parse(request.body);
    
    const threshold = new Date(Date.now() - olderThanMinutes * 60 * 1000);

    const result = await prisma.task.updateMany({
      where: {
        sessionKey: { not: null },
        sessionLockedAt: { lt: threshold }
      },
      data: {
        sessionKey: null,
        sessionLockedAt: null,
        // Optionally revert status if it was in progress
        executionState: 'idle'
      }
    });

    return { 
      cleaned: result.count,
      threshold: threshold.toISOString()
    };
  });

  // GET /api/tasks/ready-for-work - Poll for ready tasks (for bot autonomy)
  const readyQuerySchema = z.object({
    sessionKey: z.string().min(1),
    assignee: z.string().default('clawdbot')
  });

  fastify.get<{
    Querystring: z.infer<typeof readyQuerySchema>;
  }>('/tasks/ready-for-work', async (request: FastifyRequest<{
    Querystring: z.infer<typeof readyQuerySchema>;
  }>, reply: FastifyReply) => {
    const { sessionKey, assignee } = readyQuerySchema.parse(request.query);

    // Find a task that's:
    // 1. Assigned to the bot
    // 2. In Ready status (or InProgress but stale)
    // 3. Not already claimed OR claimed by us
    
    // First try to find unclaimed ready tasks
    let task = await prisma.task.findFirst({
      where: {
        assignee,
        status: 'Ready',
        OR: [
          { sessionKey: null },
          { sessionKey: sessionKey }
        ]
      },
      orderBy: { createdAt: 'asc' },
      include: { project: true }
    });

    if (task) {
      // Atomically claim it
      const updatedTask = await prisma.task.update({
        where: { id: task.id },
        data: {
          sessionKey,
          sessionLockedAt: new Date(),
          status: 'InProgress',
          executionState: 'running'
        },
        include: {
          progressLog: {
            orderBy: { completedAt: 'desc' }
          },
          project: true
        }
      });

      // Emit SSE event for real-time updates
      const mappedTask = taskService.mapPrismaTaskToTask(updatedTask as Parameters<typeof taskService.mapPrismaTaskToTask>[0]);
      try {
        emitTaskEvent('task:updated', mappedTask);
      } catch (err) {
        console.error('SSE emit error:', err);
      }

      const readySettings = await stageSettingsService.getEffectiveSettingForStage('Ready', updatedTask.projectId);
      const readyInstructions = readySettings.readyInstructions ?? readySettings.systemPrompt ?? null;
      const workFolder = updatedTask.project && !updatedTask.project.archivedAt ? updatedTask.project.folderPath : null;
      const projectName = updatedTask.project && !updatedTask.project.archivedAt ? updatedTask.project.name : null;
      const model = readySettings.defaultModel && readySettings.defaultModel !== DEFAULT_MODEL ? readySettings.defaultModel : undefined;

      let readyPrompt: string | null = readyInstructions;
      if (updatedTask.project && !updatedTask.project.archivedAt) {
        const defaultContextTemplate = 'This task is for the project called {{projectName}} in the folder {{folderPath}}. Please work on that project only in that folder for this request unless otherwise specified.';
        const template = (readySettings.projectContextTemplate && readySettings.projectContextTemplate.trim()) || defaultContextTemplate;
        const contextParagraph = template
          .replace(/\{\{projectName\}\}/g, updatedTask.project.name)
          .replace(/\{\{folderPath\}\}/g, updatedTask.project.folderPath);
        readyPrompt = contextParagraph.trim() + (readyInstructions ? '\n\n' + readyInstructions : '');
      }

      const messages = await taskService.getConversationForTask(updatedTask.id);
      const conversationBlock =
        messages.length === 0
          ? `Task: ${updatedTask.title}\n\nConversation so far:\n(no messages yet)`
          : `Task: ${updatedTask.title}\n\nConversation so far:\n${messages.map((m) => `[${m.role}] (${m.createdAt}):\n${m.content}`).join('\n\n')}`;

      return {
        task: mappedTask,
        action: 'claimed',
        readyPrompt,
        conversationForPrompt: conversationBlock,
        conversation: messages,
        planDocument: updatedTask.planDocument ?? null,
        workFolder,
        ...(projectName != null && { projectName }),
        ...(model && { model })
      };
    }

    // No ready tasks, return null
    return { task: null, action: 'none' };
  });

  // GET /api/tasks/orphaned - Find InProgress tasks without active session
  const orphanedQuerySchema = z.object({
    sessionKey: z.string().min(1),
    assignee: z.string().default('clawdbot')
  });

  fastify.get<{
    Querystring: z.infer<typeof orphanedQuerySchema>;
  }>('/tasks/orphaned', async (request: FastifyRequest<{
    Querystring: z.infer<typeof orphanedQuerySchema>;
  }>, reply: FastifyReply) => {
    const { sessionKey, assignee } = orphanedQuerySchema.parse(request.query);

    // Find InProgress tasks that have no sessionKey (orphaned)
    let task = await prisma.task.findFirst({
      where: {
        assignee,
        status: 'InProgress',
        sessionKey: null  // No active session
      },
      orderBy: { updatedAt: 'asc' }
    });

    if (task) {
      // Atomically claim it
      const updatedTask = await prisma.task.update({
        where: { id: task.id },
        data: {
          sessionKey,
          sessionLockedAt: new Date()
        },
        include: {
          progressLog: {
            orderBy: { completedAt: 'desc' }
          }
        }
      });

      // Emit SSE event for real-time updates
      const mappedTask = taskService.mapPrismaTaskToTask(updatedTask as Parameters<typeof taskService.mapPrismaTaskToTask>[0]);
      try {
        emitTaskEvent('task:updated', mappedTask);
      } catch (err) {
        console.error('SSE emit error:', err);
      }

      return { 
        task: mappedTask,
        action: 'claimed'
      };
    }

    return { task: null, action: 'none' };
  });
}
