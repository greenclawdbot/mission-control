import { useEffect, useState, useRef, useCallback } from 'react';
import { Task } from '../shared-types';

// ============================================
// SSE Event Types
// ============================================

interface TaskEvent {
  type: 'task:created' | 'task:updated' | 'task:deleted';
  data: Task;
  timestamp: string;
}

interface SystemPulseEvent {
  type: 'system:pulse';
  timestamp: string;
  nextCheck: string;
}

interface SSEEvent {
  type: string;
  data?: unknown;
  timestamp?: string;
  nextCheck?: string;
}

// ============================================
// SSE Hook
// ============================================

export function useSSE(onTaskEvent?: (event: { type: string; data: Task }) => void) {
  const [connected, setConnected] = useState(false);
  const [nextCheck, setNextCheck] = useState<Date | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Close any existing connection
    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch (e) {
        // Ignore
      }
    }

    const base = (import.meta.env?.VITE_API_URL ?? '').toString().trim().replace(/\/$/, '');
    const sseUrl = base ? `${base}/api/v1/events` : `${window.location.origin}/api/v1/events`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      console.log('[SSE] Connected');
      setConnected(true);
      // Clear reconnect timeout if connected
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[SSE] Received:', data);
        
        // Handle task events - data.type is like 'task:updated', 'task:created', 'task:deleted'
        if (onTaskEvent && data.type && data.type.startsWith('task:')) {
          onTaskEvent({ type: data.type, data: data.data });
        }
        
        // Handle system pulse events for countdown timer
        if (data.type === 'system:pulse' && data.nextCheck) {
          setNextCheck(new Date(data.nextCheck));
        }
      } catch (error) {
        console.error('[SSE] Parse error:', error);
      }
    };

    es.onerror = (error) => {
      console.error('[SSE] Error:', error);
      setConnected(false);
      
      // Only reconnect if the connection was previously open
      // and we haven't already scheduled a reconnect
      if (es.readyState === EventSource.CLOSED && !reconnectTimeoutRef.current) {
        console.log('[SSE] Scheduling reconnect in 5s...');
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[SSE] Reconnecting...');
          reconnectTimeoutRef.current = null;
          connect();
        }, 5000);
      }
    };

    return es;
  }, []);

  useEffect(() => {
    const es = connect();
    
    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (es && es.close) {
        try {
          es.close();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [connect]);

  return { connected, nextCheck };
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
