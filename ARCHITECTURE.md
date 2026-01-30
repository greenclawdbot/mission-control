# Mission Control - Clawdbot Project Management

A Mission Control–style project management web app for managing Clawdbot's work with full observability and audit trails.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Mission Control                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐ │
│  │   React     │◄──►│  Fastify    │◄──►│   PostgreSQL    │ │
│  │  Frontend   │    │    API      │    │   (Prisma)      │ │
│  └─────────────┘    └──────┬──────┘    └─────────────────┘ │
│                            │                                 │
│                   ┌────────┴────────┐                       │
│                   │   Webhook       │                       │
│                   │   Endpoint      │                       │
│                   └────────┬────────┘                       │
└────────────────────────────┼────────────────────────────────┘
                             │ HTTP POST
                             ▼
                    ┌────────────────┐
                    │   Clawdbot     │
                    │    Agent       │
                    └────────────────┘
```

## Communication Patterns

1. **Heartbeat Polling** (every ~30s):
   - Agent checks `/api/tasks?assignee=clawdbot&status=Ready`
   - Agent picks up queued work

2. **Immediate Webhook** (on task change):
   - Frontend POSTs to `/api/tasks` or PATCHs
   - Backend fires webhook to agent endpoint
   - Agent reacts immediately

## Tech Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS (dark mode)
- **Backend**: Node.js + TypeScript + Fastify + Prisma
- **Database**: PostgreSQL 15
- **Infra**: Docker Compose (API + DB)
- **State**: Server-authoritative

## Core Features

- Kanban board with drag-and-drop
- Task detail drawer with full observability
- Bot plan checklist + progress log
- Complete audit trail (immutable events)
- Webhook notifications to agent
