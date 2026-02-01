import prisma from '../db/client';
import { Task, CreateTaskInput, UpdateTaskInput, TaskStatus, ExecutionState, ProgressLogEntry, Priority, TaskConversationMessage, TaskPlanningMessage } from '@shared/src/types';
import { emitAuditEvent } from './auditService';
import { triggerWebhook } from './webhookService';
import { emitTaskEvent } from '../sseServer';
export const TASK_STATUSES: TaskStatus[] = [
  'New',
  'Planning',
  'Backlog',
  'Ready',
  'InProgress',
  'Blocked',
  'Review',
  'Failed',
  'Done'
];

// ============================================
// STATE LOG HELPERS
// ============================================

export interface TaskStateLog {
  id: string;
  taskId: string;
  status: string;
  enteredAt: Date;
  exitedAt: Date | null;
  duration: number | null;
}

async function createStateLogEntry(taskId: string, status: string): Promise<TaskStateLog> {
  const log = await prisma.taskStateLog.create({
    data: {
      taskId,
      status,
      enteredAt: new Date()
    }
  });
  return {
    id: log.id,
    taskId: log.taskId,
    status: log.status,
    enteredAt: log.enteredAt,
    exitedAt: log.exitedAt,
    duration: log.duration
  };
}

async function closeStateLogEntry(taskId: string, status: string): Promise<void> {
  // Find the most recent open log entry for this task and status
  const openLog = await prisma.taskStateLog.findFirst({
    where: {
      taskId,
      status,
      exitedAt: null
    },
    orderBy: { enteredAt: 'desc' }
  });

  if (openLog) {
    const exitedAt = new Date();
    const duration = Math.round((exitedAt.getTime() - openLog.enteredAt.getTime()) / 1000);
    await prisma.taskStateLog.update({
      where: { id: openLog.id },
      data: {
        exitedAt,
        duration
      }
    });
  }
}

export async function getStateLogsForTask(taskId: string): Promise<TaskStateLog[]> {
  const logs = await prisma.taskStateLog.findMany({
    where: { taskId },
    orderBy: { enteredAt: 'desc' }
  });
  return logs.map(log => ({
    id: log.id,
    taskId: log.taskId,
    status: log.status,
    enteredAt: log.enteredAt,
    exitedAt: log.exitedAt,
    duration: log.duration
  }));
}

// ============================================
// CRUD Operations
// ============================================

export async function getAllTasks(filters?: {
  status?: TaskStatus;
  executionState?: ExecutionState;
  assignee?: string;
  priority?: string;
  tags?: string;
  projectId?: string;
}): Promise<Task[]> {
  const where: Record<string, unknown> = {};

  if (filters?.status) where.status = filters.status;
  if (filters?.executionState) where.executionState = filters.executionState;
  if (filters?.assignee) where.assignee = filters.assignee;
  if (filters?.priority) where.priority = filters.priority;
  if (filters?.tags && filters.tags.length > 0) where.tags = { hasSome: filters.tags.split(',') };
  if (filters?.projectId === 'none') where.projectId = null;
  else if (filters?.projectId) where.projectId = filters.projectId;

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      progressLog: {
        orderBy: { completedAt: 'desc' }
      }
    }
  });

  return tasks.map(t => mapPrismaTaskToTask(t as Parameters<typeof mapPrismaTaskToTask>[0]));
}

export async function getTaskById(id: string): Promise<Task | null> {
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      progressLog: {
        orderBy: { completedAt: 'desc' }
      }
    }
  });

  return task ? mapPrismaTaskToTask(task as Parameters<typeof mapPrismaTaskToTask>[0]) : null;
}

