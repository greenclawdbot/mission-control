# Inspect Changes Report

**Generated:** Review of all current git changes (unstaged; no staged changes).  
**Constraints:** Read-only; no files modified, staged, or committed.

---

## 1. Executive Summary

| Metric | Value |
|--------|--------|
| **Modified files** | 25 |
| **Untracked files/dirs** | 12 (new routes, services, migrations, Layout, contexts, pages, scripts) |
| **Staged changes** | None |
| **Lines (diff stat)** | +542 / -559 (net -17) |
| **Apps/packages affected** | api, web, packages/shared |
| **Change categories** | Feature (projects, stage settings, routing, layout), Refactor (CommonJS, imports), Fix (audit model name, layout scroll) |

**Overall assessment:** **Needs attention** — Changes are cohesive (projects, prompts-per-stage, routing, app layout) but several items should be addressed before committing: API build path consistency, optional type assertions in taskService/routes, and ensuring untracked files are added and migrations/doc are consistent.

---

## 2. File-by-File Analysis

### Root & config

**File:** `README.md`  
**Status:** Modified  
**Lines Changed:** +1 / -1  
**Change Type:** Docs  
**Scope:** Root  
**Summary:** Clarifies that `npm run db:migrate` uses root `.env` and same DB as API.  
**Analysis:** Helpful for monorepo setup. No concerns.  
**Concerns:** None.  
**Notes:** None.

---

**File:** `package.json`  
**Status:** Modified  
**Lines Changed:** +2 / -1  
**Change Type:** Config  
**Scope:** Root  
**Summary:** `db:migrate` now runs `node scripts/migrate.cjs` instead of workspace script; adds `db:migrate:dev`.  
**Analysis:** Centralizes migration to use root `.env`; script is in untracked `scripts/migrate.cjs`.  
**Concerns:**  
- [Medium] `scripts/migrate.cjs` is untracked — must be added or `npm run db:migrate` will fail for others.  
**Notes:** Add `scripts/` (and `migrate.cjs`) to the commit.

---

**File:** `package-lock.json`  
**Status:** Modified  
**Lines Changed:** +44 / -1  
**Change Type:** Config  
**Scope:** Root  
**Summary:** Adds `react-router-dom`, `react-router`, `@remix-run/router`.  
**Analysis:** Matches new dependency in apps/web.  
**Concerns:** None.  
**Notes:** None.

---

### API (apps/api)

**File:** `apps/api/package.json`  
**Status:** Modified  
**Lines Changed:** +2 / -2  
**Change Type:** Config  
**Scope:** api  
**Summary:** `main` and `start` point to `dist/apps/api/src/index.js` instead of `dist/index.js`.  
**Analysis:** Aligns with tsconfig `rootDir: "../.."` so output preserves path under `dist/`.  
**Concerns:**  
- [Low] Any external reference to `dist/index.js` (e.g. Dockerfile, docs) must be updated to `dist/apps/api/src/index.js`.  
**Notes:** Verify Dockerfile and deployment scripts use the same path.

---

**File:** `apps/api/prisma/schema.prisma`  
**Status:** Modified  
**Lines Changed:** +40 / -0  
**Change Type:** Feature / Migration  
**Scope:** api, db  
**Summary:** Adds `Project` model; adds `projectId` and relation on `Task`; adds `StageSetting` model with scope/project/stage and prompt fields.  
**Analysis:** Matches new migrations `20260131230000_add_projects_and_task_project_id` and `20260131230100_add_stage_settings`.  
**Concerns:** None.  
**Notes:** Run `prisma generate` after pulling; migrations are untracked — add them.

---

