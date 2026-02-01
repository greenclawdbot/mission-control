# /docommit

**Purpose**

Create professional, organized commits that follow industry best practices, ensuring clear history, proper attribution, and maintainable codebase documentation for the Mission Control monorepo.

**Use When**

- You have staged changes ready to commit
- You want to organize multiple changes into logical, atomic commits
- You need to create commit messages that follow conventional commit standards
- You want to ensure commits are properly categorized and documented
- You're working across multiple packages in the monorepo

---

## Commit Message Format

Follow the Conventional Commits specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Scope (Optional)

Scope should be the area of the codebase affected. For the Mission Control monorepo:

#### App-Level Scopes

- **web**: React + Vite frontend (`apps/web`) – UI, components, hooks, API client
- **api**: Node.js backend (`apps/api`) – routes, services, SSE/WebSocket servers

#### Package Scopes

- **shared**: Shared package (`packages/shared`) – TypeScript types and utilities used by api and web
- **db**: Database schema/types (`packages/db` or `apps/api/prisma`) – Prisma schema, migrations

#### Feature/Component Scopes

- **tasks**: Task CRUD, board, move, summary (`apps/api/src/routes/tasks.ts`, `taskService.ts`)
- **audit**: Audit trail and event log (`apps/api/src/routes/audit.ts`, `auditService.ts`)
- **github**: GitHub integration (`apps/api/src/routes/github.ts`, `githubService.ts`)
- **webhook**: Bot webhook endpoint and notifications (`webhookService.ts`)
- **sse**: Server-Sent Events server (`apps/api/src/sseServer.ts`)
- **ws**: WebSocket server (`apps/api/src/wsServer.ts`)
- **planning**: Bot planning service (`planningService.ts`)
- **ui**: UI components (both web app components and styles)
- **migrations**: Database migrations (`apps/api/prisma/migrations/`)
- **config**: Configuration (vite.config, tailwind, env, Docker)
- **deps**: Dependency updates
- **scripts**: Script files (e.g. clear-session, debug-tasks)

#### Infrastructure Scopes

- **config**: Configuration changes (vite.config.ts, tailwind.config.js, docker-compose.yml, etc.)
- **deps**: Dependency updates
- **scripts**: Script files

### Description

- Use imperative, present tense: "add feature" not "added feature" or "adds feature"
- Don't capitalize the first letter
- No period (.) at the end
- Keep it concise (50–72 characters recommended)
- Be specific and descriptive

---

## What to Do

**Important:** You must **execute** the commit plan. Do not stop after writing the message or showing a "Ready to commit" snippet—run the actual `git add` and `git commit` commands (request `git_write` permission when needed) so the commits are created. Only show the plan and ask the user to run it if they explicitly ask for a dry run or preview.

### 1. Analyze Staged Changes

- Review `git status` to see what files are staged
- Group related changes together
- Identify if changes should be split into multiple atomic commits
- Check for unrelated changes that should be committed separately
- Consider monorepo structure – changes across packages may need separate commits

### 2. Determine Commit Type and Scope

- Categorize the change appropriately
- Identify the affected area/component (app, package, or feature)
- Consider if this is a breaking change (use `!` after type/scope)
- For monorepo: specify which app/package is affected

### 3. Write Clear Description

- Summarize what the commit does in one line
- Use action verbs (add, fix, update, remove, refactor, etc.)
- Be specific about what changed

### 4. Add Detailed Body (if needed)

- Explain why the change was made, not just what
- Describe any side effects or implications
- Reference related issues, PRs, or discussions
- Use bullet points for multiple changes
- Wrap at 72 characters per line
- For monorepo changes, note which packages/apps are affected

### 5. Add Footer (if applicable)

- **Breaking changes**: `BREAKING CHANGE: <description>`
- **Issue references**: `Fixes #123`, `Closes #456`, `Refs #789`
- **Co-authors**: `Co-authored-by: Name <email>`

### 6. Review Before Committing

- Ensure commit is atomic (one logical change)
- Verify message follows format
- Check for typos and clarity
- Confirm all related changes are included
- For monorepo: ensure changes belong to the same logical unit

### 7. Execute the Commits

- **Run the commits.** Stage the appropriate files (`git add`) and run `git commit` with the message(s) you planned. Use the terminal with `git_write` permission.
- For a **single commit**: if everything is already staged, run `git commit -m "..."` (and `-m "..."` for body/footer). If you need to stage first, run `git add <paths>` then `git commit`.
- For **multiple commits**: run `git reset` to unstage, then for each logical group run `git add <paths>` and `git commit -m "..."` in sequence.
- After executing, briefly confirm what was committed (e.g. "Committed 3 commits: …").

---

## Examples

### API Route (Tasks)

```
feat(api): add task move endpoint

Implement PUT /api/v1/tasks/:id/move for moving tasks between
columns. Updates taskService and tasks route with validation.

Refs API.md for endpoint contract.
```

### Web UI Component

```
feat(web): add NewTaskModal component

Add modal for creating tasks with title, description, priority,
and tags. Wires to API client createTask. Includes form validation.
```

