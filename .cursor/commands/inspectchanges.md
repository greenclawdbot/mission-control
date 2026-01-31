# /inspectchanges

**Purpose**

Perform a thorough, professional review of all current git changes (staged and unstaged) to identify potential issues, code quality concerns, and areas that need attention before committing. This command analyzes but does not modify any files.

**Use When**

- You have uncommitted changes and want to review them before committing
- You want to ensure code quality and catch potential issues early
- You need a comprehensive analysis of what's changed and why
- You want to verify changes align with project standards and best practices
- You want to check if changes follow Fastify API, Prisma, and Vite/React patterns

---

## What to Do

1) **Gather Change Information**

   - Run `git status` to see all modified, added, and deleted files
   - Run `git diff --stat` to get a summary of changes
   - Run `git diff` for unstaged changes and `git diff --cached` for staged changes
   - Identify untracked files that should potentially be added
   - Check for any merge conflicts or rebase state
   - Note which apps/packages are affected (monorepo: apps/api, apps/web, packages/db, packages/shared)

2) **Analyze Each Changed File**

   For each modified file:

   - **Read the actual diff** to understand what changed
   - **Categorize the change type**: bug fix, feature, refactor, style, docs, etc.
   - **Identify the scope**: which app (api/web), package (db/shared), or feature is affected
   - **Assess the impact**: is this a breaking change, performance change, or behavioral change?
   - **Check for related changes**: are there other files that should have been modified together?
   - **Monorepo awareness**: check if changes in one package require updates in others

3) **Code Quality Review**

   For each change:

   - **Logic correctness**: Does the change make sense? Are there edge cases?
   - **Error handling**: Are errors handled appropriately? Are there potential crashes?
   - **Performance**: Are there performance regressions? Unnecessary operations?
   - **Security**: Are there potential security issues? Secrets exposed? Input validation?
   - **Maintainability**: Is the code clear? Are there magic numbers? Missing comments?
   - **Testing**: Should tests have been added/modified? Are existing tests still valid?
   - **Type safety**: Are TypeScript types correct? Any `any` types that should be avoided?

4) **Project-Specific Checks**

   Based on the project architecture (React + Vite + Fastify + Prisma):

   ### Fastify API (apps/api)

   - **Routes**: Handlers in `src/routes/` (tasks, audit, github); services in `src/services/`
   - **Validation**: Uses Zod for request/response validation where appropriate
   - **Database**: Prisma client from `src/db/client.ts`; no raw SQL without parameterization
   - **SSE/WebSocket**: `sseServer.ts`, `wsServer.ts` for real-time updates
   - **CORS**: Configured via `@fastify/cors` for web app origin
   - **Errors**: Proper HTTP status codes and error responses; no stack traces in production responses

   ### React + Vite (apps/web)

   - **API client**: `src/api/client.ts` for backend calls; base URL from env
   - **State**: Server-authoritative; refetch or SSE/WebSocket for updates
   - **Hooks**: `useSSE.ts`, `useWebSocket.ts` for real-time; use consistently
   - **Components**: TaskCard, TaskDrawer, NewTaskModal, SummaryBar; shared types in `shared-types.ts` or from packages/shared
   - **Styling**: TailwindCSS; dark mode support per ARCHITECTURE.md
   - **Build**: `tsc && vite build`; no hardcoded API URLs in source

   ### Prisma & Database

   - **Migrations**: In `apps/api/prisma/migrations/`; naming `YYYYMMDDHHMMSS_description` (e.g. `20260131051416_add_results_and_commits`)
   - **Schema**: Single source in `apps/api/prisma/schema.prisma`; packages/db may mirror or reference
   - **Client**: Generate after schema/migration changes: `npm run db:generate --workspace=api` (or from api: `prisma generate`)
   - **Seeding**: `apps/api/prisma/seed.ts`; keep in sync with schema if models change
   - **Queries**: Prefer Prisma API over raw SQL; no string concatenation for user input

   ### Monorepo Structure

   - **Workspaces**: `apps/*`, `packages/*`; scripts use `--workspace=api` / `--workspace=web`
   - **Shared types**: `packages/shared` (types.ts); consumed by api and/or web
   - **Package db**: `packages/db` may hold shared Prisma schema or types; keep in sync with apps/api if used
   - **Dependencies**: Prefer workspace references; avoid duplicating types between apps and shared

   ### Docker & Deployment

   - **Containers**: `docker-compose.yml`; API and DB; web may be static build served by nginx (see Dockerfiles)
   - **Environment**: `.env.example` documents required vars; no `.env` or secrets in repo
   - **Build**: API `tsc` then `node dist/index.js`; web `vite build`; verify Dockerfiles match

