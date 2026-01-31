const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
  console.log('All tasks:');
  const all = await prisma.task.findMany();
  console.log('Count:', all.length);
  
  console.log('\nReady tasks:');
  const ready = await prisma.task.findMany({ where: { status: 'Ready' } });
  console.log('Count:', ready.length);
  ready.forEach(t => console.log('  -', t.id, t.status, t.assignee, 'sessionKey:', t.sessionKey));
  
  console.log('\nfindFirst query:');
  const task = await prisma.task.findFirst({
    where: {
      assignee: 'clawdbot',
      status: 'Ready',
      OR: [
        { sessionKey: null },
        { sessionKey: 'mc:9999999999' }
      ]
    },
    orderBy: { createdAt: 'asc' }
  });
  console.log('Result:', task ? task.id : 'null');
}

debug().catch(console.error);
