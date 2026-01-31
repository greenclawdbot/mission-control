import { WebSocket } from 'ws';
import { Task, BotRun } from '../../../shared/src/types';

// ============================================
// WebSocket Server for Live Updates
// ============================================

interface WebSocketClient {
  ws: WebSocket;
  subscriptions: Set<string>;
  connectedAt: Date;
}

interface WSMessage {
  type: string;
  payload?: unknown;
}

interface TaskEvent {
  type: 'task:created' | 'task:updated' | 'task:deleted' | 'task:execution:updated';
  data: Task;
  timestamp: string;
}

interface RunEvent {
  type: 'run:created' | 'run:updated' | 'run:completed';
  data: BotRun & { taskId: string };
  timestamp: string;
}

interface EventLogEvent {
  type: 'event:appended';
  data: {
    taskId: string;
    eventType: string;
    actor: string;
    timestamp: string;
  };
  timestamp: string;
}

type WSOutgoingMessage = TaskEvent | RunEvent | EventLogEvent;

// Active connections
const clients = new Set<WebSocketClient>();

// ============================================
// Connection Management
// ============================================

export function handleWebSocketConnection(ws: WebSocket): void {
  const client: WebSocketClient = {
    ws,
    subscriptions: new Set(['tasks', 'runs', 'events']),
    connectedAt: new Date()
  };

  clients.add(client);
  console.log(`[WS] Client connected. Total: ${clients.size}`);

  // Send welcome message
  const welcomeMsg = JSON.stringify({
    type: 'connected',
    clientCount: clients.size,
    timestamp: new Date().toISOString()
  });
  console.log(`[WS] Sending welcome: ${welcomeMsg}`);
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(welcomeMsg);
  } else {
    console.log(`[WS] Socket not open, readyState: ${ws.readyState}`);
  }

  // Handle incoming messages
  ws.on('message', (rawData: Buffer) => {
    try {
      const message: WSMessage = JSON.parse(rawData.toString());
      handleClientMessage(client, message);
    } catch (error) {
      console.error('[WS] Invalid message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    clients.delete(client);
    console.log(`[WS] Client disconnected. Total: ${clients.size}`);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('[WS] Client error:', error);
    clients.delete(client);
  });
}

// ============================================
// Client Message Handling
// ============================================

function handleClientMessage(client: WebSocketClient, message: WSMessage): void {
  const { ws } = client;

  switch (message.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      break;

    case 'subscribe':
      // message.payload can be string or string[]
      const channels = Array.isArray(message.payload) 
        ? message.payload 
        : [message.payload].filter(Boolean);
      channels.forEach((channel: string) => {
        if (['tasks', 'runs', 'events'].includes(channel)) {
          client.subscriptions.add(channel);
        }
      });
      ws.send(JSON.stringify({ 
        type: 'subscribed', 
        subscriptions: Array.from(client.subscriptions) 
      }));
      break;

    case 'unsubscribe':
      const toRemove = Array.isArray(message.payload)
        ? message.payload
        : [message.payload].filter(Boolean);
      toRemove.forEach((channel: string) => {
        client.subscriptions.delete(channel);
      });
      ws.send(JSON.stringify({ 
        type: 'unsubscribed', 
        subscriptions: Array.from(client.subscriptions) 
      }));
      break;

    case 'getState':
      // Client requesting full state refresh
      ws.send(JSON.stringify({ type: 'state:refresh', subscriptions: Array.from(client.subscriptions) }));
      break;

    default:
      ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${message.type}` }));
  }
}

// ============================================
// Event Broadcasting
// ============================================

function broadcast(message: WSOutgoingMessage): void {
  const payload = JSON.stringify(message);
  const messageStr = payload;

  clients.forEach((client) => {
    const { ws, subscriptions } = client;

    // Check if client is subscribed to this event type
    const eventCategory = message.type.split(':')[0]; // 'task', 'run', 'event'
    if (!subscriptions.has(eventCategory) && !subscriptions.has('*')) {
      return;
    }

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  });
}

// ============================================
// Task Events
// ============================================

export function emitTaskEvent(type: TaskEvent['type'], data: Task): void {
  const event: TaskEvent = {
    type,
    data,
    timestamp: new Date().toISOString()
  };
  broadcast(event);
}

// ============================================
// Run Events
// ============================================

export function emitRunEvent(type: RunEvent['type'], data: BotRun & { taskId: string }): void {
  const event: RunEvent = {
    type,
    data,
    timestamp: new Date().toISOString()
  };
  broadcast(event);
}

// ============================================
// Event Log Events
// ============================================

export function emitEventLogEvent(
  taskId: string, 
  eventType: string, 
  actor: string
): void {
  const event: EventLogEvent = {
    type: 'event:appended',
    data: {
      taskId,
      eventType,
      actor,
      timestamp: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  };
  broadcast(event);
}

// ============================================
// Utility Functions
// ============================================

export function getClientCount(): number {
  return clients.size;
}

export function getActiveSubscriptions(): Record<string, number> {
  const counts: Record<string, number> = {
    tasks: 0,
    runs: 0,
    events: 0
  };

  clients.forEach((client) => {
    client.subscriptions.forEach((sub) => {
      if (counts[sub] !== undefined) {
        counts[sub]++;
      }
    });
  });

  return counts;
}

export function closeAllConnections(): void {
  clients.forEach((client) => {
    client.ws.close(1000, 'Server shutting down');
  });
  clients.clear();
}
