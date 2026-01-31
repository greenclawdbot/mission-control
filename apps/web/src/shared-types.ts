// ============================================
// Task Status Enum
// ============================================
export type TaskStatus = 
  | 'Backlog' 
  | 'Ready' 
  | 'InProgress' 
  | 'Blocked' 
  | 'Review' 
  | 'Done';

export const TASK_STATUSES: TaskStatus[] = [
  'Backlog',
  'Ready', 
  'InProgress',
  'Blocked',
  'Review',
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
