import { useState, useEffect, useCallback } from 'react';
import { TaskStatus, TASK_STATUSES } from '../shared-types';
import { api } from '../api/client';
import { useActiveProject } from '../contexts/ActiveProjectContext';

type StageForm = {
  systemPrompt: string | null;
  defaultModel: string | null;
  planningDestinationStatus: string | null;
  readyInstructions: string | null;
  projectContextTemplate: string | null;
};

const initialStageForm = (): StageForm => ({
  systemPrompt: null,
  defaultModel: null,
  planningDestinationStatus: null,
  readyInstructions: null,
  projectContextTemplate: null
});

export function PromptsPage() {
  const { activeProjectId } = useActiveProject();
  const [settings, setSettings] = useState<Record<string, StageForm>>({});
  const [activeTab, setActiveTab] = useState<TaskStatus>('Planning');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async (projectId: string | null) => {
    setLoading(true);
    try {
      const res = await api.getStageSettings(projectId ?? undefined);
      const next: Record<string, StageForm> = {};
      for (const stage of TASK_STATUSES) {
        const s = res.settings[stage];
        next[stage] = s ? {
          systemPrompt: s.systemPrompt ?? null,
          defaultModel: s.defaultModel ?? null,
          planningDestinationStatus: s.planningDestinationStatus ?? null,
          readyInstructions: s.readyInstructions ?? null,
          projectContextTemplate: s.projectContextTemplate ?? null
        } : initialStageForm();
      }
      setSettings(next);
    } catch (e) {
      console.error('Failed to load settings', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings(activeProjectId);
  }, [activeProjectId, loadSettings]);

  const updateStage = useCallback((stage: TaskStatus, field: keyof StageForm, value: string | null) => {
    setSettings(prev => ({
      ...prev,
      [stage]: {
        ...(prev[stage] ?? initialStageForm()),
        [field]: value
      }
    }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, StageForm> = {};
      for (const stage of TASK_STATUSES) {
        payload[stage] = settings[stage] ?? initialStageForm();
      }
      if (activeProjectId) {
        await api.updateProjectStageOverrides(activeProjectId, payload);
      } else {
        await api.updateGlobalStageSettings(payload);
      }
    } catch (e) {
      console.error('Failed to save settings', e);
    } finally {
      setSaving(false);
  }
  };

  const stageForm = settings[activeTab] ?? initialStageForm();

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>Prompts</h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {activeProjectId && (
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Overrides; global is fallback.
            </span>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '16px', flexShrink: 0 }}>
        {TASK_STATUSES.map(stage => (
          <button
            key={stage}
            type="button"
            className={`btn btn-sm ${activeTab === stage ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab(stage)}
          >
            {stage}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {activeTab === 'New' && (
            <p style={{ color: 'var(--text-secondary)' }}>No settings yet for New.</p>
          )}
          {activeTab === 'Planning' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Project context template</label>
                <textarea
                  className="input textarea"
                  value={stageForm.projectContextTemplate ?? ''}
                  onChange={e => updateStage('Planning', 'projectContextTemplate', e.target.value || null)}
                  placeholder="This task is for the project called {{projectName}} in the folder {{folderPath}}. Please work on that project only in that folder for this request unless otherwise specified."
                  rows={3}
                  style={{ width: '100%' }}
                />
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>Prepended to Planning instructions when the task has a project. Use {'{{projectName}}'} and {'{{folderPath}}'}.</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>System prompt</label>
                <textarea
                  className="input textarea"
                  value={stageForm.systemPrompt ?? ''}
                  onChange={e => updateStage('Planning', 'systemPrompt', e.target.value || null)}
                  placeholder="Planning instructions..."
                  rows={6}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Default model (e.g. minimax)</label>
                <input
                  className="input"
                  value={stageForm.defaultModel ?? ''}
                  onChange={e => updateStage('Planning', 'defaultModel', e.target.value || null)}
                  placeholder="minimax"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>When planning complete, move to</label>
                <select
                  className="input select"
                  value={stageForm.planningDestinationStatus ?? 'Backlog'}
                  onChange={e => updateStage('Planning', 'planningDestinationStatus', e.target.value || null)}
                >
                  {TASK_STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {activeTab === 'Ready' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Project context template</label>
                <textarea
                  className="input textarea"
                  value={stageForm.projectContextTemplate ?? ''}
                  onChange={e => updateStage('Ready', 'projectContextTemplate', e.target.value || null)}
                  placeholder="This task is for the project called {{projectName}} in the folder {{folderPath}}. Please work on that project only in that folder for this request unless otherwise specified."
                  rows={3}
                  style={{ width: '100%' }}
                />
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>Prepended to Ready instructions when the task has a project. Use {'{{projectName}}'} and {'{{folderPath}}'}.</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Ready instructions (sent with items)</label>
                <textarea
                  className="input textarea"
                  value={stageForm.readyInstructions ?? ''}
                  onChange={e => updateStage('Ready', 'readyInstructions', e.target.value || null)}
                  placeholder="Additional instructions for ready items..."
                  rows={6}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Default model</label>
                <input
                  className="input"
                  value={stageForm.defaultModel ?? ''}
                  onChange={e => updateStage('Ready', 'defaultModel', e.target.value || null)}
                  placeholder="minimax"
                />
              </div>
            </div>
          )}
          {!['New', 'Planning', 'Ready'].includes(activeTab) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>System prompt (optional)</label>
                <textarea
                  className="input textarea"
                  value={stageForm.systemPrompt ?? ''}
                  onChange={e => updateStage(activeTab, 'systemPrompt', e.target.value || null)}
                  rows={4}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Default model (optional)</label>
                <input
                  className="input"
                  value={stageForm.defaultModel ?? ''}
                  onChange={e => updateStage(activeTab, 'defaultModel', e.target.value || null)}
                  placeholder="minimax"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