export async function createTask(input: CreateTaskInput, actor: 'human' | 'clawdbot' = 'human'): Promise<Task> {
  const status = input.status || 'New';
  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description,
      assignee: input.assignee,
      priority: input.priority || 'Medium',
      tags: input.tags || [],
      estimate: input.estimate,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      planChecklist: input.planChecklist || [],
      currentStepIndex: 0,
      timeSpent: 0,
      needsApproval: input.needsApproval || false,
      blockedBy: input.blockedBy || [],
      executionState: 'queued',
      status,
      currentStateStartedAt: new Date(),
      projectId: input.projectId ?? null
    },
    include: {
      progressLog: {
        orderBy: { completedAt: 'desc' }
      }
    }
  });

  // Create initial state log entry
  await createStateLogEntry(task.id, status);

  // Seed initial user message for conversation feed
  await appendUserMessage(task.id, input.description ?? '');

  // Emit audit event
  await emitAuditEvent({
    eventType: 'task.created',
    entityType: 'Task',
    entityId: task.id,
    actor,
    after: task
  });

  // NOTE: We do NOT emit SSE event here for task:created
  // The client that creates the task will add it to state directly from the HTTP response.
  // This prevents the duplicate task issue where the creating client receives its own event.
  // SSE is only used for real-time updates from OTHER clients.

  // Trigger webhook if assigned to clawdbot
  const mapped = mapPrismaTaskToTask(task as Parameters<typeof mapPrismaTaskToTask>[0]);
  if (task.assignee === 'clawdbot') {
    await triggerWebhook('task.created', mapped);
  }

  return mapped;
}

export async function updateTask(id: string, input: UpdateTaskInput, actor: 'human' | 'clawdbot' = 'human'): Promise<Task | null> {
  // Get current state for audit
  const before = await getTaskById(id);
  if (!before) return null;

  // Build update data
  const updateData: Record<string, unknown> = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.status !== undefined) {
    // Close the previous state log entry
    await closeStateLogEntry(id, before.status);
    // Create a new state log entry for the new status
    await createStateLogEntry(id, input.status);

    updateData.status = input.status;
    updateData.currentStateStartedAt = new Date();
    // Set startedAt when moving to InProgress
    if (input.status === 'InProgress' && before.status !== 'InProgress') {
      updateData.startedAt = new Date();
      updateData.executionState = 'running';
    }
    // Set completedAt when moving to Done
    if (input.status === 'Done' && before.status !== 'Done') {
      updateData.completedAt = new Date();
      updateData.executionState = 'completed';
    }
  }
  if (input.executionState !== undefined) {
    updateData.executionState = input.executionState;
    // Track execution state changes
    if (input.executionState === 'running' && before.executionState !== 'running') {
      updateData.startedAt = new Date();
    }
    if (input.executionState === 'completed' && before.executionState !== 'completed') {
      updateData.completedAt = new Date();
    }
  }
  if (input.assignee !== undefined) updateData.assignee = input.assignee;
  if (input.priority !== undefined) updateData.priority = input.priority;
  if (input.tags !== undefined) updateData.tags = input.tags;
  if (input.planChecklist !== undefined) updateData.planChecklist = input.planChecklist;
  if (input.currentStepIndex !== undefined) updateData.currentStepIndex = input.currentStepIndex;
  if (input.blockedReason !== undefined) updateData.blockedReason = input.blockedReason;
  if (input.blockedBy !== undefined) updateData.blockedBy = input.blockedBy;
  if (input.estimate !== undefined) updateData.estimate = input.estimate;
  if (input.timeSpent !== undefined) updateData.timeSpent = input.timeSpent;
  if (input.dueDate !== undefined) updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.needsApproval !== undefined) updateData.needsApproval = input.needsApproval;
  if (input.approvedAt !== undefined) updateData.approvedAt = input.approvedAt ? new Date(input.approvedAt) : null;
  if (input.approvedBy !== undefined) updateData.approvedBy = input.approvedBy;
  if (input.results !== undefined) updateData.results = input.results;
  if (input.commits !== undefined) updateData.commits = input.commits;
  if (input.projectId !== undefined) updateData.projectId = input.projectId;

  updateData.lastActionAt = new Date();

  const task = await prisma.task.update({
    where: { id },
    data: updateData,
    include: {
      progressLog: {
        orderBy: { completedAt: 'desc' }
      }
    }
  });

  if (input.results !== undefined) {
    await appendAssistantMessage(id, input.results, input.botRunId);
  }

  // Emit audit event
  await emitAuditEvent({
    eventType: 'task.updated',
    entityType: 'Task',
    entityId: id,
    actor,
    before: before as unknown as Record<string, unknown>,
    after: mapPrismaTaskToTask(task as Parameters<typeof mapPrismaTaskToTask>[0]) as unknown as Record<string, unknown>
  });

  // Emit SSE event
  const mapped = mapPrismaTaskToTask(task as Parameters<typeof mapPrismaTaskToTask>[0]);
  emitTaskEvent('task:updated', mapped);

  // Trigger webhook if assigned to clawdbot
  if (task.assignee === 'clawdbot') {
    await triggerWebhook('task.updated', mapped);
  }

  return mapped;
}

