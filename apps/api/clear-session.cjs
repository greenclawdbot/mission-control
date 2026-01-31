const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearSessions() {
  console.log('Clearing sessionKey for blocked tasks...');
  
  const tasks = await prisma.task.findMany({
    where: {
      status: { in: ['Ready', 'InProgress'] },
      sessionKey: { not: null }
    }
  });
  
  console.log('Found tasks with sessionKeys:', tasks.map(t => ({ id: t.id, status: t.status, sessionKey: t.sessionKey })));
  
  for (const task of tasks) {
    await prisma.task.update({
      where: { id: task.id },
      data: { sessionKey: null }
    });
    console.log('Cleared sessionKey for:', task.id);
  }
  
  console.log('Done!');
}

clearSessions().catch(console.error);
