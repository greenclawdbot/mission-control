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

## Ready for work (bot polling)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks/ready-for-work` | Claim a Ready task for the bot (query: `sessionKey`, `assignee`) |

When a task is claimed, the response includes:
- `task`: full task object
- `action`: `"claimed"`
- `readyPrompt`: instructions for the bot (project context + stage instructions first)
- `conversationForPrompt`: full conversation so far (task title + ordered user/assistant messages) for the LLM to continue the thread
- `conversation`: array of conversation messages (ordered by `createdAt`) for chat-style consumption
- `workFolder`: project folder path when the task has a project; `null` otherwise
- `projectName`: project name when the task has a project (omitted when null)
- `model`: optional model override from stage settings

## Task conversation (ongoing feed per task)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks/:id/conversation` | Get ordered conversation messages for a task |
| POST | `/tasks/:id/conversation` | Append a user message (body: `{ content: string }`) |

When the bot reports results via **PATCH** `/tasks/:id` with `results`, include optional `botRunId` (current run id) so the new assistant message is linked to that run. The API appends an assistant message to the conversation and updates `Task.results`.

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