export async function moveTask(id: string, status: TaskStatus, actor: 'human' | 'clawdbot' = 'human'): Promise<Task | null> {
  // When moving to Review or Done, also set executionState to completed
  const updates: UpdateTaskInput = { status };
  if (status === 'Review' || status === 'Done') {
    updates.executionState = 'completed';
  }
  return updateTask(id, updates, actor);
}

export async function deleteTask(id: string, actor: 'human' | 'clawdbot' = 'human'): Promise<boolean> {
  const before = await getTaskById(id);
  if (!before) return false;

  try {
    // Delete related records first (due to foreign key constraints)
    await prisma.taskConversationMessage.deleteMany({ where: { taskId: id } });
    await prisma.taskProgressLogEntry.deleteMany({ where: { taskId: id } });
    await prisma.taskStateLog.deleteMany({ where: { taskId: id } });
    await prisma.auditEvent.deleteMany({ where: { taskId: id } });
    await prisma.botRun.deleteMany({ where: { taskId: id } });

    // Delete TaskDependency records where this task is involved
    await prisma.taskDependency.deleteMany({
      where: {
        OR: [
          { dependentTaskId: id },
          { dependencyTaskId: id }
        ]
      }
    });

    await prisma.task.delete({ where: { id } });

    await emitAuditEvent({
      eventType: 'task.deleted',
      entityType: 'Task',
      entityId: id,
      actor,
      before: before as unknown as Record<string, unknown>
    });

    // Emit SSE event
    emitTaskEvent('task:deleted', before);

    return true;
  } catch (error) {
    console.error('Failed to delete task:', error);
    throw error;
  }
}

// ============================================
// Bot Progress Logging
// ============================================

export async function logProgress(
  taskId: string, 
  step: string,
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped' = 'done',
  actor: 'human' | 'clawdbot' = 'clawdbot'
): Promise<Task | null> {
  // Create progress log entry
  await prisma.taskProgressLogEntry.create({
    data: {
      taskId,
      step,
      status,
      completedAt: new Date()
    }
  });

  // Update task's lastActionAt and executionState
  return updateTask(taskId, { 
    executionState: status === 'done' ? 'running' : status === 'failed' ? 'failed' : 'running',
    lastHeartbeatAt: new Date().toISOString()
  } as UpdateTaskInput, actor);
}

export async function updateHeartbeat(taskId: string): Promise<Task | null> {
  return prisma.task.update({
    where: { id: taskId },
    data: {
      lastHeartbeatAt: new Date(),
      lastActionAt: new Date(),
      executionState: 'running'
    },
    include: {
      progressLog: {
        orderBy: { completedAt: 'desc' }
      }
    }
  }).then(task => mapPrismaTaskToTask(task as Parameters<typeof mapPrismaTaskToTask>[0]));
}

// ============================================
// Bot Run Operations
// ============================================

export async function createBotRun(
  taskId: string,
  attemptNumber: number = 1,
  parentRunId?: string
): Promise<{ id: string }> {
  const run = await prisma.botRun.create({
    data: {
      taskId,
      status: 'running',
      attemptNumber,
      parentRunId,
      startedAt: new Date()
    }
  });

  // Emit WebSocket event (disabled for stability)
  const task = await getTaskById(taskId);
  if (task) {
    // Run created event would go here
  }
  
  return { id: run.id };
}

export async function completeBotRun(
  runId: string,
  status: 'completed' | 'failed' | 'cancelled',
  summary?: string
): Promise<void> {
  await prisma.botRun.update({
    where: { id: runId },
    data: {
      status,
      endedAt: new Date(),
      summary
    }
  });

  // Run completed event would go here
}

export async function getBotRunsForTask(taskId: string): Promise<unknown[]> {
  return prisma.botRun.findMany({
    where: { taskId },
    orderBy: { startedAt: 'desc' }
  });
}

// ============================================
// Task Conversation (ongoing feed per task)
// ============================================

