import { Task, CreateTaskInput, UpdateTaskInput, TaskStatus, ExecutionState, TaskStateLog } from '../shared-types';

const base = (import.meta.env?.VITE_API_URL ?? '').toString().trim().replace(/\/$/, '');
const API_BASE = base ? `${base}/api/v1` : '/api/v1';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      // Only set Content-Type for requests with body
      ...(options?.body && { 'Content-Type': 'application/json' }),
      ...options?.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  // Handle 204 No Content responses (DELETE operations)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  async getTasks(filters?: {
    status?: TaskStatus;
    assignee?: string;
    priority?: string;
    tags?: string;
  }): Promise<{ tasks: Task[] }> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.assignee) params.append('assignee', filters.assignee);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.tags) params.append('tags', filters.tags);

    const url = `${API_BASE}/tasks${params.toString() ? `?${params.toString()}` : ''}`;
    return fetchJson(url);
  },

  async getTask(id: string): Promise<{ task: Task }> {
    return fetchJson(`${API_BASE}/tasks/${id}`);
  },

  async createTask(input: CreateTaskInput): Promise<{ task: Task }> {
    return fetchJson(`${API_BASE}/tasks`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  async updateTask(id: string, input: UpdateTaskInput): Promise<{ task: Task }> {
    return fetchJson(`${API_BASE}/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
  },

  async updateTaskExecution(id: string, executionState: ExecutionState): Promise<{ task: Task }> {
    return fetchJson(`${API_BASE}/tasks/${id}/execution`, {
      method: 'PUT',
      body: JSON.stringify({ executionState })
    });
  },

  async moveTask(id: string, status: TaskStatus): Promise<{ task: Task }> {
    return fetchJson(`${API_BASE}/tasks/${id}/move`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  async deleteTask(id: string): Promise<void> {
    await fetchJson<void>(`${API_BASE}/tasks/${id}`, {
      method: 'DELETE'
    });
  },

  async getTaskEvents(id: string): Promise<{ events: unknown[] }> {
    return fetchJson(`${API_BASE}/tasks/${id}/events`);
  },

  async getTaskStateLogs(id: string): Promise<{ logs: TaskStateLog[] }> {
    return fetchJson(`${API_BASE}/tasks/${id}/state-logs`);
  },

  async getBoardSummary(): Promise<{ summary: { tasksThisWeek: number; inProgress: number; total: number; completionPercent: number; runningBots: number; idleTasks: number; blockedTasks: number } }> {
    return fetchJson(`${API_BASE}/board/summary`);
  },

  async clearDemoData(): Promise<{ deleted: number }> {
    return fetchJson(`${API_BASE}/tasks/clear-demo`, {
      method: 'DELETE'
    });
  }
};
