# Mission Control

A Mission Control–style project management web app for managing Clawdbot's work with full observability and audit trails.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ (local install; no Docker required for development)

### Development (local Postgres + npm)

Two things must be running: **PostgreSQL** first, then the **client and server** via npm.

#### 1. PostgreSQL (start first)

- You need **local PostgreSQL 15+** running (e.g. Homebrew, Postgres.app, or your OS package manager).
- **Start Postgres** (examples; use whatever you use):
  - **macOS (Homebrew):** `brew services start postgresql@15` (or your version). Logs: check `brew services list` and your Postgres data directory or `~/Library/Logs/` if applicable.
  - **macOS (Postgres.app):** Start from the app; check its log window for errors.
  - **Linux:** e.g. `sudo systemctl start postgresql` (or `pg_ctl start`); logs are usually under `/var/log` or the data directory.
- Ensure it’s listening on **localhost:5432** and that your `.env` has:
  - `DATABASE_URL=postgresql://mission_control:mission_control_secret@localhost:5432/mission_control`
- **Create the DB/user** if needed (e.g. `createuser mission_control` and `createdb mission_control`, or your usual method) so they match `.env.example`.

#### 2. Client and server (npm scripts)

In a **terminal**, from the repo root:

```bash
npm install
cp .env.example .env
# Edit .env with your DATABASE_URL if needed
npm run db:migrate   # applies migrations using root .env (same DB as the API)
npm run db:seed
npm run dev
```

`npm run dev` starts **both** the API server and the web client (via concurrently). All app logs and errors appear in this terminal.

- API: http://localhost:3001 (or `PORT` from env)
- Web: http://localhost:5173

**Web app API URL:** The frontend talks to the API via `VITE_API_URL` (in `.env` or `apps/web/.env`). If unset, it uses the Vite proxy to `http://localhost:3001`. For **network access** (e.g. from another device), API and web already listen on `0.0.0.0`. Open `http://<LAN_IP>:5173` and set `VITE_API_URL=http://<LAN_IP>:3001` in local `.env` so the browser can reach the API by IP. Do not commit real IPs; keep them in `.env` only.

#### Summary (no Docker)

| What       | How to start                           | Where errors show        |
| ---------- | -------------------------------------- | ------------------------ |
| PostgreSQL | Your usual method (e.g. brew/services) | Your Postgres logs / UI  |
| API + Web  | `npm run dev` (one terminal)           | That same terminal       |

#### Troubleshooting / Seeing errors

- **Postgres:** Use your normal way to view Postgres logs (e.g. Postgres.app log window, `tail -f` on the log file, or `brew services` / `systemctl` logs). If the API can’t connect, confirm Postgres is running and `DATABASE_URL` in `.env` is correct.
- **App:** All API and web errors show in the terminal where you ran `npm run dev`.

### Production with Docker

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- API on port 3000
- Web UI on port 8080

## Features

### Kanban Board
- Drag-and-drop task management across columns
- Visual indicators for bot-assigned tasks
- Blocked task warnings
- Priority badges

### Task Details
- Markdown description support
- Editable fields (status, assignee, priority, tags)
- Bot plan checklist with progress tracking
- Progress log showing bot actions

### Bot Integration
- **Heartbeat polling**: Bot checks every ~30s for assigned tasks
- **Webhook notifications**: Immediate alerts when tasks are created/modified

### Audit Trail
- Immutable event log for all changes
- Tracks who (human/bot) made changes
- Before/after snapshots for debugging

## Project Structure

```
mission-control/
├── apps/
│   ├── api/           # Node.js + TypeScript backend
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── app.ts
│   │   │   ├── routes/     # API routes
│   │   │   └── services/   # Business logic
│   │   └── prisma/
│   └── web/           # React + Vite frontend
│       ├── src/
│       │   ├── App.tsx
│       │   ├── components/
│       │   └── api/
│       └── vite.config.ts
└── packages/
    └── shared/        # Shared TypeScript types
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tasks` | List all tasks |
| POST | `/api/v1/tasks` | Create task |
| GET | `/api/v1/tasks/:id` | Get task details |
| PATCH | `/api/v1/tasks/:id` | Update task |
| PUT | `/api/v1/tasks/:id/move` | Move task |
| DELETE | `/api/v1/tasks/:id` | Delete task |
| GET | `/api/v1/board/summary` | Board statistics |
| GET | `/api/v1/tasks/:id/events` | Task audit log |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `PORT` | API server port | 3000 |
| `WEBHOOK_URL` | Bot webhook endpoint | Optional |