5) **Identify Concerns**

   Flag potential issues:

   - **Breaking changes** that aren't documented
   - **Incomplete implementations** (TODOs, FIXMEs, placeholders)
   - **Debug code** left in (commented code, excessive logging, console.log in production)
   - **Unused code** (dead code, unused imports)
   - **Inconsistent patterns** (mixing old and new approaches)
   - **Missing error handling** or error handling that could be improved
   - **Performance concerns** (inefficient algorithms, unnecessary operations)
   - **Security concerns** (hardcoded secrets, missing validation, unsafe operations)
   - **Missing migrations** (schema changes without migration files)
   - **Type safety issues** (excessive `any` types, missing types)
   - **API contract**: Request/response shape changes that could break the web app

6) **Check for Common Issues**

   - **Secrets/credentials**: Any API keys, passwords, tokens in code?
   - **Generated files**: Are build artifacts or generated code being committed? (e.g. Prisma client in node_modules is fine; avoid committing `dist/` or `packages/shared/*.js` if they are build outputs)
   - **Large files**: Are binary files or large assets being added?
   - **Merge artifacts**: Any conflict markers or temporary files?
   - **Whitespace changes**: Are there unnecessary whitespace-only changes?
   - **Formatting**: Inconsistent formatting; consider running formatter/linter
   - **Environment files**: Are `.env` or `.env.development` being committed? (should be in `.gitignore`)

7) **Review Change Cohesion**

   - **Atomic commits**: Are changes logically grouped? Should they be split?
   - **Related changes**: Are all related files included? (e.g. API route + web client + shared type)
   - **Dependencies**: Are new dependencies necessary? Do they conflict with existing ones?
   - **Migration needs**: Do schema changes have migrations? Apply order correct?
   - **Monorepo coherence**: Are changes across packages logically related?

