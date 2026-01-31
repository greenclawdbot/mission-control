import { buildApp } from './app';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';

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

  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Mission Control API running on http://${HOST}:${PORT}`);
    console.log(`📋 API docs at http://${HOST}:${PORT}/api/v1`);
    console.log(`📝 Logs at ${LOG_DIR}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

main();