### Audit Trail

```
feat(audit): record before/after snapshots on task update

Update auditService to store full before/after task state in
AuditEvent. Enables debugging and compliance traceability.
```

### Webhook Service

```
fix(webhook): handle missing WEBHOOK_URL gracefully

Skip webhook calls when WEBHOOK_URL is unset instead of throwing.
Allows local development without Clawdbot webhook configured.
```

### SSE / Real-time

```
feat(sse): broadcast task updates over SSE

Emit task created/updated/deleted events to connected clients.
Web app can subscribe via useSSE for live board updates.
```

### Database Migration

```
feat(migrations): add session_binding to Task

Add sessionKey and sessionLockedAt to Task for bot autonomy
and crash recovery. Migration: 20260131004753_add_session_binding.
```

### Shared Types

```
feat(shared): add TaskStatus and TaskPriority types

Export shared types for api and web. Aligns with Prisma schema
and reduces duplicate type definitions.
```

### API + Web (coupled change)

```
feat(tasks): add priority filter to task list

- API: add optional priority query param to GET /api/v1/tasks
- Web: add priority filter dropdown in board view
- shared: add Priority type if needed
```

### Breaking Change

```
feat(api)!: paginate task list response

BREAKING CHANGE: GET /api/v1/tasks now returns { tasks, total, page, limit }.
Clients must update to handle new response shape.

Migration: use response.tasks instead of response directly.
```

### Refactoring

```
refactor(api): extract db client to db/client.ts

Move Prisma client instantiation into dedicated module.
Improves testability and single connection reuse.
```

### Documentation

```
docs: update README with local Postgres setup

Add macOS/Linux Postgres start commands and DATABASE_URL
examples. Clarify npm run dev runs api + web together.
```

### Multiple Related Changes

```
feat(web): add task drawer and summary bar

- Add TaskDrawer for task details and edit
- Add SummaryBar with board stats from /api/v1/board/summary
- Update App.tsx to wire drawer and summary
- Add useSSE for live summary updates

Fixes #12
```

### Prisma / DB

```
feat(db): add TaskResult and Commit models

Add models for bot execution results and git commits.
Migration: 20260131051416_add_results_and_commits.
```

---

## Atomic Commits

**One logical change per commit:**

✅ **Good**: Separate commits for "add feature" and "add tests for feature"  
✅ **Good**: Separate commits for "fix bug" and "refactor related code"  
✅ **Good**: Separate commits for different packages in monorepo  
❌ **Bad**: "Add feature and fix unrelated bug" in one commit  
❌ **Bad**: "Update multiple packages" without clear relationship

**Group related changes:**

✅ **Good**: All files for a single feature together  
✅ **Good**: All test updates together  
✅ **Good**: API route + service + types together when coupled  
❌ **Bad**: Mixing feature code with formatting changes  
❌ **Bad**: Mixing api and web changes unless tightly coupled  
❌ **Bad**: Mixing package changes without clear relationship

**Monorepo considerations:**

✅ **Good**: Separate commits for `packages/shared` and `apps/api` changes  
✅ **Good**: Commit migration file separately from code that uses it  
✅ **Good**: Commit API route and shared types together if tightly coupled  
❌ **Bad**: Single commit for unrelated changes across multiple packages

---

## Output Format

When creating commits:

1. **Plan:** Commit message (formatted according to spec), files changed, rationale, and any suggestion to split.
2. **Execute:** Run the actual `git add` and `git commit` commands so the commits are created. Request `git_write` permission for the terminal.
3. **Confirm:** After running, briefly state what was committed.

Do not stop at "Ready to commit" or ask the user to run the commands—execute them yourself unless the user asked for a dry run or preview only.

### Example (single commit, already staged)

**Plan:** feat(web): add task filtering by status. Files: App.tsx, SummaryBar.tsx, client.ts. Rationale: one feature.

**Execute:** Run:
```bash
git commit -m "feat(web): add task filtering by status" \
  -m "Add status filter dropdown to board view. Calls GET /api/v1/tasks with status query param. Updates api client and App state." \
  -m "Fixes #8"
```

**Confirm:** "Committed 1 commit: feat(web): add task filtering by status."

### Example (multiple commits)

**Plan:** Split into 3 commits: shared type, API param, web UI. Rationale: atomic monorepo commits.

**Execute:** Run in sequence: `git reset`, then for each group `git add <paths>` and `git commit -m "..."`.

**Confirm:** "Committed 3 commits: feat(shared): …, feat(api): …, feat(web): …."

---

## Constraints

- **Execute the plan** – Run `git add` and `git commit` yourself so commits are created; do not leave it to the user unless they asked for a dry run or preview only.
- **Never commit secrets or credentials** – Check for API keys, passwords, tokens, DATABASE_URL with real credentials
- **Never commit generated files** – Unless they're part of the build (e.g. Prisma client in node_modules is ignored)
- **Never commit large binary files** – Use Git LFS or external storage
- **Keep commits focused** – One logical change per commit
- **Write clear messages** – Future you (and others) will thank you
- **Follow the format** – Consistency helps with automation and tooling
- **Reference issues** – Link commits to tickets/PRs when applicable
- **Test before committing** – Ensure changes work and don't break existing functionality
- **Respect monorepo structure** – Consider package boundaries when organizing commits

