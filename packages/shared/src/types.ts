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
  assignee?: string;
  priority: Priority;
  tags: string[];

  // Bot Observability
  planChecklist: string[];
  currentStepIndex: number;
  progressLog: ProgressLogEntry[];
  blockedReason?: string;
  lastActionAt?: string;

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
  assignee?: string;
  priority?: Priority;
  tags?: string[];
  estimate?: number;
  dueDate?: string;
  planChecklist?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  assignee?: string;
  sessionKey?: string | null;
  priority?: Priority;
  tags?: string[];
  planChecklist?: string[];
  currentStepIndex?: number;
  blockedReason?: string;
  estimate?: number;
  timeSpent?: number;
  dueDate?: string;
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
}

// ============================================
// Column with Tasks
// ============================================
export interface Column {
  status: TaskStatus;
  tasks: Task[];
  taskCount: number;
}
