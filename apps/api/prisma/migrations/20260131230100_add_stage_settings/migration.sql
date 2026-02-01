-- CreateTable
CREATE TABLE "StageSetting" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "projectId" TEXT,
    "stage" TEXT NOT NULL,
    "systemPrompt" TEXT,
    "defaultModel" TEXT,
    "planningDestinationStatus" TEXT,
    "readyInstructions" TEXT,

    CONSTRAINT "StageSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StageSetting_scope_projectId_stage_key" ON "StageSetting"("scope", "projectId", "stage");

-- CreateIndex
CREATE INDEX "StageSetting_scope_projectId_idx" ON "StageSetting"("scope", "projectId");

-- CreateIndex
CREATE INDEX "StageSetting_projectId_idx" ON "StageSetting"("projectId");

-- AddForeignKey
ALTER TABLE "StageSetting" ADD CONSTRAINT "StageSetting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed global stage rows for all stages (null prompts)
INSERT INTO "StageSetting" ("id", "scope", "projectId", "stage", "systemPrompt", "defaultModel", "planningDestinationStatus", "readyInstructions")
VALUES
  (gen_random_uuid(), 'global', NULL, 'New', NULL, NULL, NULL, NULL),
  (gen_random_uuid(), 'global', NULL, 'Planning', NULL, NULL, 'Backlog', NULL),
  (gen_random_uuid(), 'global', NULL, 'Backlog', NULL, NULL, NULL, NULL),
  (gen_random_uuid(), 'global', NULL, 'Ready', NULL, NULL, NULL, NULL),
  (gen_random_uuid(), 'global', NULL, 'InProgress', NULL, NULL, NULL, NULL),
  (gen_random_uuid(), 'global', NULL, 'Blocked', NULL, NULL, NULL, NULL),
  (gen_random_uuid(), 'global', NULL, 'Review', NULL, NULL, NULL, NULL),
  (gen_random_uuid(), 'global', NULL, 'Failed', NULL, NULL, NULL, NULL),
  (gen_random_uuid(), 'global', NULL, 'Done', NULL, NULL, NULL, NULL);
