-- CreateTable
CREATE TABLE "TaskConversationMessage" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "botRunId" TEXT,

    CONSTRAINT "TaskConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskConversationMessage_taskId_idx" ON "TaskConversationMessage"("taskId");

-- CreateIndex
CREATE INDEX "TaskConversationMessage_createdAt_idx" ON "TaskConversationMessage"("createdAt");

-- CreateIndex
CREATE INDEX "TaskConversationMessage_botRunId_idx" ON "TaskConversationMessage"("botRunId");

-- AddForeignKey
ALTER TABLE "TaskConversationMessage" ADD CONSTRAINT "TaskConversationMessage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskConversationMessage" ADD CONSTRAINT "TaskConversationMessage_botRunId_fkey" FOREIGN KEY ("botRunId") REFERENCES "BotRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
