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

export async function createProject(data: { name: string; folderPath: string }): Promise<Project> {
  const row = await prisma.project.create({
    data: {
      name: data.name,
      folderPath: data.folderPath
    }
  });
  return mapPrismaProjectToProject(row);
}

export async function updateProject(
  id: string,
  data: { name?: string; folderPath?: string }
): Promise<Project | null> {
  const row = await prisma.project.findUnique({ where: { id } });
  if (!row) return null;
  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.folderPath !== undefined && { folderPath: data.folderPath })
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
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}): Project {
  return {
    id: row.id,
    name: row.name,
    folderPath: row.folderPath,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() ?? null
  };
}
