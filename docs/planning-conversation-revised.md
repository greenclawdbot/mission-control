# Planning conversation flow — revised design

This document captures the **revised** design: separate planning conversation (all messages saved) + plan document (single field), with ready-for-work receiving main conversation **plus** plan document (plan not mixed into messages).

## Target flow (revised)

1. **Planning conversation** = a **separate** thread for the planning phase. **All** messages (user feedback + LLM replies) are saved in this thread. It is **not** the main task conversation.

2. **Plan document** = a single artifact (e.g. `Task.planDocument`) that holds **the current plan**. It is updated to **the latest response from the LLM that we interpret as the plan** (i.e. when the bot calls planning-complete with `plan`, we update this field). The plan is **not** stored as an assistant message in the main conversation — so the main feed is not polluted with the plan.

3. **Ready-for-work** receives: main conversation messages (user context + execution results only), **plus** the **plan document** as a separate field (e.g. `planDocument` in the response), so the bot gets both without mixing the plan into the message thread.

4. When the bot submits a plan via planning-complete: (1) **append** an assistant message to the **planning conversation** (so the full planning thread is saved); (2) **update** `Task.planDocument` to that plan text (so "the plan" is the latest LLM response and ready-for-work can include it). Re-plan: user adds feedback to the planning conversation, bot runs again and submits a new plan — we append again to the planning conversation and **update** the plan document to the new content.

5. **Submit message → queue for planner:** When the user submits a message to the planning conversation and the task is **not** in the Planning phase (so it would not be picked up by the planner), **automatically move the task to Planning** so it gets queued for the planner. The planner will pick it up on the next poll, produce a plan, call planning-complete, and we move the task to Backlog. So: from Backlog (or elsewhere), user adds a message to the planning conversation → we save the message and set status = Planning → bot picks it up, responds with a plan → planning-complete moves to Backlog.

So: planning conversation = full thread, saved; plan document = single value, always the latest plan; main conversation = unchanged; ready = messages + plan document; posting to planning conversation from non-Planning status queues the task for the planner, then planner response moves it to Backlog.

---

## Implementation summary

### Schema

- **TaskPlanningMessage** model: `id`, `taskId`, `role` (user | assistant), `content` (Text), `createdAt`. Relation to Task. Index on `taskId`, `createdAt`.
- **Task.planDocument** `String? @db.Text` — nullable; holds the current plan text, updated when planning-complete is called with `plan`.

### API

- **GET/POST `/tasks/:id/planning-conversation`** — get all planning messages; append a user message (planning feedback). **When appending a user message:** if the task's status is not Planning, set status = Planning so the task is queued for the planner (bot picks it up, responds, planning-complete moves to Backlog).
- **GET `/tasks/planning-items`** — for each task in Planning, return `planningConversationForPrompt` and `planningConversation` from the **planning** thread only (not main conversation).
- **POST `/tasks/:id/planning-complete`** — accept `plan` (optional) and `planChecklist` (optional). If `plan`: append assistant message to planning conversation and set `Task.planDocument = plan`. Move task to destination (e.g. Backlog).
- **GET `/tasks/ready-for-work`** — add `planDocument: task.planDocument ?? null` to the response (main conversation unchanged; plan document in addition).

### Service

- `getPlanningConversationForTask(taskId)`
- `appendPlanningUserMessage(taskId, content)`
- `appendPlanningAssistantMessage(taskId, content)` — appends to planning thread and sets `Task.planDocument = content`.

### Frontend

- **Planning** tab/section: show planning conversation (GET planning-conversation) and input to add user message (POST planning-conversation). Current plan = latest assistant message in that thread or `task.planDocument`.
- **Conversation** tab = main conversation only (user context + execution results).
- **Plan** tab can show "Current plan" (e.g. `task.planDocument` as markdown) in addition to checklist.

### Data flow

1. User moves task to Planning **or** user posts a message to the planning conversation from any status → if not already Planning, task is moved to Planning (queued for planner).
2. Bot polls GET planning-items → gets planning conversation (and optionally task title/description).
3. Bot produces plan → POST planning-complete with `plan` → append to planning conversation, set Task.planDocument, move to Backlog.
4. User can add planning feedback (POST planning-conversation); if task was in Backlog/elsewhere, posting moves it to Planning so the planner picks it up again. Re-plan: plan document overwritten, task ends in Backlog.
5. User moves task to Ready. Bot polls GET ready-for-work → gets main conversation **and** planDocument.
