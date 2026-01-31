# /fullsecurityreview

**Purpose**

Perform a comprehensive, adversarial security review of the entire repository (not just current git diffs). Identify vulnerabilities, unsafe patterns, misconfigurations, and bot-specific risks. Provide prioritized hardening recommendations and concrete remediation guidance. This command analyzes but does not modify any files.

**Use When**

- You're building software that will run with bots/agents (local or remote) and need end-to-end security posture review
- You want to catch supply-chain, auth, data, and runtime risks before deploying
- You want a repeatable "security gate" report you can run before releases
- You want recommendations tailored to Fastify + Prisma + Vite/React + monorepo + real-time (SSE/WS)

---

## What to Do

### 0) Safety & Constraints (Read-only)

- **DO NOT** modify files, install packages, rotate secrets, or change infra
- **DO NOT** run destructive commands (no deletes, resets, migrations against prod)
- **DO** collect evidence (file paths, line numbers, configs) for every finding

---

### 1) Repository Inventory (Whole-project scope)

**1.1 Identify structure and entrypoints**

- Enumerate workspaces: apps/api, apps/web, packages/*
- Identify server entrypoints (Fastify bootstrap, WS/SSE, cron/background workers)
- Identify any bot/agent runners, job executors, webhook handlers, git integrations

**1.2 Dependency & supply-chain surface**

- Inspect package.json (root + workspaces), lockfile, and any scripts
- Note packages with native bindings, postinstall scripts, or risky capabilities
- Check for dependency duplication and version drift across workspaces

**1.3 Runtime & deployment surface**

- Review Dockerfiles, docker-compose.yml, any reverse proxy configs
- Identify environment variable usage and secrets sources
- Determine whether this runs in containers, bare metal, or serverless

---

### 2) Threat Model (Bot/Agent-first)

Build a short threat model before scanning details:

- **Assets**: tokens/keys, DB contents, user data, bot credentials, GitHub credentials, audit logs, files on disk, build artifacts
- **Trust boundaries**: web client ↔ api, api ↔ DB, api ↔ GitHub, api ↔ bot runner, bot ↔ filesystem, bot ↔ network
- **Attacker profiles**:
  - External attacker via HTTP endpoints
  - Authenticated but malicious user
  - Compromised bot credentials / prompt-injection via sources
  - Supply-chain compromise (deps, CI)
  - Insider (logs, env access)

Output a 1-page threat model summary in the report (top risks + assumptions).

---

### 3) Automated Security Checks (Non-destructive)

Run these, capture outputs in the report:

**Node/JS**

- `npm audit --workspaces` (or equivalent)
- `npm ls --workspaces` (spot duplicates / weird transitive deps)
- `npx depcheck` (optional; identify unused deps that expand attack surface)
- `npx eslint .` (if configured) and note security-related rules

**Secrets & sensitive data**

- `git grep -nE "(API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|BEGIN RSA|BEGIN OPENSSH|sk-|ghp_|xoxb-)" .`
- Check for .env* files committed (verify .gitignore)

**Code search for dangerous primitives**

- `git grep -nE "(eval\(|new Function\(|child_process|exec\(|spawn\(|docker|kubectl|fs\.rm|rm -rf|path\.join\(.+req\.|dangerouslySetInnerHTML)" apps packages`

Note: If you already use a dedicated secret scanner (gitleaks/trufflehog), include it here, but keep it read-only.

---

### 4) API Security Review (apps/api — Fastify)

**A) Authentication & Authorization**

- Identify auth mechanism (JWT/cookies/session/API keys)
- Confirm:
  - Auth required by default (deny-by-default)
  - Role/permission checks on every sensitive route
  - Ownership checks (multi-tenant isolation)
  - No "internal" endpoints exposed publicly

**B) Input Validation & Deserialization**

- Verify every route validates: params, query, body (Zod or equivalent), content-type expectations, limits (string length, array length, nesting depth)
- Watch for: JSON schema gaps on "bot commands", unsafe parsing, trusting client-supplied IDs

**C) Rate limiting & abuse protection**

- Check for @fastify/rate-limit or an equivalent gateway limit
- Ensure special care for: login, token exchange, webhooks, "execute" endpoints, SSE/WS upgrades

**D) CORS, CSRF, Cookies**

- Confirm CORS is strict (explicit origins, credentials rules)
- If cookies used: HttpOnly, Secure, SameSite; CSRF protection for state-changing endpoints

**E) Error Handling & Leakage**

- Ensure: no stack traces / secrets in responses, consistent error shapes, log redaction (tokens, passwords)

**F) Real-time: SSE/WebSocket**

- Verify: auth on connect + per-message authorization, cleanup on disconnect, backpressure and message size limits, channel scoping (tenant/user isolation)

---

### 5) Database Security Review (Prisma)

- Confirm Prisma is used safely: no raw SQL with string interpolation, no "allowlist bypass" for orderBy / dynamic filters
- Multi-tenant checks: ensure queries always scope by tenant/user where required
- Migration hygiene: destructive migrations flagged; seed scripts don't create default admin creds in prod
- Connection security: TLS to DB in prod (if applicable); least-privilege DB user (no superuser for app)

---

### 6) Web Security Review (apps/web — React/Vite)

- Check for XSS vectors: dangerouslySetInnerHTML, markdown renderers, HTML sanitization
- Check auth/token handling: no tokens in localStorage unless justified; proper refresh / expiry
- Check API client: base URL via env, no hardcoded internal URLs; consistent error handling
- Check CSP readiness: ability to set CSP headers in deployment
- Check dependency risks: markdown libs, syntax highlighters, HTML parsers, clipboard libs

---

### 7) Bot/Agent Hardening (Core focus)

**A) Capability boundaries**

- Identify any "tooling" endpoints that let bots: read/write files, run commands, call external URLs, access GitHub repos
- Require: explicit allowlists (paths, commands, domains), per-tool authorization + audit logs, strict timeouts and output caps, sandboxing strategy (separate user, container, seccomp/apparmor if available)

**B) Prompt-injection / untrusted inputs**

- Treat all external text as hostile: issues/PRs, webhooks, chat messages, scraped pages
- Require: "instruction hierarchy" guardrails, tool-call justification + policy checks, content provenance tagging (source → trust level)

**C) Secrets handling in bot runs**

- Ensure bots never: print env vars, echo tokens in logs, store secrets in DB plaintext
- Add redaction rules in logger

**D) Auditability**

- Every bot action should create an audit record: actor (bot/user), tool invoked, target resource, diff/summary, success/failure
- Correlation IDs per request/session

---

### 8) CI/CD & Repo Hygiene

- GitHub Actions / CI: least-privilege GITHUB_TOKEN; secrets not exposed to PRs from forks; pin actions by commit SHA (preferred)
- Branch protection & release: required checks (tests, lint, typecheck, audit)
- SAST hooks: optional CodeQL or equivalent (recommend, but don't auto-add)

---

### 9) Produce Findings (Prioritized & Actionable)

For each issue found:

- **Severity**: Critical / High / Medium / Low / Informational
- **Category**: AuthZ, Input Validation, Secrets, Supply Chain, Bot Safety, XSS, SSRF, RCE, Data Leakage, Misconfig, Logging, CI
- **Evidence**: file path + line(s) + snippet summary
- **Impact**: what could happen
- **Exploit sketch**: 2–4 sentences (how it could be abused)
- **Recommendation**: specific fix and safer pattern
- **Hardening options**: quick fix vs robust fix

---

## Output Format

1. **Executive Summary**
   - Overall posture: Acceptable / Needs hardening / High risk
   - Top 5 risks (most exploitable / highest impact)
   - Bot-specific risk summary (capabilities, boundaries, auditability)

2. **Threat Model Snapshot**
   - assets, boundaries, attacker profiles, key assumptions

3. **Attack Surface Map**
   - endpoints, websockets/sse channels, webhooks, "execute" flows, CI, data stores

4. **Findings (Prioritized)**
   - Grouped by severity (Critical → Informational)
   - Each finding in the standardized template above

5. **Hardening Plan**
   - Immediate (today): must-do, minimal-change mitigations
   - Next sprint: structural fixes (authz framework, sandboxing, rate limits)
   - Ongoing: policies, monitoring, dependency management

6. **Verification Checklist**
   - exact commands/tests to rerun to confirm fixes
   - "definition of done" for security gate

---

## Security Review Heuristics (What to Flag)

**Red flags (usually Critical/High)**

- Any remote command execution path (direct or indirect)
- SSRF possibilities (fetching arbitrary URLs from user input)
- Missing authz on routes that access data, tools, or bots
- Webhooks without signature verification + replay protection
- Tokens/secrets in logs, responses, or committed files
- Multi-tenant data access without tenant scoping
- WS/SSE channels leaking cross-user events
- CI workflows exposing secrets to untrusted PRs

**Bot-specific red flags**

- Bot can write outside a workspace directory
- Bot can call arbitrary network destinations
- Bot can open PRs/issues using a high-privilege token without constraints
- No audit trail for tool calls and side effects

---

## Constraints (Reminder)

- **DO NOT** modify files or configs
- **DO** be exhaustive (entire repo), not just diffs
- **DO** tie every claim to evidence (file/line)
- **DO** prioritize by real-world exploitability and impact
