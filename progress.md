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
- [ ] BotRun API endpoints
- [ ] Dependency management UI

### Milestone C — v1
- [ ] Multiple boards/projects
- [ ] Swimlanes by assignee
- [ ] WIP limits
- [ ] In-app notifications
- [ ] Bot run/session viewer

## Current Status

**Phase**: Implementing Milestone B - Observability Upgrade

### Recently Added
- Execution state tracking (queued/running/waiting/idle/failed/completed)
- Plan checklist with interactive checkboxes
- Bot progress log with status badges
- Audit trail display in task drawer
- BotRun model for execution history
- Task dependencies (blockedBy field)
- Approval gates (needsApproval flag)
- Last action and heartbeat timestamps
- Running bots count in summary
- Idle task warnings on task cards

### Still Needed
- BotRun API endpoints (/api/v1/tasks/:id/runs)
- Dependency management in drawer
- Auto-unblock when dependencies complete
- Retry/cancel controls for bot runs

### Milestone B — v1
- [ ] Multiple boards/projects
- [ ] Swimlanes by assignee
- [ ] WIP limits
- [ ] Task dependencies ("blocked by")
- [ ] In-app notifications
- [ ] Bot run/session viewer

## Current Status

**Phase**: Planning complete, starting implementation

## Notes

- Started: 2026-01-30
