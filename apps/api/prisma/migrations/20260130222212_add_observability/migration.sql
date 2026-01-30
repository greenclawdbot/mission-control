-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "blockedBy" TEXT[],
ADD COLUMN     "executionState" TEXT NOT NULL DEFAULT 'queued',
ADD COLUMN     "lastHeartbeatAt" TIMESTAMP(3),
ADD COLUMN     "needsApproval" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TaskProgressLogEntry" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'done';

-- CreateTable
CREATE TABLE "BotRun" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "summary" TEXT,
    "log" JSONB,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "parentRunId" TEXT,

    CONSTRAINT "BotRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDependency" (
    "id" TEXT NOT NULL,
    "dependentTaskId" TEXT NOT NULL,
    "dependencyTaskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BotRun_taskId_idx" ON "BotRun"("taskId");

-- CreateIndex
CREATE INDEX "BotRun_status_idx" ON "BotRun"("status");

-- CreateIndex
CREATE INDEX "BotRun_startedAt_idx" ON "BotRun"("startedAt");

-- CreateIndex
CREATE INDEX "TaskDependency_dependentTaskId_idx" ON "TaskDependency"("dependentTaskId");

-- CreateIndex
CREATE INDEX "TaskDependency_dependencyTaskId_idx" ON "TaskDependency"("dependencyTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDependency_dependentTaskId_dependencyTaskId_key" ON "TaskDependency"("dependentTaskId", "dependencyTaskId");

-- CreateIndex
CREATE INDEX "AuditEvent_taskId_idx" ON "AuditEvent"("taskId");

-- CreateIndex
CREATE INDEX "Task_executionState_idx" ON "Task"("executionState");

-- CreateIndex
CREATE INDEX "TaskProgressLogEntry_taskId_idx" ON "TaskProgressLogEntry"("taskId");

-- AddForeignKey
ALTER TABLE "BotRun" ADD CONSTRAINT "BotRun_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_dependentTaskId_fkey" FOREIGN KEY ("dependentTaskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_dependencyTaskId_fkey" FOREIGN KEY ("dependencyTaskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
