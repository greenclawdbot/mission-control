import { buildApp } from './app';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
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

async function main() {
  // Ensure logs directory exists
  await mkdir(LOG_DIR, { recursive: true });
  
  // Create log file with timestamp
  const logFile = createWriteStream(join(LOG_DIR, `api-${Date.now()}.log`), { flags: 'a' });
  
  // Custom logging
  const originalLog = console.log;
  const originalError = console.error;
  
  function writeLog(level: string, msg: string) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] ${msg}\n`;
    logFile.write(line);
  }
  
  console.log = (...args) => {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    writeLog('INFO', msg);
    originalLog.apply(console, args);
  };
  
  console.error = (...args) => {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    writeLog('ERROR', msg);
    originalError.apply(console, args);
  };

  // Prevent silent crashes - write directly to stderr for crash reports
  process.on('uncaughtException', (err) => {
    console.error('FATAL UNCAUGHT EXCEPTION:', err.message);
    console.error(err.stack);
    process.stderr.write(`FATAL: ${err.message}\n${err.stack}\n`);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason) => {
    console.error('FATAL UNHANDLED REJECTION:', reason);
    process.stderr.write(`FATAL REJECTION: ${reason}\n`);
    process.exit(1);
  });

  // Watchdog - if no heartbeat in 90s, restart
  let lastActivity = Date.now();
  setInterval(() => {
    if (Date.now() - lastActivity > 90000) {
      console.error('WATCHDOG: No activity for 90s, restarting...');
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
    console.log(`🚀 Mission Control API running on http://${HOST}:${PORT}`);
    console.log(`📋 API docs at http://${HOST}:${PORT}/api/v1`);
    console.log(`📝 Logs at ${LOG_DIR}`);
    console.log(`🐕 Watchdog active - will restart if no activity for 90s`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

main();
