-- AlterTable
ALTER TABLE "Task" ADD COLUMN "planDocument" TEXT;

-- CreateTable
CREATE TABLE "TaskPlanningMessage" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskPlanningMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskPlanningMessage_taskId_idx" ON "TaskPlanningMessage"("taskId");

-- CreateIndex
CREATE INDEX "TaskPlanningMessage_createdAt_idx" ON "TaskPlanningMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "TaskPlanningMessage" ADD CONSTRAINT "TaskPlanningMessage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
