#!/usr/bin/env node
/**
 * Backfill TaskConversationMessage from existing Task.description, Additional Context blocks, and BotRuns.
 * Run from repo root: npm run db:backfill-conversation (or from apps/api: node backfill-conversation.cjs)
 * Requires DATABASE_URL (e.g. from root .env).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CONTEXT_REGEX = /---\s*\*\*Additional Context \((.+?)\):\*\*\s*([\s\S]*?)(?=---|$)/g;

function parseContextBlocks(description) {
  if (!description || !description.trim()) return [];
  const blocks = [];
  let match;
  CONTEXT_REGEX.lastIndex = 0;
  while ((match = CONTEXT_REGEX.exec(description)) !== null) {
    const timestampStr = match[1].trim();
    const content = match[2].trim();
    let createdAt = new Date();
    try {
      const parsed = new Date(timestampStr);
      if (!isNaN(parsed.getTime())) createdAt = parsed;
    } catch (_) {}
    blocks.push({ content, createdAt });
  }
  return blocks;
}

function getInitialDescriptionWithoutContextBlocks(description) {
  if (!description || !description.trim()) return '';
  const first = description.indexOf('---');
  if (first === -1) return description.trim();
  return description.slice(0, first).trim();
}

async function backfill() {
  const tasks = await prisma.task.findMany({
    include: {
      botRuns: { orderBy: { startedAt: 'asc' } }
    }
  });

  let created = 0;
  let skipped = 0;

  for (const task of tasks) {
    const existing = await prisma.taskConversationMessage.count({ where: { taskId: task.id } });
    if (existing > 0) {
      skipped++;
      continue;
    }

    const toCreate = [];

    const initialContent = getInitialDescriptionWithoutContextBlocks(task.description);
    toCreate.push({
      taskId: task.id,
      role: 'user',
      content: initialContent,
      createdAt: task.createdAt
    });

    const contextBlocks = parseContextBlocks(task.description);
    for (const block of contextBlocks) {
      toCreate.push({
        taskId: task.id,
        role: 'user',
        content: block.content,
        createdAt: block.createdAt
      });
    }

    const completedOrFailedRuns = task.botRuns.filter(
      (r) => r.status === 'completed' || r.status === 'failed'
    );
    const lastCompletedOrFailedRun = completedOrFailedRuns[completedOrFailedRuns.length - 1];
    for (const run of completedOrFailedRuns) {
      const useTaskResults = run.id === lastCompletedOrFailedRun?.id && task.results && task.results.trim();
      const content = (run.summary && run.summary.trim()) || (useTaskResults ? task.results : '') || '';
      toCreate.push({
        taskId: task.id,
        role: 'assistant',
        content: content || '(No summary)',
        createdAt: run.endedAt || run.startedAt,
        botRunId: run.id
      });
    }
    if (task.results && task.results.trim() && completedOrFailedRuns.length === 0) {
      toCreate.push({
        taskId: task.id,
        role: 'assistant',
        content: task.results.trim(),
        createdAt: task.lastActionAt || task.updatedAt || task.createdAt,
        botRunId: null
      });
    }

    if (toCreate.length > 1 || (toCreate.length === 1 && toCreate[0].role === 'user')) {
      await prisma.$transaction(
        toCreate.map((row) =>
          prisma.taskConversationMessage.create({
            data: {
              taskId: row.taskId,
              role: row.role,
              content: row.content,
              createdAt: row.createdAt,
              ...(row.botRunId && { botRunId: row.botRunId })
            }
          })
        )
      );
      created += toCreate.length;
    }
  }

  console.log('Backfill done. Created', created, 'messages; skipped', skipped, 'tasks (already had messages).');
}

async function supplement() {
  const tasks = await prisma.task.findMany({
    where: { results: { not: null } },
    select: { id: true, results: true, updatedAt: true, lastActionAt: true }
  });
  let added = 0;
  for (const task of tasks) {
    if (!task.results || !task.results.trim()) continue;
    const existing = await prisma.taskConversationMessage.findMany({
      where: { taskId: task.id, role: 'assistant' },
      orderBy: { createdAt: 'asc' },
      select: { content: true }
    });
    const hasFullResults = existing.some((m) => m.content && m.content.trim() === task.results.trim());
    if (hasFullResults) continue;
    const createdAt = task.lastActionAt || task.updatedAt;
    await prisma.taskConversationMessage.create({
      data: {
        taskId: task.id,
        role: 'assistant',
        content: task.results.trim(),
        createdAt: createdAt || new Date()
      }
    });
    added++;
  }
  console.log('Supplement done. Added', added, 'assistant messages from Task.results.');
}

const mode = process.argv[2] === 'supplement' ? 'supplement' : 'backfill';
(mode === 'supplement' ? supplement() : backfill())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