---

## Multi-Commit Workflow

If you have multiple unrelated changes staged:

1. Identify logical groups of changes
2. Unstage everything: `git reset`
3. Stage and commit each group separately with appropriate messages (run these commands yourself—do not stop at showing the plan)
4. Review commit history: `git log --oneline` to verify organization

### Example (Monorepo):

```bash
# Group 1: Shared types
git add packages/shared/src/types.ts
git commit -m "feat(shared): add TaskStatus type"

# Group 2: API task filter
git add apps/api/src/routes/tasks.ts
git add apps/api/src/services/taskService.ts
git commit -m "feat(api): add status query param to task list"

# Group 3: Web filter UI
git add apps/web/src/App.tsx
git add apps/web/src/api/client.ts
git commit -m "feat(web): add status filter to board"

# Group 4: Migration
git add apps/api/prisma/migrations/20260131120000_add_index.sql
git commit -m "perf(migrations): add index on Task.status"
```

---

## Project-Specific Guidelines

### API (Node.js backend)

- **Routes**: Note endpoint and HTTP method changes; keep in sync with API.md
- **Services**: Note if affects task, audit, webhook, planning, or GitHub behavior
- **SSE/WS**: Note if changes event payloads or connection behavior
- **File locations**:
  - Routes: `apps/api/src/routes/*.ts`
  - Services: `apps/api/src/services/*.ts`
  - SSE: `apps/api/src/sseServer.ts`
  - WebSocket: `apps/api/src/wsServer.ts`
  - App/entry: `apps/api/src/app.ts`, `index.ts`
  - DB: `apps/api/src/db/client.ts`

### Web (React + Vite)

- **Components**: Note if affects TaskCard, TaskDrawer, NewTaskModal, SummaryBar
- **Hooks**: Note if affects useSSE or useWebSocket
- **API client**: Note if changes request/response shape
- **File locations**:
  - App: `apps/web/src/App.tsx`, `main.tsx`
  - Components: `apps/web/src/components/*.tsx`
  - API: `apps/web/src/api/client.ts`
  - Hooks: `apps/web/src/hooks/*.ts`
  - Styles: `apps/web/src/styles/index.css`
  - Config: `apps/web/vite.config.ts`, `tailwind.config.js`

### Shared Package

- **Types**: Note if affects types used by api or web
- **Breaking changes**: Critical – affects all consumers
- **File locations**: `packages/shared/src/*.ts`

### Prisma / Database

- **Migrations**: Always commit migration files separately from code that uses new columns/tables
- **Schema**: Note if changing `apps/api/prisma/schema.prisma` or `packages/db/prisma/schema.prisma`
- **Reference migration file**: Include migration name in commit message when adding migrations
- **File locations**:
  - Schema: `apps/api/prisma/schema.prisma`
  - Migrations: `apps/api/prisma/migrations/*/migration.sql`

### Common Scopes by Feature

- **Tasks**: `tasks`, `api` (routes/services), `web` (board, drawer, modal)
- **Audit**: `audit`, `api` (audit route/service)
- **GitHub**: `github`, `api` (github route/service)
- **Webhook**: `webhook`, `api` (webhookService)
- **Real-time**: `sse`, `ws`, `api` (servers); `web` (useSSE, useWebSocket)
- **Planning**: `planning`, `api` (planningService)

---

## Validation Checklist

Before finalizing a commit message, verify:

- ✅ Type is appropriate and follows conventional commits
- ✅ Scope is clear and specific (app, package, or feature)
- ✅ Description is imperative, concise, and descriptive
- ✅ Body explains why (if included)
- ✅ Breaking changes are marked and explained
- ✅ Related issues/PRs are referenced
- ✅ Commit is atomic (one logical change)
- ✅ No secrets or sensitive data included
- ✅ Message follows 50/72 character guidelines
- ✅ Grammar and spelling are correct
- ✅ Monorepo structure respected (related changes grouped)
- ✅ Migration files committed separately (if applicable)

---

## Notes

- **Analyze staged changes first** – Use `git status` and `git diff --cached` to see what's staged
- **Group related changes** – Ensure all related files are included in the same commit
- **Split unrelated changes** – Don't mix different features or fixes in one commit
- **Respect monorepo boundaries** – Consider if changes belong together or should be separate commits
- **Be descriptive** – Future developers (including yourself) should understand what changed and why
- **Follow conventions** – Consistency makes the git history more useful and searchable
- **Reference issues** – Link commits to issues/PRs when applicable for better traceability
- **Migration files** – Always commit migration files separately from code changes
- **Package changes** – Consider impact on api and web when changing packages/shared
- **API contract** – Keep API.md in mind for route/response changes
