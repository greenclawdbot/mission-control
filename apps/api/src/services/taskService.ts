import prisma from '../db/client';
import { Task, CreateTaskInput, UpdateTaskInput, TaskStatus, ExecutionState, ProgressLogEntry } from '../../../shared/src/types';
import { emitAuditEvent } from './auditService';
import { triggerWebhook } from './webhookService';
import { emitTaskEvent, emitRunEvent, emitEventLogEvent } from '../wsServer';
import { EXECUTION_STATES } from '../routes/tasks';

export const TASK_STATUSES: TaskStatus[] = [
  'Backlog',
  'Ready',
  'InProgress',
  'Blocked',
  'Review',
  'Done'
];

// ============================================
// CRUD Operations
// ============================================

export async function getAllTasks(filters?: {
  status?: TaskStatus;
  executionState?: ExecutionState;
  assignee?: string;
  priority?: string;
  tags?: string[];
}): Promise<Task[]> {
  const where: Record<string, unknown> = {};

  if (filters?.status) where.status = filters.status;
  if (filters?.executionState) where.executionState = filters.executionState;
  if (filters?.assignee) where.assignee = filters.assignee;
  if (filters?.priority) where.priority = filters.priority;
  if (filters?.tags && filters.tags.length > 0) where.tags = { hasSome: filters.tags.split(',') };

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      progressLog: {
        orderBy: { completedAt: 'desc' }
      }
    }
  });

  return tasks.map(mapPrismaTaskToTask);
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

  return task ? mapPrismaTaskToTask(task) : null;
}

export async function createTask(input: CreateTaskInput, actor: 'human' | 'clawdbot' = 'human'): Promise<Task> {
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
      executionState: 'queued'
    },
    include: {
      progressLog: {
        orderBy: { completedAt: 'desc' }
      }
    }
  });

  // Emit audit event
  await emitAuditEvent({
    eventType: 'task.created',
    entityType: 'Task',
    entityId: task.id,
    actor,
    after: task
  });

  // Emit WebSocket event
  emitTaskEvent('task:created', mapPrismaTaskToTask(task));

  // Trigger webhook if assigned to clawdbot
  if (task.assignee === 'clawdbot') {
    await triggerWebhook('task.created', task);
  }

  return mapPrismaTaskToTask(task);
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
    updateData.status = input.status;
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

  // Emit audit event
  await emitAuditEvent({
    eventType: 'task.updated',
    entityType: 'Task',
    entityId: id,
    actor,
    before,
    after: mapPrismaTaskToTask(task)
  });

  // Emit WebSocket event
  emitTaskEvent('task:updated', mapPrismaTaskToTask(task));

  // Trigger webhook if assigned to clawdbot
  if (task.assignee === 'clawdbot') {
    await triggerWebhook('task.updated', task);
  }

  return mapPrismaTaskToTask(task);
}

export async function moveTask(id: string, status: TaskStatus, actor: 'human' | 'clawdbot' = 'human'): Promise<Task | null> {
  return updateTask(id, { status }, actor);
}

export async function deleteTask(id: string, actor: 'human' | 'clawdbot' = 'human'): Promise<boolean> {
  const before = await getTaskById(id);
  if (!before) return false;

  try {
    // Delete related records first (due to foreign key constraints)
    await prisma.taskProgressLogEntry.deleteMany({ where: { taskId: id } });
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
      before
    });

    // Emit WebSocket event
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
  }).then(task => mapPrismaTaskToTask(task));
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

  // Emit WebSocket event
  const task = await getTaskById(taskId);
  if (task) {
    emitRunEvent('run:created', {
      ...run,
      taskId,
      task
    });
  }
  
  return { id: run.id };
}

export async function completeBotRun(
  runId: string,
  status: 'completed' | 'failed' | 'cancelled',
  summary?: string
): Promise<void> {
  const run = await prisma.botRun.update({
    where: { id: runId },
    data: {
      status,
      endedAt: new Date(),
      summary
    }
  });

  // Emit WebSocket event
  emitRunEvent('run:completed', {
    ...run,
    taskId: run.taskId
  });
}

export async function getBotRunsForTask(taskId: string): Promise<unknown[]> {
  return prisma.botRun.findMany({
    where: { taskId },
    orderBy: { startedAt: 'desc' }
  });
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
    planChecklist: task.planChecklist,
    currentStepIndex: task.currentStepIndex,
    progressLog: task.progressLog.map(entry => ({
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
    dueDate: task.dueDate?.toISOString()
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
    Backlog: [],
    Ready: [],
    InProgress: [],
    Blocked: [],
    Review: [],
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