8) **Provide Recommendations**

   For each concern identified:

   - **Severity**: Critical, High, Medium, Low, or Informational
   - **Description**: Clear explanation of the issue
   - **Impact**: What could go wrong if this isn't addressed?
   - **Recommendation**: What should be done (but don't actually do it)
   - **Rationale**: Why this matters
   - **File/Line**: Specific location if applicable

---

## Output Format

Provide a structured, professional review report:

### 1. Executive Summary

- Total files changed (modified, added, deleted)
- Lines changed (additions, deletions)
- Change categories (features, fixes, refactors, etc.)
- Apps/packages affected (api, web, shared, db)
- Overall assessment (Ready to commit / Needs attention / Blocked)

### 2. File-by-File Analysis

For each changed file:

```
**File:** `path/to/file.ts`

**Status:** Modified / Added / Deleted

**Lines Changed:** +X / -Y

**Change Type:** [Feature/Fix/Refactor/Style/Docs/Other]

**Scope:** [App/Package - e.g. api, web, shared, db]

**Summary:**

Brief description of what changed in this file.

**Changes:**

- Specific change 1 (with line numbers if relevant)
- Specific change 2
- etc.

**Analysis:**

- What the change does and why it's needed
- Code quality assessment
- Potential issues or concerns
- Pattern compliance (Fastify, Prisma, React/Vite)

**Concerns:**

- [Severity] Issue description
  - Impact: What could go wrong
  - Recommendation: What should be done
  - File/Line: Specific location
- [Severity] Another issue...

**Notes:**

- Any additional context or observations
- Related files that might need updates
- Migration or type regeneration needs
```

### 3. Cross-File Concerns

- **Missing related changes**: Files that should have been modified together
- **Inconsistencies**: Patterns that don't match across files
- **Breaking changes**: Changes that affect other parts of the system (e.g. API contract)
- **Dependencies**: New dependencies or version changes
- **Monorepo impact**: Changes in packages/shared or schema affecting api/web
- **Migration coordination**: Schema changes without migrations or code updates

### 4. Project Standards Compliance

- **API**: Fastify routes/services, Prisma usage, error handling, validation
- **Web**: React components, API client, SSE/WebSocket usage, env for API URL
- **Types**: TypeScript usage; shared types in packages/shared where appropriate
- **Code style**: Naming, formatting, consistency

### 5. Security & Safety

- **Secrets**: No credentials or sensitive data in code
- **Input validation**: Request bodies and query params validated (Zod or equivalent)
- **Error messages**: No sensitive data in error responses
- **Database**: Prisma parameterized queries; no raw SQL with string interpolation
- **Environment variables**: Secrets in env only; .env in .gitignore

### 6. Testing & Quality

- **Test coverage**: Should tests be added or updated?
- **Compilation**: Will this build? `npm run build` (workspaces) and `tsc` in api/web
- **Linting**: Any lint warnings or style issues?
- **Type checking**: TypeScript strict where applicable

### 7. Database & Migrations

- **Migration files**: Naming `YYYYMMDDHHMMSS_description`; location `apps/api/prisma/migrations/`
- **Type regeneration**: After schema/migration changes run `npm run db:generate --workspace=api`
- **Backward compatibility**: Will migration break existing data or require downtime?

### 8. Monorepo Considerations

- **Package boundaries**: Changes properly scoped to api, web, shared, db
- **Shared code**: packages/shared changes may require updates in api and web
- **Workspace scripts**: Correct use of `--workspace=api` / `--workspace=web`
- **Build order**: If shared is built, ensure dependents rebuild

### 9. Deployment Readiness

- **Environment variables**: New env vars documented in .env.example; not committed
- **Docker**: Dockerfile and docker-compose changes consistent with app entrypoints
- **Migrations**: Ready to run in deployment (e.g. `db:migrate` in startup or release step)

### 10. Commit Readiness Assessment

- **Ready to commit**: All concerns addressed or acceptable
- **Needs attention**: Some concerns should be addressed
- **Blocked**: Critical issues must be fixed before committing

### 11. Recommendations Summary

Prioritized list of actions to consider:

- **Before committing**: Things that should be done now
- **Follow-up**: Things that can be done later but should be tracked
- **Optional improvements**: Nice-to-have improvements

---

## Analysis Guidelines

### Change Categorization

- **Feature**: New functionality added
- **Fix**: Bug fix or correction
- **Refactor**: Code restructuring without behavior change
- **Style**: Formatting, whitespace, naming (no logic change)
- **Docs**: Documentation updates
- **Perf**: Performance improvements
- **Test**: Test additions/modifications
- **Config**: Configuration changes
- **Chore**: Maintenance tasks
- **Migration**: Prisma migration files

### Severity Levels

- **Critical**: Must fix before committing (security, data loss, crashes)
- **High**: Should fix before committing (bugs, incorrect behavior, missing migrations)
- **Medium**: Should address soon (code quality, maintainability, type safety)
- **Low**: Nice to fix (minor style, optimization opportunities)
- **Informational**: FYI only (best practices, suggestions)

### Code Quality Indicators

**Good signs:**

- Clear, readable code
- Proper error handling
- Appropriate comments
- Follows project structure (routes/services, components/hooks)
- No debug code left in
- Proper TypeScript types
- Prisma used correctly; migrations for schema changes
- API and web stay in sync (types, endpoints)

**Warning signs:**

- Magic numbers without constants
- Commented-out code
- Excessive debug logging (console.log in production)
- TODO/FIXME comments
- Unused imports/variables
- Inconsistent patterns
- API response shape changed without updating web client
- Schema change without migration

**Red flags:**

- Hardcoded secrets
- Code without error handling
- Missing input validation
- Breaking changes without documentation
- Raw SQL with string concatenation
- Schema changes without migrations
- Committing .env or build artifacts that should be ignored

---

## Project-Specific Considerations

### Fastify API (apps/api)

- Routes in `src/routes/`; business logic in `src/services/`
- Prisma client from `src/db/client.ts`
- Use Zod (or similar) for request validation where applicable
- SSE and WebSocket for real-time; ensure cleanup on disconnect
- No hardcoded secrets; use env vars

### React + Vite (apps/web)

- Components in `src/components/`; API client in `src/api/client.ts`
- Use hooks `useSSE`, `useWebSocket` for real-time; align with API endpoints
- Tailwind for styling; dark mode per design
- API base URL from environment (e.g. Vite `import.meta.env`)

### Prisma (apps/api/prisma)

- Migrations in `prisma/migrations/` with timestamped names
- After schema or migration: `prisma generate` (or `npm run db:generate --workspace=api`)
- Seed script in sync with schema when models change

### Monorepo

- **apps/api**: Fastify + Prisma
- **apps/web**: Vite + React
- **packages/shared**: Shared types/utilities
- **packages/db**: Prisma schema or generated types if used
- Workspace scripts in root `package.json`; run from root or with `--workspace=...`

### Docker

- docker-compose for API and DB (and web if applicable)
- Dockerfiles build from source; no secrets in images
- .env or env file for local/dev; not committed

### TypeScript

- Strict typing in api and web
- Shared types in packages/shared to avoid drift
- Run build/type-check after changes: `npm run build` or per-workspace

---

## Constraints

- **DO NOT** modify any files
- **DO NOT** stage or commit changes
- **DO NOT** run destructive commands
- **DO** provide thorough analysis
- **DO** be specific about concerns (file, line, issue)
- **DO** prioritize concerns by severity
- **DO** provide actionable recommendations
- **DO** consider project structure (Fastify, Prisma, Vite/React, monorepo)
- **DO** verify API and web stay in sync where relevant
- **DO** check migrations and schema consistency

---

## Notes

- This command is **read-only** — it analyzes but never modifies
- Focus on **actionable feedback** — tell the user what to look for and why
- Be **thorough but concise** — cover important aspects without being verbose
- **Prioritize** concerns by severity — critical issues first
- **Be constructive** — explain why something is a concern and how to address it
- **Consider context** — understand the project's architecture (ARCHITECTURE.md, stack above)
- **Be specific** — reference file paths, line numbers, and exact issues
- **Monorepo awareness** — consider impact across apps and packages
- **Migration coordination** — ensure schema changes have migrations and types regenerated where needed
