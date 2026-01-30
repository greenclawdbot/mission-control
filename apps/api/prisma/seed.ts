import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEED_DEMO = process.env.SEED_DEMO === 'true' || process.env.SEED_DEMO === '1';

async function main() {
  console.log('🌱 Checking database...');

  // Check if DB is already populated
  const existingCount = await prisma.task.count();
  
  if (existingCount > 0) {
    console.log(`📦 Database already has ${existingCount} tasks. Skipping seed.`);
    
    // Still ensure executionState field exists on existing records
    if (SEED_DEMO) {
      console.log('🔄 Updating existing tasks with execution state...');
      await prisma.task.updateMany({
        where: { executionState: null },
        data: { executionState: 'queued' }
      });
    }
    return;
  }

  if (!SEED_DEMO) {
    console.log('ℹ️  SEED_DEMO not set. Skipping demo data seed.');
    console.log('💡 Set SEED_DEMO=true to add demo tasks.');
    return;
  }

  console.log('🌱 Seeding demo database...');

  // Create demo tasks
  const tasks = [
    {
      title: 'Set up CI/CD pipeline',
      description: 'Configure GitHub Actions for automated testing and deployment',
      status: 'Done' as const,
      executionState: 'completed' as const,
      assignee: 'clawdbot',
      priority: 'High' as const,
      tags: ['devops', 'infrastructure'],
      estimate: 3,
      timeSpent: 2.5,
      planChecklist: ['Research CI/CD options', 'Create GitHub Actions workflow', 'Test pipeline'],
      currentStepIndex: 2,
      progressLog: [
        { step: 'Researched GitHub Actions', completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        { step: 'Created workflow file', completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        { step: 'Verified pipeline works', completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) }
      ],
      startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      lastActionAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    },
    {
      title: 'Add unit tests for auth module',
      description: 'Write comprehensive tests for the authentication system',
      status: 'InProgress' as const,
      executionState: 'running' as const,
      assignee: 'clawdbot',
      priority: 'High' as const,
      tags: ['testing', 'auth'],
      estimate: 5,
      timeSpent: 2,
      planChecklist: ['Write tests for login', 'Write tests for registration', 'Write tests for token refresh', 'Achieve 80% coverage'],
      currentStepIndex: 1,
      progressLog: [
        { step: 'Completed login tests', completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }
      ],
      startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      lastActionAt: new Date(Date.now() - 30 * 60 * 1000)
    },
    {
      title: 'Refactor database schema',
      description: 'Optimize table structure and add indexes for better performance',
      status: 'Ready' as const,
      executionState: 'queued' as const,
      assignee: 'clawdbot',
      priority: 'Medium' as const,
      tags: ['database', 'performance'],
      estimate: 4,
      planChecklist: ['Analyze current schema', 'Design optimized schema', 'Create migration', 'Apply migration with zero downtime'],
      currentStepIndex: 0
    },
    {
      title: 'Add dark mode support',
      description: 'Implement dark mode theme across the entire application',
      status: 'Blocked' as const,
      executionState: 'waiting' as const,
      assignee: 'clawdbot',
      priority: 'Low' as const,
      tags: ['frontend', 'ui'],
      estimate: 2,
      blockedReason: 'Waiting on design system update',
      lastActionAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
    },
    {
      title: 'Review PR #142',
      description: 'Review the new feature implementation for the dashboard',
      status: 'Review' as const,
      executionState: 'idle' as const,
      assignee: 'human',
      priority: 'Medium' as const,
      tags: ['code-review'],
      estimate: 1,
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      lastActionAt: new Date(Date.now() - 5 * 60 * 60 * 1000)
    },
    {
      title: 'Document API endpoints',
      description: 'Update OpenAPI specification with all current endpoints',
      status: 'Backlog' as const,
      executionState: 'queued' as const,
      assignee: 'human',
      priority: 'Low' as const,
      tags: ['documentation'],
      estimate: 3
    },
    {
      title: 'Optimize image uploads',
      description: 'Implement image compression before storage',
      status: 'Backlog' as const,
      executionState: 'queued' as const,
      assignee: 'clawdbot',
      priority: 'Medium' as const,
      tags: ['performance', 'backend'],
      estimate: 4,
      planChecklist: ['Research compression libraries', 'Implement upload handler', 'Add tests'],
      currentStepIndex: 0
    },
    {
      title: 'User feedback survey',
      description: 'Send out Q1 user satisfaction survey',
      status: 'Ready' as const,
      executionState: 'queued' as const,
      assignee: 'human',
      priority: 'Medium' as const,
      tags: ['product', 'research'],
      estimate: 2
    },
    {
      title: 'Server deployment task',
      description: 'Deploy the new server configuration',
      status: 'Ready' as const,
      executionState: 'failed' as const,
      assignee: 'clawdbot',
      priority: 'High' as const,
      tags: ['devops', 'deployment'],
      estimate: 2,
      lastActionAt: new Date(Date.now() - 3 * 60 * 60 * 1000)
    },
    {
      title: 'Pending approval task',
      description: 'This task is waiting for human approval',
      status: 'Ready' as const,
      executionState: 'waiting' as const,
      assignee: 'clawdbot',
      priority: 'Critical' as const,
      tags: ['testing'],
      estimate: 1,
      needsApproval: true,
      lastActionAt: new Date(Date.now() - 1 * 60 * 60 * 1000)
    }
  ];

  for (const task of tasks) {
    const { progressLog, ...taskData } = task;
    await prisma.task.create({
      data: {
        ...taskData,
        progressLog: progressLog ? {
          create: progressLog.map(log => ({
            step: log.step,
            completedAt: log.completedAt
          }))
        } : undefined
      }
    });
  }

  console.log('✅ Demo database seeded with', tasks.length, 'tasks');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
