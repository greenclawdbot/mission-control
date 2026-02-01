import prisma from '../db/client';
import { Project } from '@shared/src/types';

export async function listProjects(archived?: boolean): Promise<Project[]> {
  const where: { archivedAt?: null | { not: null } } = {};
  if (archived === true) {
    where.archivedAt = { not: null };
  } else if (archived === false || archived === undefined) {
    where.archivedAt = null;
  }
  const rows = await prisma.project.findMany({
    where,
    orderBy: { name: 'asc' }
  });
  return rows.map(mapPrismaProjectToProject);
}

export async function getProjectById(id: string): Promise<Project | null> {
  const row = await prisma.project.findUnique({
    where: { id }
  });
  return row ? mapPrismaProjectToProject(row) : null;
}

export async function createProject(data: { name: string; folderPath: string; color?: string | null }): Promise<Project> {
  const row = await prisma.project.create({
    data: {
      name: data.name,
      folderPath: data.folderPath,
      ...(data.color !== undefined && { color: data.color })
    }
  });
  return mapPrismaProjectToProject(row);
}

export async function updateProject(
  id: string,
  data: { name?: string; folderPath?: string; color?: string | null }
): Promise<Project | null> {
  const row = await prisma.project.findUnique({ where: { id } });
  if (!row) return null;
  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.folderPath !== undefined && { folderPath: data.folderPath }),
      ...(data.color !== undefined && { color: data.color })
    }
  });
  return mapPrismaProjectToProject(updated);
}

export async function setProjectPath(id: string, folderPath: string): Promise<Project | null> {
  const row = await prisma.project.findUnique({ where: { id } });
  if (!row) return null;
  const updated = await prisma.project.update({
    where: { id },
    data: { folderPath }
  });
  return mapPrismaProjectToProject(updated);
}

export type ProjectTaskCounts = Record<string, { notDone: number; done: number }>;

/** Task counts per project (key "none" = projectId null). */
export async function getProjectTaskCounts(): Promise<ProjectTaskCounts> {
  const [doneGroups, notDoneGroups] = await Promise.all([
    prisma.task.groupBy({
      by: ['projectId'],
      _count: { id: true },
      where: { status: 'Done' }
    }),
    prisma.task.groupBy({
      by: ['projectId'],
      _count: { id: true },
      where: { status: { not: 'Done' } }
    })
  ]);
  const counts: ProjectTaskCounts = {};
  const key = (id: string | null) => (id === null ? 'none' : id);
  for (const g of doneGroups) {
    const k = key(g.projectId);
    if (!counts[k]) counts[k] = { notDone: 0, done: 0 };
    counts[k].done = g._count.id;
  }
  for (const g of notDoneGroups) {
    const k = key(g.projectId);
    if (!counts[k]) counts[k] = { notDone: 0, done: 0 };
    counts[k].notDone = g._count.id;
  }
  return counts;
}

/** Soft delete: set archivedAt to now. */
export async function archiveProject(id: string): Promise<Project | null> {
  const row = await prisma.project.findUnique({ where: { id } });
  if (!row) return null;
  const updated = await prisma.project.update({
    where: { id },
    data: { archivedAt: new Date() }
  });
  return mapPrismaProjectToProject(updated);
}

function mapPrismaProjectToProject(row: {
  id: string;
  name: string;
  folderPath: string;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}): Project {
  return {
    id: row.id,
    name: row.name,
    folderPath: row.folderPath,
    color: row.color ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() ?? null
  };
}
