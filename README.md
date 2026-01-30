# Mission Control

A Mission Control–style project management web app for managing Clawdbot's work with full observability and audit trails.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ (or Docker)

### Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment:
   ```bash
   cp .env.example .env
   # Edit .env with your DATABASE_URL
   ```

3. Start database (if using local PostgreSQL):
   ```bash
   # Or use Docker:
   docker-compose up -d db
   ```

4. Initialize database:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. Start development servers:
   ```bash
   npm run dev
   ```

   This starts:
   - API server: http://localhost:3000
   - Web dev server: http://localhost:5173

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
