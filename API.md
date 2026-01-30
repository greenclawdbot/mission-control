# API Endpoints

## Base URL
`/api/v1`

## Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks` | List all tasks (with filters: status, assignee, priority, tags) |
| GET | `/tasks/:id` | Get single task by ID |
| POST | `/tasks` | Create new task (triggers webhook if assigned to clawdbot) |
| PATCH | `/tasks/:id` | Update task (triggers webhook if status/assignee changed) |
| PUT | `/tasks/:id/move` | Move task between columns (drag-drop) |
| DELETE | `/tasks/:id` | Delete task |

### Task Response Format
```json
{
  "id": "uuid",
  "title": "string",
  "description": "markdown",
  "status": "Backlog|Ready|InProgress|Blocked|Review|Done",
  "assignee": "human"|"clawdbot",
  "priority": "Low|Medium|High|Critical",
  "tags": ["tag1", "tag2"],
  "planChecklist": ["step 1", "step 2"],
  "currentStepIndex": 0,
  "progressLog": [{"step": "...", "completedAt": "ISO8601"}],
  "blockedReason": "string|null",
  "lastActionAt": "ISO8601|null",
  "estimate": 2.5,
  "timeSpent": 1.0,
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "startedAt": "ISO8601|null",
  "completedAt": "ISO8601|null",
  "dueDate": "ISO8601|null"
}
```

## Audit Trail

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks/:id/events` | Get audit log for a task |
| GET | `/audit` | List all audit events (with filters) |

### Audit Event Format
```json
{
  "id": "uuid",
  "eventType": "task.created",
  "entityType": "Task",
  "entityId": "uuid",
  "actor": "human",
  "before": { ... },
  "after": { ... },
  "timestamp": "ISO8601"
}
```

## Board State

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/board/summary` | Get top summary bar data |
| GET | `/board/columns` | Get grouped tasks by status |

### Summary Response
```json
{
  "tasksThisWeek": 12,
  "inProgress": 3,
  "total": 45,
  "completionPercent": 78
}
```

## Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks/bot` | Endpoint for Clawdbot to receive task notifications |

### Webhook Payload
```json
{
  "event": "task.created",
  "task": { ...full task object... },
  "timestamp": "ISO8601"
}
```

## Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
