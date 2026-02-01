import prisma from '../db/client';
import { TaskStatus, TASK_STATUSES } from '@shared/src/types';
import type { EffectiveStageSettings, StageSettingRow } from '@shared/src/types';

const STAGES = TASK_STATUSES as TaskStatus[];

function mapRow(row: {
  id: string;
  scope: string;
  projectId: string | null;
  stage: string;
  systemPrompt: string | null;
  defaultModel: string | null;
  planningDestinationStatus: string | null;
  readyInstructions: string | null;
  projectContextTemplate: string | null;
}): StageSettingRow {
  return {
    id: row.id,
    scope: row.scope as 'global' | 'project',
    projectId: row.projectId,
    stage: row.stage as TaskStatus,
    systemPrompt: row.systemPrompt,
    defaultModel: row.defaultModel,
    planningDestinationStatus: row.planningDestinationStatus,
    readyInstructions: row.readyInstructions,
    projectContextTemplate: row.projectContextTemplate
  };
}

/** Get effective stage settings for a project (project overrides + global fallback). */
export async function getEffectiveSettings(projectId?: string | null): Promise<EffectiveStageSettings> {
  const globalRows = await prisma.stageSetting.findMany({
    where: { scope: 'global', projectId: null }
  });
  const globalByStage = new Map(globalRows.map(r => [r.stage, r]));

  let projectByStage = new Map<string, typeof globalRows[0]>();
  if (projectId) {
    const projectRows = await prisma.stageSetting.findMany({
      where: { scope: 'project', projectId }
    });
    projectByStage = new Map(projectRows.map(r => [r.stage, r]));
  }

  const result: EffectiveStageSettings = {};
  for (const stage of STAGES) {
    const projectRow = projectByStage.get(stage);
    const globalRow = globalByStage.get(stage);
    const row = projectRow ?? globalRow ?? null;
    result[stage] = {
      systemPrompt: row?.systemPrompt ?? null,
      defaultModel: row?.defaultModel ?? null,
      planningDestinationStatus: row?.planningDestinationStatus ?? null,
      readyInstructions: row?.readyInstructions ?? null,
      projectContextTemplate: row?.projectContextTemplate ?? null
    };
  }
  return result;
}

/** Get all global stage rows. */
export async function getGlobalStageSettings(): Promise<StageSettingRow[]> {
  const rows = await prisma.stageSetting.findMany({
    where: { scope: 'global', projectId: null },
    orderBy: { stage: 'asc' }
  });
  return rows.map(mapRow);
}

/** Upsert global stage settings. Avoid upsert with null in compound unique (Prisma/PostgreSQL issue). */
export async function updateGlobalStageSettings(updates: Record<string, {
  systemPrompt?: string | null;
  defaultModel?: string | null;
  planningDestinationStatus?: string | null;
  readyInstructions?: string | null;
  projectContextTemplate?: string | null;
}>): Promise<StageSettingRow[]> {
  for (const stage of STAGES) {
    const data = updates[stage];
    if (!data) continue;
    const existing = await prisma.stageSetting.findFirst({
      where: { scope: 'global', projectId: null, stage }
    });
    const payload = {
      systemPrompt: data.systemPrompt ?? null,
      defaultModel: data.defaultModel ?? null,
      planningDestinationStatus: data.planningDestinationStatus ?? null,
      readyInstructions: data.readyInstructions ?? null,
      projectContextTemplate: data.projectContextTemplate ?? null
    };
    if (existing) {
      await prisma.stageSetting.update({
        where: { id: existing.id },
        data: payload
      });
    } else {
      await prisma.stageSetting.create({
        data: {
          scope: 'global',
          projectId: null,
          stage,
          ...payload
        }
      });
    }
  }
  return getGlobalStageSettings();
}

/** Get project overrides for stage settings. */
export async function getProjectStageOverrides(projectId: string): Promise<StageSettingRow[]> {
  const rows = await prisma.stageSetting.findMany({
    where: { scope: 'project', projectId },
    orderBy: { stage: 'asc' }
  });
  return rows.map(mapRow);
}

/** Upsert project stage overrides. */
export async function updateProjectStageOverrides(
  projectId: string,
  updates: Record<string, {
    systemPrompt?: string | null;
    defaultModel?: string | null;
    planningDestinationStatus?: string | null;
    readyInstructions?: string | null;
    projectContextTemplate?: string | null;
  }>
): Promise<StageSettingRow[]> {
  for (const stage of STAGES) {
    const data = updates[stage];
    if (!data) continue;
    await prisma.stageSetting.upsert({
      where: {
        scope_projectId_stage: { scope: 'project', projectId, stage }
      },
      create: {
        scope: 'project',
        projectId,
        stage,
        systemPrompt: data.systemPrompt ?? null,
        defaultModel: data.defaultModel ?? null,
        planningDestinationStatus: data.planningDestinationStatus ?? null,
        readyInstructions: data.readyInstructions ?? null,
        projectContextTemplate: data.projectContextTemplate ?? null
      },
      update: {
        ...(data.systemPrompt !== undefined && { systemPrompt: data.systemPrompt }),
        ...(data.defaultModel !== undefined && { defaultModel: data.defaultModel }),
        ...(data.planningDestinationStatus !== undefined && { planningDestinationStatus: data.planningDestinationStatus }),
        ...(data.readyInstructions !== undefined && { readyInstructions: data.readyInstructions }),
        ...(data.projectContextTemplate !== undefined && { projectContextTemplate: data.projectContextTemplate })
      }
    });
  }
  return getProjectStageOverrides(projectId);
}

/** Get effective settings for a single stage (for planning/ready APIs). */
export async function getEffectiveSettingForStage(
  stage: TaskStatus,
  projectId?: string | null
): Promise<{
  systemPrompt: string | null;
  defaultModel: string | null;
  planningDestinationStatus: string | null;
  readyInstructions: string | null;
  projectContextTemplate: string | null;
}> {
  const all = await getEffectiveSettings(projectId);
  return all[stage] ?? {
    systemPrompt: null,
    defaultModel: null,
    planningDestinationStatus: null,
    readyInstructions: null,
    projectContextTemplate: null
  };
}
