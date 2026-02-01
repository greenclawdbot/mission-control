import { Prisma } from '@prisma/client';
import prisma from '../db/client';

export interface AuditEventInput {
  eventType: string;
  entityType: 'Task' | 'User';
  entityId: string;
  actor: 'human' | 'clawdbot';
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export async function emitAuditEvent(input: AuditEventInput): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      actor: input.actor,
      before: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
      timestamp: new Date()
    }
  });
}

export async function getTaskAuditEvents(taskId: string): Promise<{
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actor: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: Date;
}[]> {
  const rows = await prisma.auditEvent.findMany({
    where: { taskId },
    orderBy: { timestamp: 'desc' }
  });
  return rows as {
    id: string;
    eventType: string;
    entityType: string;
    entityId: string;
    actor: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    timestamp: Date;
  }[];
}

export async function getAllAuditEvents(filters?: {
  entityType?: string;
  actor?: string;
  eventType?: string;
  limit?: number;
}): Promise<{
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actor: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: Date;
}[]> {
  const where: Record<string, unknown> = {};

  if (filters?.entityType) where.entityType = filters.entityType;
  if (filters?.actor) where.actor = filters.actor;
  if (filters?.eventType) where.eventType = filters.eventType;

  const rows = await prisma.auditEvent.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: filters?.limit || 100
  });
  return rows as {
    id: string;
    eventType: string;
    entityType: string;
    entityId: string;
    actor: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    timestamp: Date;
  }[];
}
