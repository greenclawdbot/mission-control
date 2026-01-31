import { buildApp } from './app';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load .env file from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');
config({ path: join(projectRoot, '.env') });

const PORT = parseInt(process.env.API_PORT || process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const LOG_DIR = join(process.cwd(), '.logs');

// Use a simple log buffer that writes to file asynchronously
const logLines: string[] = [];
let writing = false;

async function flushLogs() {
  if (writing || logLines.length === 0) return;
  writing = true;
  const toWrite = logLines.splice(0, 100).join('');
  if (toWrite) {
    try {
      await writeFile(logFilePath, toWrite, { flag: 'a' });
    } catch (e) {
      // Ignore write errors
    }
  }
  writing = false;
  if (logLines.length > 0) {
    setImmediate(flushLogs);
  }
}

const logFilePath = join(LOG_DIR, `api-${Date.now()}.log`);

function writeLog(level: string, msg: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${msg}\n`;
  logLines.push(line);
  if (logLines.length >= 10) {
    flushLogs();
  }
}

// Don't override console - use a logger instead
function appLog(level: string, msg: string) {
  writeLog(level, msg);
  if (level === 'ERROR') {
    process.stderr.write(`[${level}] ${msg}\n`);
  } else {
    process.stdout.write(`[${level}] ${msg}\n`);
  }
}

async function main() {
  // Ensure logs directory exists
  await mkdir(LOG_DIR, { recursive: true });

  // Prevent silent crashes - write directly to stderr for crash reports
  process.on('uncaughtException', (err) => {
    appLog('ERROR', `FATAL UNCAUGHT EXCEPTION: ${err.message}`);
    process.stderr.write(`FATAL: ${err.message}\n${err.stack}\n`);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason) => {
    appLog('ERROR', `FATAL UNHANDLED REJECTION: ${String(reason)}`);
    process.stderr.write(`FATAL REJECTION: ${reason}\n`);
    process.exit(1);
  });

  // Watchdog - if no heartbeat in 90s, restart
  let lastActivity = Date.now();
  setInterval(() => {
    const now = Date.now();
    const inactive = now - lastActivity;
    if (inactive > 90000) {
      appLog('ERROR', 'WATCHDOG: No activity for 90s, restarting...');
      process.stderr.write(`WATCHDOG: No activity for 90s, restarting...\n`);
      process.exit(1);
    }
  }, 30000);

  function markActivity() {
    lastActivity = Date.now();
  }

  const app = await buildApp();

  // Wrap routes to track activity
  app.addHook('onRequest', markActivity);

  try {
    await app.listen({ port: PORT, host: HOST });
    appLog('INFO', `🚀 Mission Control API running on http://${HOST}:${PORT}`);
    appLog('INFO', `📋 API docs at http://${HOST}:${PORT}/api/v1`);
    appLog('INFO', `📝 Logs at ${LOG_DIR}`);
    appLog('INFO', `🐕 Watchdog active - will restart if no activity for 90s`);
  } catch (err) {
    appLog('ERROR', `Failed to start server: ${err}`);
    process.exit(1);
  }
}

main();