**File:** `apps/api/src/app.ts`  
**Status:** Modified  
**Lines Changed:** +6 / -6  
**Change Type:** Refactor / Feature  
**Scope:** api  
**Summary:** Removes ESM `fileURLToPath`/`import.meta`; uses `__dirname` and path up to monorepo root; registers `projectRoutes` and `settingsRoutes`.  
**Analysis:** Aligns with CommonJS rule; project root resolution assumes output under `dist/` (e.g. `dist/apps/api` → up to root).  
**Concerns:**  
- [Low] If API is ever run from a different cwd or bundled differently, `projectRoot` may be wrong — document or centralize.  
**Notes:** Consistent with `.cursor/rules/commonjs-project.mdc`.

---

**File:** `apps/api/src/index.ts`  
**Status:** Modified  
**Lines Changed:** +2 / -5  
**Change Type:** Refactor  
**Scope:** api  
**Summary:** Removes ESM `fileURLToPath`; loads dotenv from monorepo root using `__dirname` (CommonJS).  
**Analysis:** Correct for CommonJS; same root resolution as app.ts.  
**Concerns:** None.  
**Notes:** None.

---

**File:** `apps/api/src/routes/tasks.ts`  
**Status:** Modified  
**Lines Changed:** +114 / -20  
**Change Type:** Feature / Fix  
**Scope:** api  
**Summary:** Adds project/stage-settings integration: `projectId` in create/update/query; new endpoints `GET /tasks/planning-items`, `POST /tasks/:id/planning-complete`; claim response includes `readyPrompt`, `workFolder`, optional `model`; status enum and schemas include `Failed`; fix `auditLogEntry` → `auditEvent` in clear-demo; uses `@shared/src/types` and `stageSettingsService`; several `mapPrismaTaskToTask(… as Parameters<…>)` casts.  
**Analysis:** Feature set is coherent. Use of `as Parameters<typeof mapPrismaTaskToTask>[0]>` is a workaround for Prisma include types.  
**Concerns:**  
- [Medium] Type assertions on every `mapPrismaTaskToTask` call are brittle — consider a shared Prisma “task with relations” type or a single mapper overload.  
- [Low] `GET /tasks/planning-items` and `POST /tasks/:id/planning-complete` are new API surface — ensure documented (e.g. API.md) and that web or other clients don’t break.  
**Notes:** auditEvent fix is correct (schema uses `AuditEvent`).

---

**File:** `apps/api/src/services/auditService.ts`  
**Status:** Modified  
**Lines Changed:** +29 / -6  
**Change Type:** Refactor  
**Scope:** api  
**Summary:** Casts `before`/`after` to `Prisma.InputJsonValue`; getTaskAuditEvents and getAllAuditEvents return type asserted to explicit shape (id, eventType, …).  
**Analysis:** Aligns with Prisma JSON types and avoids leaking Prisma types.  
**Concerns:**  
- [Low] Duplicated return type shape — could be a named type for reuse.  
**Notes:** None.

---

**File:** `apps/api/src/services/githubService.ts`  
**Status:** Modified  
**Lines Changed:** +1 / -1  
**Change Type:** Refactor  
**Scope:** api  
**Summary:** Adds explicit type for `repo` in `repos.map(...)` to satisfy TypeScript.  
**Analysis:** Improves type safety.  
**Concerns:** None.  
**Notes:** None.

---

**File:** `apps/api/src/services/planningService.ts`  
**Status:** Modified  
**Lines Changed:** +1 / -1  
**Change Type:** Refactor  
**Scope:** api  
**Summary:** Imports `Task` from `@shared/src/types` instead of relative path.  
**Analysis:** Aligns with workspace alias.  
**Concerns:** None.  
**Notes:** None.

---

**File:** `apps/api/src/services/taskService.ts`  
**Status:** Modified  
**Lines Changed:** +42 / -25  
**Change Type:** Feature / Refactor  
**Scope:** api  
**Summary:** Imports from `@shared` and `sseServer`; adds `Failed` to TASK_STATUSES and getTasksByStatus; adds `projectId` filter and in create/update; maps Prisma task to Task with `as Parameters<...>`; passes Task (mapped) to webhook; emitTaskEvent from sseServer.  
**Analysis:** Correct behavior; type assertions repeated.  
**Concerns:**  
- [Medium] Same as tasks.ts — repeated type assertions for Prisma task with relations; consider a shared Prisma task type.  
**Notes:** None.

