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
// Priority Enum
// ============================================
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

// ============================================
// Execution State (bot run state)
// ============================================
export type ExecutionState = 'queued' | 'running' | 'waiting' | 'idle' | 'failed' | 'completed';

export const EXECUTION_STATES: ExecutionState[] = ['queued', 'running', 'waiting', 'idle', 'failed', 'completed'];

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

// ============================================
// Task Interface
// ============================================
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  executionState?: ExecutionState;
  assignee?: string;
  priority: Priority;
  tags: string[];
  projectId?: string | null;

  // Bot Observability
  planChecklist: string[];
  currentStepIndex: number;
  progressLog: ProgressLogEntry[];
  blockedReason?: string;
  blockedBy?: string[];
  lastActionAt?: string;
  needsApproval?: boolean;
  approvedAt?: string;
  approvedBy?: string;

  // Session Binding (for bot autonomy + crash recovery)
  sessionKey?: string | null;
  sessionLockedAt?: string | null;

  // GitHub Repository Integration
  github_repo?: {
    name: string;
    owner: string;
    description?: string;
    private: boolean;
    language: string;
    default_branch: string;
    clone_url: string;
    ssh_url?: string;
    issue_number?: number;
    html_url?: string;
  };
  github_issue?: {
    number: number;
    state: string;
    html_url?: string;
  };
  github_commit?: {
    sha: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
    added: string[];
    modified: string[];
    removed: string[];
    committed_at: string;
  };

  // AI Planning
  systemPrompt?: string;        // System prompt override for this task
  planningModel?: string;       // Which AI model to use for planning

  // Time Tracking
  estimate?: number;
  timeSpent: number;
  lastHeartbeatAt?: string;

  // State Timer
  currentStateStartedAt?: string;

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
// Progress Log Entry
// ============================================
export interface ProgressLogEntry {
  id: string;
  step: string;
  completedAt: string;
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
// Audit Event Interface
// ============================================
export interface AuditEvent {
  id: string;
  eventType: string;
  entityType: 'Task';
  entityId: string;
  actor: 'human' | 'clawdbot';
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  timestamp: string;
}

// ============================================
// API Types
// ============================================
export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  assignee?: string;
  priority?: Priority;
  tags?: string[];
  estimate?: number;
  dueDate?: string;
  planChecklist?: string[];
  needsApproval?: boolean;
  blockedBy?: string[];
  projectId?: string | null;
  systemPrompt?: string;
  planningModel?: string;
  github_repo?: {
    name: string;
    owner: string;
    issue_number?: number;
    [key: string]: unknown;
  };
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  executionState?: ExecutionState;
  assignee?: string;
  sessionKey?: string | null;
  priority?: Priority;
  tags?: string[];
  planChecklist?: string[];
  currentStepIndex?: number;
  blockedReason?: string;
  blockedBy?: string[];
  estimate?: number;
  timeSpent?: number;
  dueDate?: string;
  results?: string;
  needsApproval?: boolean;
  approvedAt?: string;
  approvedBy?: string;
  lastActionAt?: string;
  lastHeartbeatAt?: string;
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

// ============================================
// Bot Run (for API wsServer / runs)
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
