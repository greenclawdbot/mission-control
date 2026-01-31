# Mission Control - Progress Tracker

## Milestones

### ✅ Milestone A — MVP
- [x] Board CRUD tasks
- [x] Drag/drop between columns
- [x] Task drawer with full details
- [x] Audit log (API ready, UI in Milestone B)
- [x] Bot plan + progress fields
- [x] Basic filtering/search (UI ready, API supports)
- [x] Docker Compose (API + DB)
- [x] Seed data with realistic tasks

### ✅ Milestone B — Observability Upgrade (In Progress)
- [x] Execution state model (queued | running | waiting | idle | failed | completed)
- [x] Task Detail Drawer with plan checklist UI
- [x] Bot progress log display
- [x] Audit trail UI
- [x] BotRun model for tracking executions
- [x] Task dependencies model
- [x] Approval gates (needsApproval field)
- [x] Last action / heartbeat tracking
- [x] Idle too long warnings
- [x] BotRun API endpoints
- [x] Dependency management UI

### ✅ Milestone C — Live Updates + Autonomy (NEW)
- [x] WebSocket server for real-time updates
- [x] Event types: task:created, task:updated, task:deleted, run:created, run:completed
- [x] Frontend WebSocket hook (useWebSocket)
- [x] Session binding for crash recovery
- [x] Atomic task claim API
- [x] Bot polling endpoint (/api/v1/tasks/ready-for-work)
- [x] Stale lock cleanup API

### Milestone D — v1
- [ ] Multiple boards/projects
- [ ] Swimlanes by assignee
- [ ] WIP limits
- [ ] In-app notifications
- [ ] Bot run/session viewer

## Current Status

**Phase**: Milestone C - Live Updates + Autonomy Complete

### Recently Added
- WebSocket server at `/api/v1/ws` for live updates
- Real-time task create/update/delete events
- Frontend automatically updates when server state changes
- Session binding (`sessionKey`, `sessionLockedAt`) for crash recovery
- Atomic claim API (`POST /api/tasks/:id/claim`)
- Bot polling endpoint for autonomous work (`GET /api/tasks/ready-for-work`)
- Stale lock cleanup (`POST /api/tasks/cleanup-stale`)

### How Live Updates Work
1. Frontend connects to WebSocket on page load
2. Client subscribes to 'tasks' channel
3. Server emits events on any task mutation
4. Frontend updates state incrementally (no full refetch)

### How Bot Autonomy Works
1. Bot polls `/api/v1/tasks/ready-for-work?sessionKey=xxx&assignee=clawdbot`
2. Server finds unclaimed Ready task and atomically claims it
3. Bot spawns sub-agent session to do work
4. Bot calls existing APIs (updateTask, logProgress)
5. Those APIs emit WebSocket events → UI updates live
6. On crash, stale locks are cleaned up by cron/cleanup endpoint

## Testing Live Updates

```bash
# Terminal 1: Start API
cd mission-control/apps/api && npm run dev

# Terminal 2: Start Frontend  
cd mission-control/apps/web && npm run dev

# Test:
# 1. Open http://localhost:5173 in two browser tabs
# 2. Create a task in tab 1 → appears instantly in tab 2
# 3. Move a task in tab 1 → updates in tab 2
# 4. Delete a task in tab 1 → disappears from tab 2
```

## API Endpoints

### WebSocket
- `ws://host/api/v1/ws` - Connect for live updates
- Send: `{ type: 'subscribe', payload: 'tasks' }`
- Receive: `{ type: 'task:created', data: Task, timestamp: string }`

### Session Binding
- `POST /api/v1/tasks/:id/claim` - Atomic claim `{ sessionKey: string }`
- `POST /api/v1/tasks/:id/release` - Release lock `{ sessionKey: string }`
- `POST /api/v1/tasks/cleanup-stale` - `{ olderThanMinutes: 5 }`

### Bot Autonomy
- `GET /api/v1/tasks/ready-for-work?sessionKey=xxx&assignee=clawdbot`
- Returns `{ task: Task | null, action: 'claimed' | 'none' }`

## Environment Variables

No new env vars required. WebSocket uses same port as HTTP.

## Known Limitations
- No reconnection backoff (immediate reconnect only)
- No offline queue for missed events
- No authentication on WebSocket (dev only)

## Notes

- Started: 2026-01-30
- Live Updates + Autonomy completed: 2026-01-30
