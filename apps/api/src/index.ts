import { buildApp } from './app';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load .env from monorepo root (apps/api/src -> up 3 levels)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..', '..');
config({ path: join(projectRoot, '.env') });

const PORT = parseInt(process.env.API_PORT || process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const LOG_DIR = join(process.cwd(), '.logs');
const logFilePath = join(LOG_DIR, `api-${Date.now()}.log`);

function appLog(level: string, msg: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${msg}\n`;
  try {
    writeFileSync(logFilePath, line, { flag: 'a' });
  } catch (e) {
    // Ignore write errors
  }
  if (level === 'ERROR') {
    process.stderr.write(`[${level}] ${msg}\n`);
  } else {
    process.stdout.write(`[${level}] ${msg}\n`);
  }
}

async function main() {
  // Ensure logs directory exists
  try {
    mkdirSync(LOG_DIR, { recursive: true });
  } catch (e) {
    // Ignore if already exists (e.g. EEXIST)
  }

  // Prevent silent crashes
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

  // Watchdog disabled for debugging
  /*
  let lastActivity = Date.now();
  setInterval(() => {
    const now = Date.now();
    const inactive = now - lastActivity;
    if (inactive > 86400000) { // 24 hours
      appLog('ERROR', 'WATCHDOG: No activity for 24h, restarting...');
      process.stderr.write(`WATCHDOG: No activity for 24h, restarting...\n`);
      process.exit(1);
    }
  }, 60000);

  function markActivity() {
    lastActivity = Date.now();
  }
  */

  const app = await buildApp();

  // Removed onRequest hook that might be blocking

  try {
    await app.listen({ port: PORT, host: HOST });
    appLog('INFO', `🚀 Mission Control API running on http://${HOST}:${PORT}`);
    appLog('INFO', `📋 API docs at http://${HOST}:${PORT}/api/v1`);
    appLog('INFO', `📝 Logs at ${LOG_DIR}`);
    appLog('INFO', `🐕 Watchdog disabled`);
  } catch (err) {
    appLog('ERROR', `Failed to start server: ${err}`);
    process.exit(1);
  }
}

main();
