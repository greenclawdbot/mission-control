// Simple SSE client manager - no streams, just raw response.write
const clients = new Map<string, any>();
let clientCounter = 0;

export function addSSEClient(res: any): string {
  const clientId = `client_${++clientCounter}`;
  clients.set(clientId, res);
  console.log(`[SSE] Client ${clientId} connected. Total: ${clients.size}`);
  return clientId;
}

export function removeSSEClient(clientId: string): void {
  if (clients.has(clientId)) {
    clients.delete(clientId);
    console.log(`[SSE] Client ${clientId} disconnected. Total: ${clients.size}`);
  }
}

export function emitTaskEvent(type: string, data: any): void {
  const eventType = type.replace('task:', '');
  const message = `data: ${JSON.stringify({ type: `task:${eventType}`, data, timestamp: new Date().toISOString() })}\n\n`;
  
  let sent = 0;
  clients.forEach((res, clientId) => {
    try {
      res.write(message);
      sent++;
    } catch (error) {
      console.error(`[SSE] Error sending to ${clientId}:`, error);
      clients.delete(clientId);
    }
  });
  console.log(`[SSE] Emitted task:${eventType} to ${sent} clients`);
}

export function emitRunEvent(type: string, data: any): void {
  const eventType = type.replace('run:', '');
  const message = `data: ${JSON.stringify({ type: `run:${eventType}`, data, timestamp: new Date().toISOString() })}\n\n`;
  
  clients.forEach((res, clientId) => {
    try {
      res.write(message);
    } catch (error) {
      console.error(`[SSE] Error sending to ${clientId}:`, error);
      clients.delete(clientId);
    }
  });
}

export function getClientCount(): number {
  return clients.size;
}
