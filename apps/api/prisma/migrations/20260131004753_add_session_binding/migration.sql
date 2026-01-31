-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "sessionKey" TEXT,
ADD COLUMN     "sessionLockedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Task_sessionKey_idx" ON "Task"("sessionKey");