function mapPrismaMessageToMessage(msg: {
  id: string;
  taskId: string;
  role: string;
  content: string;
  createdAt: Date;
  botRunId: string | null;
}): TaskConversationMessage {
  return {
    id: msg.id,
    taskId: msg.taskId,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    createdAt: msg.createdAt.toISOString(),
    botRunId: msg.botRunId ?? undefined
  };
}

export async function getConversationForTask(taskId: string): Promise<TaskConversationMessage[]> {
  const messages = await prisma.taskConversationMessage.findMany({
    where: { taskId },
    orderBy: { createdAt: 'asc' }
  });
  return messages.map((m) => mapPrismaMessageToMessage(m));
}

export async function appendUserMessage(taskId: string, content: string): Promise<TaskConversationMessage> {
  const msg = await prisma.taskConversationMessage.create({
    data: {
      taskId,
      role: 'user',
      content,
      createdAt: new Date()
    }
  });
  return mapPrismaMessageToMessage(msg);
}

export async function appendAssistantMessage(
  taskId: string,
  content: string,
  botRunId?: string
): Promise<TaskConversationMessage> {
  const msg = await prisma.taskConversationMessage.create({
    data: {
      taskId,
      role: 'assistant',
      content,
      createdAt: new Date(),
      ...(botRunId && { botRunId })
    }
  });
  await prisma.task.update({
    where: { id: taskId },
    data: { results: content }
  });
  return mapPrismaMessageToMessage(msg);
}

// ============================================
// Task Planning Conversation (separate thread for planning phase)
// ============================================

function mapPrismaPlanningMessageToMessage(msg: {
  id: string;
  taskId: string;
  role: string;
  content: string;
  createdAt: Date;
}): TaskPlanningMessage {
  return {
    id: msg.id,
    taskId: msg.taskId,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    createdAt: msg.createdAt.toISOString()
  };
}

export async function getPlanningConversationForTask(taskId: string): Promise<TaskPlanningMessage[]> {
  const messages = await prisma.taskPlanningMessage.findMany({
    where: { taskId },
    orderBy: { createdAt: 'asc' }
  });
  return messages.map((m) => mapPrismaPlanningMessageToMessage(m));
}

export async function appendPlanningUserMessage(taskId: string, content: string): Promise<TaskPlanningMessage> {
  const msg = await prisma.taskPlanningMessage.create({
    data: {
      taskId,
      role: 'user',
      content,
      createdAt: new Date()
    }
  });
  return mapPrismaPlanningMessageToMessage(msg);
}

export async function appendPlanningAssistantMessage(taskId: string, content: string): Promise<TaskPlanningMessage> {
  const msg = await prisma.taskPlanningMessage.create({
    data: {
      taskId,
      role: 'assistant',
      content,
      createdAt: new Date()
    }
  });
  await prisma.task.update({
    where: { id: taskId },
    data: { planDocument: content }
  });
  return mapPrismaPlanningMessageToMessage(msg);
}

// ============================================
// Helper Functions
// ============================================

export function mapPrismaTaskToTask(task: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  executionState: string;
  assignee: string | null;
  priority: string;
  tags: string[];
  planChecklist: string[];
  currentStepIndex: number;
  progressLog: { id: string; step: string; status: string; completedAt: Date }[];
  blockedReason: string | null;
  blockedBy: string[];
  lastActionAt: Date | null;
  lastHeartbeatAt: Date | null;
  estimate: number | null;
  timeSpent: number;
  needsApproval: boolean;
  approvedAt: Date | null;
  approvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  dueDate: Date | null;
  results: string | null;
  planDocument: string | null;
  commits: any;
  sessionKey: string | null;
  sessionLockedAt: Date | null;
  currentStateStartedAt: Date | null;
  projectId: string | null;
}): Task {
  return {
    id: task.id,
    title: task.title,
    description: task.description || undefined,
    status: task.status as TaskStatus,
    executionState: task.executionState as ExecutionState,
    assignee: task.assignee || undefined,
    priority: task.priority as Priority,
    tags: task.tags,
    projectId: task.projectId ?? undefined,
    planChecklist: task.planChecklist,
    currentStepIndex: task.currentStepIndex,
    progressLog: (task.progressLog || []).map(entry => ({
      id: entry.id,
      step: entry.step,
      status: entry.status as 'pending' | 'running' | 'done' | 'failed' | 'skipped',
      completedAt: entry.completedAt.toISOString()
    })),
    blockedReason: task.blockedReason || undefined,
    blockedBy: task.blockedBy || [],
    lastActionAt: task.lastActionAt?.toISOString(),
    lastHeartbeatAt: task.lastHeartbeatAt?.toISOString(),
    estimate: task.estimate || undefined,
    timeSpent: task.timeSpent,
    needsApproval: task.needsApproval,
    approvedAt: task.approvedAt?.toISOString(),
    approvedBy: task.approvedBy || undefined,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    startedAt: task.startedAt?.toISOString(),
    completedAt: task.completedAt?.toISOString(),
    dueDate: task.dueDate?.toISOString(),
    results: task.results || undefined,
    planDocument: task.planDocument ?? undefined,
    commits: task.commits || undefined,
    sessionKey: task.sessionKey,
    sessionLockedAt: task.sessionLockedAt?.toISOString(),
    currentStateStartedAt: task.currentStateStartedAt?.toISOString()
  };
}

