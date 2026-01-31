-- Backfill currentStateStartedAt for existing tasks using createdAt
-- so card timers and state history display correctly for legacy data
UPDATE "Task"
SET "currentStateStartedAt" = "createdAt"
WHERE "currentStateStartedAt" IS NULL;