---

**File:** `apps/api/src/services/webhookService.ts`  
**Status:** Modified  
**Lines Changed:** +1 / -1  
**Change Type:** Refactor  
**Scope:** api  
**Summary:** Import from `@shared/src/types`.  
**Analysis:** Consistent.  
**Concerns:** None.  
**Notes:** None.

---

**File:** `apps/api/src/wsServer.ts`  
**Status:** Modified  
**Lines Changed:** +1 / -1  
**Change Type:** Refactor  
**Scope:** api  
**Summary:** Import Task, BotRun from `@shared/src/types`.  
**Analysis:** Consistent.  
**Concerns:** None.  
**Notes:** None.

---

**File:** `apps/api/tsconfig.json`  
**Status:** Modified  
**Lines Changed:** +4 / -4  
**Change Type:** Config  
**Scope:** api  
**Summary:** `rootDir: "../.."`; `paths["@shared/*"]` → `../../packages/shared/*`; `include` adds `../../packages/shared/src/**/*`.  
**Analysis:** Output layout becomes `dist/apps/api/src/...` and `dist/packages/shared/src/...`; shared is compiled with API.  
**Concerns:**  
- [Low] Building from repo root with this setup is required; document in README or CONTRIBUTING.  
**Notes:** Matches api package.json main/start paths.

---

### Web (apps/web)

**File:** `apps/web/package.json`  
**Status:** Modified  
**Lines Changed:** +1 / -0  
**Change Type:** Feature  
**Scope:** web  
**Summary:** Adds `react-router-dom`.  
**Analysis:** Required for new routing.  
**Concerns:** None.  
**Notes:** None.

---

**File:** `apps/web/src/App.tsx`  
**Status:** Modified  
**Lines Changed:** +22 / -501  
**Change Type:** Refactor / Feature  
**Scope:** web  
**Summary:** Replaces single-page Kanban with router: Routes, Layout, KanbanPage, PromptsPage, ProjectsPage; ActiveProjectProvider; removes inline Column/ChevronIcon and all Kanban state.  
**Analysis:** Large but coherent refactor; Kanban logic moved to KanbanPage.  
**Concerns:**  
- [Low] Remove any leftover `console.log` in KanbanPage or hooks (e.g. SSE handler) if present — diff didn’t show any.  
**Notes:** None.

---

**File:** `apps/web/src/api/client.ts`  
**Status:** Modified  
**Lines Changed:** +72 / -2  
**Change Type:** Feature  
**Scope:** web  
**Summary:** Adds projectId to getTasks; adds projects CRUD and stage settings API (getStageSettings, getGlobalStageSettings, updateGlobalStageSettings, getProjectStageOverrides, updateProjectStageOverrides).  
**Analysis:** Matches new API routes; types from shared-types.  
**Concerns:** None.  
**Notes:** None.

---

**File:** `apps/web/src/components/NewTaskModal.tsx`  
**Status:** Modified  
**Lines Changed:** +40 / -5  
**Change Type:** Feature  
**Scope:** web  
**Summary:** Adds optional `projects` and `defaultProjectId`; project select in form; projectId in create payload; syncs defaultProjectId into form state.  
**Analysis:** Correct.  
**Concerns:** None.  
**Notes:** None.

---

**File:** `apps/web/src/components/SummaryBar.tsx`  
**Status:** Modified  
**Lines Changed:** +1 / -0  
**Change Type:** Refactor (layout)  
**Scope:** web  
**Summary:** Adds `flexShrink: 0` to root div.  
**Analysis:** Part of app layout fix so summary bar doesn’t scroll away.  
**Concerns:** None.  
**Notes:** None.

---

