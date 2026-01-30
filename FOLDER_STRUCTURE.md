# Mission Control - Folder Structure

```
mission-control/
├── .env.example                 # Environment template
├── .gitignore
├── docker-compose.yml           # API + PostgreSQL
├── README.md
├── ARCHITECTURE.md
├── API.md
├── progress.md                  # Milestone tracking
│
├── apps/
│   ├── api/                     # Node.js + TypeScript backend
│   │   ├── src/
│   │   │   ├── index.ts         # Entry point
│   │   │   ├── app.ts           # Fastify instance
│   │   │   ├── routes/
│   │   │   │   ├── tasks.ts     # Task CRUD endpoints
│   │   │   │   ├── audit.ts     # Audit trail endpoints
│   │   │   │   ├── board.ts     # Board summary endpoints
│   │   │   │   └── webhooks.ts  # Webhook handlers
│   │   │   ├── services/
│   │   │   │   ├── taskService.ts
│   │   │   │   ├── auditService.ts
│   │   │   │   └── webhookService.ts
│   │   │   ├── db/
│   │   │   │   └── client.ts    # Prisma client
│   │   │   └── types/
│   │   │       └── express.d.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── prisma/
│   │       └── schema.prisma
│   │
│   └── web/                     # React + Vite frontend
│       ├── src/
│       │   ├── main.tsx         # Entry point
│       │   ├── App.tsx          # Root component
│       │   ├── components/
│       │   │   ├── Board.tsx           # Main Kanban board
│       │   │   ├── Column.tsx          # Column component
│       │   │   ├── TaskCard.tsx        # Individual task card
│       │   │   ├── TaskDrawer.tsx      # Right-side task detail
│       │   │   ├── SummaryBar.tsx      # Top summary statistics
│       │   │   ├── NewTaskModal.tsx    # Create task modal
│       │   │   └── AuditLog.tsx        # Activity timeline
│       │   ├── hooks/
│       │   │   ├── useTasks.ts         # Task state management
│       │   │   ├── useDragDrop.ts      # Drag-and-drop logic
│       │   │   └── useWebsocket.ts     # Real-time updates (future)
│       │   ├── api/
│       │   │   ├── client.ts           # API client
│       │   │   └── types.ts            # Shared types
│       │   ├── pages/
│       │   │   └── BoardPage.tsx
│       │   ├── styles/
│       │   │   └── index.css           # Tailwind imports
│       │   └── vite-env.d.ts
│       ├── package.json
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       ├── tsconfig.json
│       └── index.html
│
└── packages/
    └── shared/                  # Shared types & schemas
        ├── src/
        │   ├── types.ts         # TypeScript interfaces
        │   └── constants.ts     # Constants (status, priority)
        ├── package.json
        └── tsconfig.json
```

## Key Design Decisions

- **Monorepo structure**: `/apps` for deployables, `/packages` for shared code
- **Server-authoritative**: API is the source of truth; frontend syncs via REST
- **Type sharing**: Shared types in `/packages/shared` to ensure API/UI consistency
- **Service layer**: Business logic separated from route handlers
- **Prisma in api/**: Database layer co-located with API, not shared
