// Simple SSE client manager - no streams, just raw response.write
const clients = new Map<string, any>();
let clientCounter = 0;

// Pulse interval ID (2-minute check cycle)
let pulseIntervalId: NodeJS.Timeout | null = null;
const PULSE_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

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

// ============================================
// Pulse/Heartbeat for Countdown Timer
// ============================================

// Start the pulse emitter
export function startPulseEmitter(emitFn: () => void): void {
  if (pulseIntervalId) {
    clearInterval(pulseIntervalId);
  }
  
  // Emit immediately on start, then every 2 minutes
  emitFn();
  pulseIntervalId = setInterval(() => {
    emitFn();
  }, PULSE_INTERVAL_MS);
  
  console.log(`[SSE] Pulse emitter started (${PULSE_INTERVAL_MS / 1000}s interval)`);
}

// Stop the pulse emitter
export function stopPulseEmitter(): void {
  if (pulseIntervalId) {
    clearInterval(pulseIntervalId);
    pulseIntervalId = null;
    console.log('[SSE] Pulse emitter stopped');
  }
}

// Get next pulse timestamp
export function getNextPulseTime(): Date {
  return new Date(Date.now() + PULSE_INTERVAL_MS);
}

// Emit a pulse event with current server timestamp
export function emitPulseEvent(): void {
  const timestamp = new Date().toISOString();
  const nextCheck = getNextPulseTime().toISOString();
  const message = `data: ${JSON.stringify({ type: 'system:pulse', timestamp, nextCheck })}\n\n`;
  
  let sent = 0;
  clients.forEach((res, clientId) => {
    try {
      res.write(message);
      sent++;
    } catch (error) {
      console.error(`[SSE] Error sending pulse to ${clientId}:`, error);
      clients.delete(clientId);
    }
  });
  console.log(`[SSE] Emitted system:pulse to ${sent} clients`);
}