**File:** `apps/web/src/components/TaskDrawer.tsx`  
**Status:** Modified  
**Lines Changed:** +8 / -4  
**Change Type:** Refactor (layout)  
**Scope:** web  
**Summary:** Adds `flexShrink: 0` to header, control bar, tabs, footer; content div gets `minHeight: 0` for scroll.  
**Analysis:** Keeps inspector chrome fixed and only content scrolling.  
**Concerns:** None.  
**Notes:** None.

---

**File:** `apps/web/src/main.tsx`  
**Status:** Modified  
**Lines Changed:** +5 / -2  
**Change Type:** Feature  
**Scope:** web  
**Summary:** Wraps App in BrowserRouter.  
**Analysis:** Required for react-router-dom.  
**Concerns:** None.  
**Notes:** None.

---

**File:** `apps/web/src/shared-types.ts`  
**Status:** Modified  
**Lines Changed:** +42 / -0  
**Change Type:** Feature  
**Scope:** web  
**Summary:** Adds Project; Task.projectId; CreateTaskInput/UpdateTaskInput/TaskFilters.projectId; StageSettingRow, EffectiveStageSettings.  
**Analysis:** Mirrors packages/shared and API; used by client and components.  
**Concerns:**  
- [Low] Duplication with packages/shared — long-term consider importing from shared in web or a single source of truth.  
**Notes:** None.

---

**File:** `apps/web/src/styles/index.css`  
**Status:** Modified  
**Lines Changed:** +15 / -3  
**Change Type:** Refactor (layout)  
**Scope:** web  
**Summary:** html/body/#root height 100%, overflow hidden; .app-container height 100%; .content-area and .board-area min-height 0.  
**Analysis:** Enforces viewport-sized app shell and independent scroll regions.  
**Concerns:** None.  
**Notes:** None.

---

### Packages (packages/shared)

**File:** `packages/shared/src/types.ts`  
**Status:** Modified  
**Lines Changed:** +97 / -0  
**Change Type:** Feature  
**Scope:** shared  
**Summary:** Adds Failed to TaskStatus/TASK_STATUSES; ExecutionState and EXECUTION_STATES; Project; Task fields (executionState, projectId, blockedBy, needsApproval, approvedAt, approvedBy, lastHeartbeatAt); CreateTaskInput/UpdateTaskInput/TaskFilters and related; StageSettingRow, EffectiveStageSettings; BotRun, BotRunLogEntry.  
**Analysis:** Single source for API and potentially web; aligns with schema and routes.  
**Concerns:** None.  
**Notes:** API uses `@shared/src/types`; web has its own shared-types that partially mirrors this — consider documenting or unifying.

---

## 3. Untracked Files

These should be added for the feature set to work and for history to be complete:

| Path | Purpose |
|------|--------|
| `apps/api/prisma/migrations/20260131230000_add_projects_and_task_project_id/` | Project + Task.projectId |
| `apps/api/prisma/migrations/20260131230100_add_stage_settings/` | StageSetting table + global seed |
| `apps/api/src/routes/projects.ts` | Projects CRUD |
| `apps/api/src/routes/settings.ts` | Stage settings API |
| `apps/api/src/services/projectService.ts` | Project service |
| `apps/api/src/services/stageSettingsService.ts` | Stage settings resolution |
| `apps/web/src/components/Layout.tsx` | Shell with header, project bar, outlet |
| `apps/web/src/contexts/` | ActiveProjectContext |
| `apps/web/src/pages/` | KanbanPage, PromptsPage, ProjectsPage |
| `scripts/migrate.cjs` | Root db:migrate using root .env |
| `.cursor/rules/` | Optional; project-specific rules |

**Concerns:**  
- [High] Migrations and new routes/services must be committed or deploy and local setup will fail.  
- [Medium] `npm run db:migrate` depends on `scripts/migrate.cjs` (see package.json).  
**Recommendation:** Add all of the above except optionally `.cursor/rules/` if you prefer not to version them.

---

## 4. Cross-File Concerns

