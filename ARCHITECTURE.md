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

---

## 📋 Backlog / Feature Ideas

### 🔮 Persona System (Planned)
Multiple personas for Clawdbot that appear as separate Discord users:

**Core Concept:**
- Single Clawdbot backend with multiple persona instances
- Each persona appears as a distinct Discord user (different avatar, name)
- DM each persona separately or add to different channels
- Each persona has its own personality, memory, and skill set

**Example Personas:**
| Persona | Name | Color | Purpose |
|---------|------|-------|---------|
| greendoc | GreenDoc | 🟢 | Health & medical assistant |
| zorkmaster | ZorkMaster | 🟤 | Text adventure gaming |
| theclaw | The Claw | 🦀 | General assistant & kanban |
| codemaster | CodeMaster | 🔵 | Programming help |

**Technical Implementation:**
1. **Persona config file** (YAML/JSON):
   ```yaml
   personas:
     - id: greendoc
       name: "GreenDoc"
       discordUsername: "greendoc"
       avatar: "/avatars/greendoc.png"
       color: "#00FF00"
       systemPrompt: "You are a caring medical and health assistant..."
       skills: [health-tracker, weather, food]
       
     - id: zorkmaster
       name: "ZorkMaster"
       discordUsername: "zorkmaster" 
       avatar: "/avatars/zork.png"
       color: "#8B4513"
       systemPrompt: "You are a text adventure game master..."
       skills: [zork-discord, gaming]
   ```

2. **Discord Integration:**
   - Multiple Discord bot clients (one per persona)
   - Or single bot using channel-based persona switching
   - Each persona responds to its own username/mentions

3. **Memory Isolation:**
   - Each persona has separate memory file
   - Context doesn't bleed between personas

**Priority:** Medium - Core enhancement for multi-context conversations

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
