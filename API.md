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
  "planDocument": "string|null",
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
- `planDocument`: current plan text from the planning phase (nullable); use in addition to conversation for ready work
- `workFolder`: project folder path when the task has a project; `null` otherwise
- `projectName`: project name when the task has a project (omitted when null)
- `model`: optional model override from stage settings

## Task conversation (ongoing feed per task)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks/:id/conversation` | Get ordered conversation messages for a task |
| POST | `/tasks/:id/conversation` | Append a user message (body: `{ content: string }`) |

When the bot reports results via **PATCH** `/tasks/:id` with `results`, include optional `botRunId` (current run id) so the new assistant message is linked to that run. The API appends an assistant message to the conversation and updates `Task.results`.

## Task planning conversation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks/:id/planning-conversation` | Get ordered planning conversation messages for a task |
| POST | `/tasks/:id/planning-conversation` | Append a user message (body: `{ content: string }`). If the task's status is not Planning, the task is moved to Planning so it is queued for the planner. |

Planning conversation is a separate thread from the main task conversation. The planner bot polls **GET** `/tasks/planning-items` for tasks in Planning, receives `planningConversationForPrompt` and `planningConversation`, then submits a plan via **POST** `/tasks/:id/planning-complete` with `plan` (optional). The plan is appended as an assistant message to the planning conversation and stored as `Task.planDocument`. Ready-for-work includes `planDocument` in the response.

## Planning items (bot polling)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks/planning-items` | List tasks in Planning for external polling (query: optional `projectId`) |

Each item includes:
- `task`: full task object
- `planningPrompt`: Planning stage system prompt (from stage settings)
- `planningConversationForPrompt`: task title + planning conversation messages formatted for the LLM
- `planningConversation`: array of planning messages (ordered by `createdAt`)
- `workFolder`: project folder path when the task has a project; `null` otherwise
- `projectName`: project name when the task has a project (omitted when null)
- `model`: optional model override from stage settings

## Planning complete

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tasks/:id/planning-complete` | External system (planner) submits plan; task is moved to configured destination (e.g. Backlog) |

Body: `{ plan?: string, planChecklist?: string[] }`. Both are optional. If `plan` is provided: the plan is appended as an assistant message to the planning conversation and stored as `Task.planDocument`. If `planChecklist` is provided: task's `planChecklist` is updated. The task is then moved to the destination status from stage settings (`planningDestinationStatus` or Backlog).

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
