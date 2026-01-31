import { useEffect, useState, useCallback } from 'react';
import { Task } from '../shared-types';

// ============================================
// SSE Event Types
// ============================================

interface TaskEvent {
  type: 'task:created' | 'task:updated' | 'task:deleted';
  data: Task;
  timestamp: string;
}

interface SSEEvent {
  type: string;
  data?: unknown;
  timestamp?: string;
}

// ============================================
// SSE Hook
// ============================================

export function useSSE() {
  const [connected, setConnected] = useState(false);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Close existing connection
    if (eventSource) {
      eventSource.close();
    }

    const es = new EventSource('/api/v1/events');
    
    es.onopen = () => {
      console.log('[SSE] Connected');
      setConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[SSE] Received:', data);
      } catch (error) {
        console.error('[SSE] Parse error:', error);
      }
    };

    es.onerror = (error) => {
      console.error('[SSE] Error:', error);
      setConnected(false);
      // Auto-reconnect after delay
      setTimeout(() => {
        if (!connected) {
          connect();
        }
      }, 5000);
    };

    setEventSource(es);

    return () => {
      es.close();
    };
  }, [eventSource, connected]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [connect]);

  return { connected, connect };
}

// ============================================
// Task Store with SSE Support
// ============================================

export function createSSETaskStore(initialTasks: Task[]) {
  let tasks = [...initialTasks];
  const listeners = new Set<(tasks: Task[]) => void>();

  const subscribe = (listener: (tasks: Task[]) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const getTasks = () => tasks;

  const handleTaskCreated = (task: Task) => {
    tasks = [task, ...tasks];
    listeners.forEach(listener => listener(tasks));
  };

  const handleTaskUpdated = (updatedTask: Task) => {
    tasks = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    listeners.forEach(listener => listener(tasks));
  };

  const handleTaskDeleted = (taskId: string) => {
    tasks = tasks.filter(t => t.id !== taskId);
    listeners.forEach(listener => listener(tasks));
  };

  return {
    subscribe,
    getTasks,
    handleTaskCreated,
    handleTaskUpdated,
    handleTaskDeleted
  };
}
