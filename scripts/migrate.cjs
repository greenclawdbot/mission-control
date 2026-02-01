#!/usr/bin/env node
/**
 * Run Prisma migrations using DATABASE_URL from the repo root .env.
 * Use from repo root: npm run db:migrate
 *
 * - npm run db:migrate       → prisma migrate deploy (apply pending migrations)
 * - npm run db:migrate:dev   → prisma migrate dev (apply + create new migrations)
 */
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const apiDir = path.join(rootDir, 'apps', 'api');
const envPath = path.join(rootDir, '.env');

require('dotenv').config({ path: envPath });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Create a .env file in the repo root (see .env.example).');
  process.exit(1);
}

const command = process.argv[2] === 'dev' ? 'migrate dev' : 'migrate deploy';
console.log(`Running: prisma ${command} (from apps/api, env from root .env)\n`);

execSync(`npx prisma ${command}`, {
  cwd: apiDir,
  env: process.env,
  stdio: 'inherit'
});
