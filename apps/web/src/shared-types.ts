// ============================================
// Task Status Enum
// ============================================
export type TaskStatus = 
  | 'New' 
  | 'Planning'
  | 'Backlog' 
  | 'Ready' 
  | 'InProgress' 
  | 'Blocked' 
  | 'Review' 
  | 'Failed'
  | 'Done';

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
// Execution State Enum
// ============================================
export type ExecutionState = 
  | 'queued'
  | 'running'
  | 'waiting'
  | 'idle'
  | 'failed'
  | 'completed';

export const EXECUTION_STATES: ExecutionState[] = [
  'queued',
  'running',
  'waiting',
  'idle',
  'failed',
  'completed'
];

// ============================================
// Priority Enum
// ============================================
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

// ============================================
// Project Interface
// ============================================
export interface Project {
  id: string;
  name: string;
  folderPath: string;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

/** Preset hex colors for project color picker and auto-assign when project has no color. */
export const PROJECT_COLORS = [
  '#58a6ff', '#3fb950', '#a371f7', '#d29922', '#f85149',
  '#79c0ff', '#56d364', '#bc8cff', '#e3b341', '#ff7b72'
];

/** Effective color for a project: stored color or auto-assigned from palette by index. */
export function getProjectColor(project: { color?: string | null }, index: number): string {
  if (project.color) return project.color;
  return PROJECT_COLORS[index % PROJECT_COLORS.length];
}

// ============================================
// Task Interface
// ============================================
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  executionState: ExecutionState;
  assignee?: string;
  priority: Priority;
  tags: string[];
  projectId?: string | null;
  
  // Bot Observability
  planChecklist: string[];
  currentStepIndex: number;
  progressLog: ProgressLogEntry[];
  blockedReason?: string;
  blockedBy: string[]; // Task IDs this task depends on
  lastActionAt?: string;
  lastHeartbeatAt?: string;
  
  // Time Tracking
  estimate?: number;
  timeSpent: number;
  currentStateStartedAt?: string;

  // Approval Gates
  needsApproval: boolean;
  approvedAt?: string;
  approvedBy?: string;
  
  // Work Output (for auditability + review)
  results?: string;  // Markdown summary of work done
  commits?: Array<{
    sha: string;
    message: string;
    url: string;
    timestamp: string;
  }>;
  
  // Dates
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  dueDate?: string;
}

// ============================================
// Task State Log Entry
// ============================================
export interface TaskStateLog {
  id: string;
  taskId: string;
  status: TaskStatus;
  enteredAt: string;
  exitedAt?: string;
  duration?: number; // Duration in seconds
}

// ============================================
// Progress Log Entry
// ============================================
export interface ProgressLogEntry {
  id: string;
  step: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  completedAt: string;
}

// ============================================
// Audit Event Interface
// ============================================
export interface AuditEvent {
  id: string;
  eventType: string;
  entityType: 'Task' | 'BotRun';
  entityId: string;
  actor: 'human' | 'clawdbot';
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  timestamp: string;
  taskId?: string;
}

// ============================================
// Bot Run Interface
// ============================================
export interface BotRun {
  id: string;
  taskId: string;
  status: 'running' | 'failed' | 'completed' | 'cancelled';
  startedAt: string;
  endedAt?: string;
  summary?: string;
  log?: BotRunLogEntry[];
  attemptNumber: number;
  parentRunId?: string;
}

export interface BotRunLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: Record<string, unknown>;
}

// ============================================
// Task Dependency Interface
// ============================================
export interface TaskDependency {
  id: string;
  dependentTaskId: string;
  dependencyTaskId: string;
  createdAt: string;
}

// ============================================
// API Types
// ============================================
export interface CreateTaskInput {
  title: string;
  description?: string;
  assignee?: string;
  priority?: Priority;
  tags?: string[];
  estimate?: number;
  dueDate?: string;
  planChecklist?: string[];
  needsApproval?: boolean;
  blockedBy?: string[];
  projectId?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  executionState?: ExecutionState;
  assignee?: string;
  priority?: Priority;
  tags?: string[];
  planChecklist?: string[];
  currentStepIndex?: number;
  blockedReason?: string;
  blockedBy?: string[];
  estimate?: number;
  timeSpent?: number;
  dueDate?: string;
  needsApproval?: boolean;
  approvedAt?: string;
  approvedBy?: string;
  results?: string;
  projectId?: string | null;
  commits?: Array<{
    sha: string;
    message: string;
    url: string;
    timestamp: string;
  }>;
}

export interface MoveTaskInput {
  status: TaskStatus;
}

export interface TaskFilters {
  status?: TaskStatus;
  executionState?: ExecutionState;
  assignee?: string;
  priority?: Priority;
  tags?: string[];
  projectId?: string;
}

// ============================================
// Board Summary
// ============================================
export interface BoardSummary {
  tasksThisWeek: number;
  inProgress: number;
  total: number;
  completionPercent: number;
  runningBots: number;
  idleTasks: number;
  blockedTasks: number;
}

// ============================================
// Column with Tasks
// ============================================
export interface Column {
  status: TaskStatus;
  tasks: Task[];
  taskCount: number;
}

// ============================================
// Stage Settings (prompts per Kanban stage)
// ============================================
export type StageSettingScope = 'global' | 'project';

export interface StageSettingRow {
  id: string;
  scope: StageSettingScope;
  projectId: string | null;
  stage: TaskStatus;
  systemPrompt: string | null;
  defaultModel: string | null;
  planningDestinationStatus: string | null;
  readyInstructions: string | null;
}

/** Effective settings for a project (merged: project override or global). One per stage. */
export interface EffectiveStageSettings {
  [stage: string]: {
    systemPrompt: string | null;
    defaultModel: string | null;
    planningDestinationStatus: string | null;
    readyInstructions: string | null;
  };
}