// ============================================
// Board Summary
// ============================================

export async function getBoardSummary(): Promise<{
  tasksThisWeek: number;
  inProgress: number;
  total: number;
  completionPercent: number;
  runningBots: number;
  idleTasks: number;
  blockedTasks: number;
}> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [tasksThisWeek, inProgress, total, completedThisWeek, runningBots, idleTasks, blockedTasks] = await Promise.all([
    prisma.task.count({
      where: { createdAt: { gte: weekAgo } }
    }),
    prisma.task.count({
      where: { status: 'InProgress' }
    }),
    prisma.task.count(),
    prisma.task.count({
      where: { 
        status: 'Done',
        completedAt: { gte: weekAgo }
      }
    }),
    prisma.task.count({
      where: { executionState: 'running', assignee: 'clawdbot' }
    }),
    prisma.task.count({
      where: { executionState: 'idle' }
    }),
    prisma.task.count({
      where: { status: 'Blocked' }
    })
  ]);

  const completedTotal = await prisma.task.count({
    where: { status: 'Done' }
  });

  const completionPercent = total > 0 ? Math.round((completedTotal / total) * 100) : 0;

  return {
    tasksThisWeek,
    inProgress,
    total,
    completionPercent,
    runningBots,
    idleTasks,
    blockedTasks
  };
}

export async function getTasksByStatus(): Promise<Record<TaskStatus, Task[]>> {
  const tasks = await getAllTasks();
  
  const result: Record<TaskStatus, Task[]> = {
    New: [],
    Planning: [],
    Backlog: [],
    Ready: [],
    InProgress: [],
    Blocked: [],
    Review: [],
    Failed: [],
    Done: []
  };

  for (const task of tasks) {
    result[task.status].push(task);
  }

  return result;
}

// ============================================
// Task Dependencies
// ============================================

export async function addTaskDependency(dependentTaskId: string, dependencyTaskId: string): Promise<void> {
  await prisma.taskDependency.create({
    data: {
      dependentTaskId,
      dependencyTaskId
    }
  });
  
  // Emit audit event
  await emitAuditEvent({
    eventType: 'task.dependency_added',
    entityType: 'Task',
    entityId: dependentTaskId,
    actor: 'human',
    after: { dependencyTaskId }
  });
}

export async function removeTaskDependency(dependentTaskId: string, dependencyTaskId: string): Promise<void> {
  await prisma.taskDependency.deleteMany({
    where: {
      dependentTaskId,
      dependencyTaskId
    }
  });
  
  // Emit audit event
  await emitAuditEvent({
    eventType: 'task.dependency_removed',
    entityType: 'Task',
    entityId: dependentTaskId,
    actor: 'human',
    before: { dependencyTaskId }
  });
}

export async function getTaskDependencies(taskId: string): Promise<{ dependsOn: string[]; blockedBy: string[] }> {
  const dependencies = await prisma.taskDependency.findMany({
    where: { dependentTaskId: taskId }
  });
  
  const dependents = await prisma.taskDependency.findMany({
    where: { dependencyTaskId: taskId }
  });
  
  return {
    dependsOn: dependencies.map(d => d.dependencyTaskId),
    blockedBy: dependents.map(d => d.dependentTaskId)
  };
}
