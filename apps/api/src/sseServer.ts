import type { Task, BotRun } from '../../../shared/src/types';

// ============================================
// SSE Server for Live Updates
// ============================================

interface SSEClient {
  id: string;
  controller: ReadableStreamDefaultController;
  subscriptions: Set<string>;
  connectedAt: Date;
}

const clients = new Map<string, SSEClient>();
let clientCounter = 0;

const HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Access-Control-Allow-Origin': '*'
};

export function handleSSEConnection(controller: ReadableStreamDefaultController): string {
  const clientId = `client_${++clientCounter}`;
  
  clients.set(clientId, {
    id: clientId,
    controller,
    subscriptions: new Set(['tasks', 'runs', 'events']),
    connectedAt: new Date()
  });

  console.log(`[SSE] Client ${clientId} connected. Total: ${clients.size}`);

  // Send initial connection message
  sendToClient(clientId, {
    type: 'connected',
    clientId,
    timestamp: new Date().toISOString()
  });

  return clientId;
}

export function disconnectSSEClient(clientId: string): void {
  const client = clients.get(clientId);
  if (client) {
    clients.delete(clientId);
    console.log(`[SSE] Client ${clientId} disconnected. Total: ${clients.size}`);
  }
}

function sendToClient(clientId: string, event: object): void {
  const client = clients.get(clientId);
  if (!client) return;

  try {
    const data = JSON.stringify(event);
    client.controller.enqueue(`data: ${data}\n\n`);
  } catch (error) {
    console.error(`[SSE] Error sending to ${clientId}:`, error);
    clients.delete(clientId);
  }
}

function broadcast(event: object, channel: string): void {
  const message = JSON.stringify(event);
  
  clients.forEach((client) => {
    if (client.subscriptions.has(channel) || client.subscriptions.has('*')) {
      try {
        client.controller.enqueue(`data: ${message}\n\n`);
      } catch (error) {
        console.error(`[SSE] Broadcast error to ${client.id}:`, error);
        clients.delete(client.id);
      }
    }
  });
}

// ============================================
// Task Events
// ============================================

export function emitTaskEvent(type: 'task:created' | 'task:updated' | 'task:deleted', data: Task): void {
  broadcast({
    type: `task:${type.replace('task:', '')}`,
    data,
    timestamp: new Date().toISOString()
  }, 'tasks');
}

// ============================================
// Run Events
// ============================================

export function emitRunEvent(type: 'run:created' | 'run:updated' | 'run:completed', data: BotRun & { taskId: string }): void {
  broadcast({
    type: `run:${type.replace('run:', '')}`,
    data,
    timestamp: new Date().toISOString()
  }, 'runs');
}

// ============================================
// Utility Functions
// ============================================

export function getClientCount(): number {
  return clients.size;
}

export function closeAllClients(): void {
  clients.forEach((client) => {
    try {
      client.controller.close();
    } catch (e) {
      // Already closed
    }
  });
  clients.clear();
}
