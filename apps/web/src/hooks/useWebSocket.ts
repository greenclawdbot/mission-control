import { useEffect, useState, useCallback } from 'react';
import { Task } from '../shared-types';

// ============================================
// WebSocket Event Types
// ============================================

interface TaskEvent {
  type: 'task:created' | 'task:updated' | 'task:deleted' | 'task:execution:updated';
  data: Task;
  timestamp: string;
}

interface WSMessage {
  type: string;
  payload?: unknown;
  data?: unknown;
  timestamp?: string;
}

interface UseWebSocketOptions {
  onTaskCreated?: (task: Task) => void;
  onTaskUpdated?: (task: Task) => void;
  onTaskDeleted?: (taskId: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

// ============================================
// WebSocket Hook
// ============================================

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const connect = useCallback(() => {
    // Only connect in browser
    if (typeof window === 'undefined') return;

    const base = (import.meta.env?.VITE_API_URL ?? '').toString().trim().replace(/\/$/, '');
    const wsUrl = base
      ? `${base.replace(/^http/, 'ws')}/api/v1/ws`
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('[WS] Connected');
      setConnected(true);
      
      // Subscribe to task updates
      socket.send(JSON.stringify({
        type: 'subscribe',
        payload: 'tasks'
      }));

      if (options.onConnected) {
        options.onConnected();
      }
    };

    socket.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        
        switch (message.type) {
          case 'task:created':
            if (options.onTaskCreated && message.data) {
              options.onTaskCreated(message.data as Task);
            }
            break;
            
          case 'task:updated':
            if (options.onTaskUpdated && message.data) {
              options.onTaskUpdated(message.data as Task);
            }
            break;
            
          case 'task:deleted':
            if (options.onTaskDeleted && message.data) {
              // message.data might contain the task or just id
              const data = message.data as { id?: string };
              if (data.id) {
                options.onTaskDeleted(data.id);
              }
            }
            break;
            
          case 'task:execution:updated':
            if (options.onTaskUpdated && message.data) {
              options.onTaskUpdated(message.data as Task);
            }
            break;
            
          case 'connected':
            console.log('[WS] Server acknowledged connection');
            break;
            
          case 'pong':
            // Heartbeat response
            break;
            
          default:
            // Ignore other message types
            break;
        }
      } catch (error) {
        console.error('[WS] Failed to parse message:', error);
      }
    };

    socket.onclose = (event) => {
      console.log('[WS] Disconnected:', event.code, event.reason);
      setConnected(false);
      
      if (options.onDisconnected) {
        options.onDisconnected();
      }
    };

    socket.onerror = (error) => {
      console.error('[WS] Error:', error);
    };

    setWs(socket);

    // Cleanup on unmount
    return () => {
      socket.close(1000, 'Component unmounted');
    };
  }, [options]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [connect]);

  const ping = useCallback(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, [ws]);

  return {
    connected,
    connect,
    ping
  };
}

// ============================================
// Task Store with WebSocket Support
// ============================================

export function createWebSocketTaskStore(initialTasks: Task[]) {
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