- **API build output:** api uses `rootDir: "../.."` and `main: "dist/apps/api/src/index.js"`. Dockerfile and any scripts that run the API must use this path (or the same logic).  
- **Type assertions:** Repeated `mapPrismaTaskToTask(x as Parameters<...>)` in tasks.ts and taskService.ts — consider a shared Prisma “task with relations” type and a single mapper signature.  
- **Shared types:** packages/shared is extended; web has parallel shared-types. Not broken, but worth documenting or consolidating to avoid drift.  
- **New API surface:** `GET /tasks/planning-items`, `POST /tasks/:id/planning-complete`, projects and settings routes — update API.md or equivalent so clients and deployments are documented.  
- **Migrations:** Two new migrations are untracked; add them and ensure deployment runs `db:migrate` (or equivalent) with root .env or correct DATABASE_URL.

---

## 5. Project Standards Compliance

- **API:** Fastify routes/services; Zod on new routes; Prisma; no ESM-only usage; imports from @shared. Compliant.  
- **Web:** React components; API client extended; react-router-dom; layout uses flex and min-height for scroll. Compliant.  
- **Types:** TypeScript throughout; shared types in packages/shared; web shared-types in sync for added fields.  
- **Code style:** Consistent naming and structure; no obvious style regressions.

---

## 6. Security & Safety

- No credentials or secrets in diffs.  
- New inputs (projectId, body for planning-complete, project/settings) go through Zod or existing patterns.  
- Prisma used parameterized; no raw SQL with string interpolation.  
- .env remains the right place for DATABASE_URL and other secrets.

---

## 7. Database & Migrations

- **Migrations:** Naming and location correct (`apps/api/prisma/migrations/`, timestamped).  
- **Content:** Projects + Task.projectId; StageSetting with global seed.  
- **Regeneration:** After schema/migration changes, run `npm run db:generate --workspace=api` (or from api: `prisma generate`).  
- **Untracked:** Both new migrations must be added to the commit.

---

## 8. Monorepo Considerations

- api and web and packages/shared are in sync for Project, Task.projectId, Failed, stage settings, and routing.  
- API build and start paths reflect tsconfig rootDir; workspace scripts are consistent.  
- scripts/migrate.cjs is at repo root and used by root package.json; it should be committed.

---

## 9. Deployment Readiness

- New env vars: none required beyond existing (e.g. DATABASE_URL).  
- Docker: Verify API Dockerfile uses `node dist/apps/api/src/index.js` (or equivalent) if it runs the built app.  
- Migrations: Use `npm run db:migrate` (root) so root .env is used; document in README (already clarified).

---

## 10. Commit Readiness Assessment

**Verdict: Needs attention**

- **Before committing:**  
  1. Add untracked files: migrations, projects/settings routes and services, Layout, contexts, pages, `scripts/migrate.cjs`.  
  2. Optionally reduce type assertions in taskService/tasks (shared Prisma task type).  
  3. Confirm Dockerfile/run scripts use `dist/apps/api/src/index.js` (or same logic).  
- **Follow-up:**  
  - Update API.md (or similar) with new endpoints and request/response shapes.  
  - Consider documenting or unifying web shared-types vs packages/shared.  
- **Optional:**  
  - Extract duplicated audit return type in auditService; add JSDoc to new public API.

---

## 11. Recommendations Summary

| Priority | Action |
|----------|--------|
| **Before committing** | Add all untracked files listed in §3 (migrations, routes, services, Layout, contexts, pages, scripts/migrate.cjs). |
| **Before committing** | Verify API start path in Dockerfile/deploy matches `dist/apps/api/src/index.js`. |
| **Should address** | Document new API endpoints (planning-items, planning-complete, projects, settings) in API.md. |
| **Follow-up** | Consider shared Prisma “task with relations” type to avoid repeated `as Parameters<...>` in taskService and tasks route. |
| **Optional** | Reuse a single type for audit service return shape; document shared-types vs packages/shared strategy. |
