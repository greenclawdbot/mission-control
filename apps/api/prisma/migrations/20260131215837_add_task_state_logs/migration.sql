-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "currentStateStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TaskStateLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),
    "duration" INTEGER,

    CONSTRAINT "TaskStateLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskStateLog_taskId_idx" ON "TaskStateLog"("taskId");

-- CreateIndex
CREATE INDEX "TaskStateLog_status_idx" ON "TaskStateLog"("status");

-- CreateIndex
CREATE INDEX "TaskStateLog_enteredAt_idx" ON "TaskStateLog"("enteredAt");

-- AddForeignKey
ALTER TABLE "TaskStateLog" ADD CONSTRAINT "TaskStateLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
