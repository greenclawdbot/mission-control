import { useState, useEffect, useCallback } from 'react';
import { Task, TaskStatus, TASK_STATUSES, PRIORITIES, ExecutionState, TaskStateLog, TaskConversationMessage, TaskPlanningMessage } from '../shared-types';
import { api } from '../api/client';
import { marked } from 'marked';

export interface TaskInspectorContentProps {
  task: Task;
  onClose: () => void;
  onUpdate: (task: Task) => void;
  onDelete: (taskId: string) => void;
  /** Project name for the panel header (e.g. from KanbanPage). */
  projectName?: string | null;
  /** Project color for the panel header (hex or CSS variable). */
  projectColor?: string | null;
}

interface BotRun {
  id: string;
  taskId: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  summary?: string;
  attemptNumber: number;
  parentRunId?: string;
}

export function TaskInspectorContent({ task: initialTask, onClose, onUpdate, onDelete, projectName, projectColor }: TaskInspectorContentProps) {
  const [task, setTask] = useState(initialTask);
  const [activeTab, setActiveTab] = useState<'details' | 'plan' | 'conversation' | 'planning' | 'results' | 'runs' | 'activity' | 'state'>('details');
  
  // Sync local state when initialTask changes (e.g., clicking different card or task updated via SSE)
  useEffect(() => {
    setTask(initialTask);
  }, [initialTask.id, initialTask.updatedAt]);
  const [editing, setEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [auditEvents, setAuditEvents] = useState<unknown[]>([]);
  const [botRuns, setBotRuns] = useState<BotRun[]>([]);
  const [stateLogs, setStateLogs] = useState<TaskStateLog[]>([]);
  const [editForm, setEditForm] = useState({
    title: task.title,
    description: task.description || '',
    status: task.status,
    executionState: task.executionState,
    priority: task.priority,
    assignee: task.assignee || '',
    needsApproval: task.needsApproval
  });
  
  // Conversation feed and additional context (Review)
  const [conversationMessages, setConversationMessages] = useState<TaskConversationMessage[]>([]);
  const [additionalContext, setAdditionalContext] = useState('');
  // Planning conversation (separate thread)
  const [planningMessages, setPlanningMessages] = useState<TaskPlanningMessage[]>([]);
  const [planningContext, setPlanningContext] = useState('');

  // ESC close only
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [taskRes, eventsRes, runsRes, stateLogsRes, conversationRes, planningRes] = await Promise.all([
          api.getTask(task.id),
          api.getTaskEvents(task.id),
          fetch(`/api/v1/tasks/${task.id}/runs`).then(r => r.json()).catch(() => ({ runs: [] })),
          api.getTaskStateLogs(task.id),
          api.getTaskConversation(task.id),
          api.getTaskPlanningConversation(task.id)
        ]);
        setTask(taskRes.task);
        setAuditEvents(eventsRes.events || []);
        setBotRuns(((runsRes as { runs?: BotRun[] }).runs) || []);
        setStateLogs(stateLogsRes.logs || []);
        setConversationMessages(conversationRes.messages);
        setPlanningMessages(planningRes.messages);
      } catch (error) {
        console.error('Failed to fetch task data:', error);
      }
    };
    fetchData();
  }, [task.id]);

  // When task is updated from parent (e.g. SSE task:updated), refetch planning conversation so Planning tab shows new assistant message
  useEffect(() => {
    if (!task.id) return;
    let cancelled = false;
    api.getTaskPlanningConversation(task.id).then((res) => {
      if (!cancelled) setPlanningMessages(res.messages);
    });
    return () => { cancelled = true; };
  }, [task.id, task.updatedAt]);

  const optimisticUpdate = useCallback((updates: Partial<Task>) => {
    setTask(prev => prev ? { ...prev, ...updates } : prev);
  }, []);

  const handleApprove = async () => {
    optimisticUpdate({ needsApproval: false, approvedAt: new Date().toISOString(), approvedBy: 'human' });
    try {
      const response = await api.updateTask(task.id, {
        needsApproval: false,
        approvedAt: new Date().toISOString(),
        approvedBy: 'human'
      });
      setTask(response.task);
      onUpdate(response.task);
    } catch (error) {
      console.error('Failed to approve task:', error);
      const taskRes = await api.getTask(task.id);
      setTask(taskRes.task);
    }
  };

  const handleExecutionStateChange = async (newState: ExecutionState) => {
    optimisticUpdate({ executionState: newState });
    try {
      const response = await api.updateTaskExecution(task.id, newState);
      setTask(response.task);
      onUpdate(response.task);
    } catch (error) {
      console.error('Failed to update execution state:', error);
      const taskRes = await api.getTask(task.id);
      setTask(taskRes.task);
    }
  };

  const handleRetry = async () => {
    optimisticUpdate({ executionState: 'queued' });
    try {
      await fetch(`/api/v1/tasks/${task.id}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          attemptNumber: (botRuns.length || 0) + 1,
          parentRunId: botRuns[0]?.id || null 
        })
      });
      const runsRes = await fetch(`/api/v1/tasks/${task.id}/runs`).then(r => r.json());
      setBotRuns(((runsRes as { runs?: BotRun[] }).runs) || []);
      const taskRes = await api.getTask(task.id);
      setTask(taskRes.task);
      onUpdate(taskRes.task);
    } catch (error) {
      console.error('Failed to retry task:', error);
      const taskRes = await api.getTask(task.id);
      setTask(taskRes.task);
    }
  };

  const handleCancel = async () => {
    optimisticUpdate({ executionState: 'failed' });
    try {
      const response = await api.updateTaskExecution(task.id, 'failed');
      setTask(response.task);
      onUpdate(response.task);
    } catch (error) {
      console.error('Failed to cancel task:', error);
      const taskRes = await api.getTask(task.id);
      setTask(taskRes.task);
    }
  };

  const handleStatusChange = async (status: TaskStatus) => {
    optimisticUpdate({ status });
    try {
      if (task.status === 'Review' && additionalContext.trim()) {
        const { message } = await api.appendTaskConversationMessage(task.id, additionalContext.trim());
        setConversationMessages(prev => [...prev, message]);
        setAdditionalContext('');
      }
      const response = await api.updateTask(task.id, { status });
      setTask(response.task);
      onUpdate(response.task);
      if (task.status === 'Review') setAdditionalContext('');
    } catch (error) {
      console.error('Failed to update status:', error);
      const taskRes = await api.getTask(task.id);
      setTask(taskRes.task);
    }
  };

  const handleSubmitContext = async () => {
    if (!additionalContext.trim()) return;
    const content = additionalContext.trim();
    try {
      const { message } = await api.appendTaskConversationMessage(task.id, content);
      setConversationMessages(prev => [...prev, message]);
      setAdditionalContext('');
    } catch (error) {
      console.error('Failed to save context:', error);
    }
  };

  const handleSubmitPlanningContext = async () => {
    if (!planningContext.trim()) return;
    const content = planningContext.trim();
    try {
      const { message } = await api.appendTaskPlanningConversationMessage(task.id, content);
      setPlanningMessages(prev => [...prev, message]);
      setPlanningContext('');
      if (task.status !== 'Planning') {
        const { task: updatedTask } = await api.getTask(task.id);
        setTask(updatedTask);
        onUpdate(updatedTask);
      }
    } catch (error) {
      console.error('Failed to save planning message:', error);
    }
  };

  const handleSave = async () => {
    try {
      const response = await api.updateTask(task.id, editForm);
      setTask(response.task);
      onUpdate(response.task);
      setEditing(false);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDelete = async () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setShowDeleteModal(false);
    try {
      await api.deleteTask(task.id);
      onDelete(task.id);
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleChecklistStep = async (index: number) => {
    const newIndex = index === task.currentStepIndex ? index + 1 : index;
    try {
      const response = await api.updateTask(task.id, { currentStepIndex: newIndex });
      setTask(response.task);
      onUpdate(response.task);
    } catch (error) {
      console.error('Failed to update checklist:', error);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return 'never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const formatDuration = (seconds: number | undefined | null): string => {
    if (seconds == null || seconds < 0) return '—';
    const m = Math.floor(seconds / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    const s = Math.floor(seconds % 60);
    const min = m % 60;
    if (d > 0) return `${d}d ${h % 24}h`;
    if (h > 0) return `${h}h ${min}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const renderMarkdown = (text?: string) => {
    if (!text) return null;
    return <div className="markdown-content" dangerouslySetInnerHTML={{ __html: marked(text) }} />;
  };

  const showProjectHeader = projectName != null;

  return (
    <div className="task-inspector-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Project panel header (same style as Kanban card project strip) */}
      {showProjectHeader && (
        <div
          className="task-inspector-project-header"
          style={{
            padding: '8px 20px',
            fontSize: '13px',
            fontWeight: 600,
            color: projectColor ? 'rgba(255,255,255,0.95)' : 'var(--text-primary)',
            background: projectColor ?? 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0
          }}
        >
          {projectName}
        </div>
      )}
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexShrink: 0
      }}>
        <div style={{ flex: 1 }}>
          {editing ? (
            <input
              className="input"
              value={editForm.title}
              onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
              style={{ fontSize: '18px', fontWeight: 600 }}
            />
          ) : (
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{task.title}</h2>
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`priority-badge priority-${task.priority.toLowerCase()}`}>
              {task.priority}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              #{task.id.slice(0, 8)}
            </span>
            {task.assignee === 'clawdbot' && (
              <span style={{ color: 'var(--accent-purple)', fontSize: '13px' }}>
                🤖 Bot
              </span>
            )}
          </div>
        </div>
        <button 
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px 8px'
          }}
        >
          ✕
        </button>
      </div>

      {/* Control Bar */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        alignItems: 'center',
        background: 'var(--bg-secondary)',
        flexShrink: 0
      }}>
        {task.needsApproval ? (
          <button 
            className="btn btn-primary btn-sm"
            onClick={handleApprove}
            title="Approve this task to proceed"
          >
            ✅ Approve
          </button>
        ) : (
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {task.approvedAt ? `Approved by ${task.approvedBy}` : 'No approval needed'}
          </span>
        )}

        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 4px' }} />

        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>State:</span>
        {task.executionState === 'running' && (
          <button className="btn btn-sm" onClick={() => handleExecutionStateChange('waiting')}>
            ⏸️ Pause
          </button>
        )}
        {task.executionState === 'waiting' && (
          <button className="btn btn-sm" onClick={() => handleExecutionStateChange('running')}>
            ▶️ Resume
          </button>
        )}
        {task.executionState === 'failed' && (
          <button className="btn btn-sm" onClick={handleRetry}>
            🔄 Retry
          </button>
        )}
        {['queued', 'idle', 'completed', 'waiting'].includes(task.executionState) && task.executionState !== 'completed' && (
          <button 
            className="btn btn-sm" 
            onClick={handleCancel}
            style={{ color: 'var(--accent-red)' }}
          >
            ❌ Cancel
          </button>
        )}
        {task.executionState === 'completed' && (
          <span style={{ fontSize: '11px', color: 'var(--accent-green)' }}>
            ✅ Completed
          </span>
        )}

        {/* Quick Move to Ready - Touch-friendly alternative to drag-drop */}
        {task.status !== 'Ready' && (
          <>
            <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 4px' }} />
            <button 
              className="btn btn-sm"
              onClick={() => handleStatusChange('Ready')}
              title="Move to Ready (touch-friendly)"
              style={{
                background: 'var(--accent-blue)',
                color: 'white',
                borderColor: 'var(--accent-blue)'
              }}
            >
              📋 Move to Ready
            </button>
          </>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        padding: '0 20px',
        flexShrink: 0
      }}>
        {(['details', 'plan', 'conversation', 'planning', 'results', 'runs', 'activity', 'state'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab ? '2px solid var(--accent-blue)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '14px',
              textTransform: 'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '20px' }}>
        {activeTab === 'details' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Execution State Info */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                EXECUTION STATE
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                background: 'var(--bg-secondary)',
                borderRadius: '6px'
              }}>
                <span style={{
                  color: {
                    queued: 'var(--text-secondary)',
                    running: 'var(--accent-green)',
                    waiting: 'var(--accent-orange)',
                    idle: 'var(--accent-orange)',
                    failed: 'var(--accent-red)',
                    completed: 'var(--accent-blue)'
                  }[task.executionState] || 'var(--text-secondary)',
                  fontWeight: 600
                }}>
                  {{
                    queued: '⏳ Queued',
                    running: '🔄 Running',
                    waiting: '⏸️ Waiting',
                    idle: '💤 Idle',
                    failed: '❌ Failed',
                    completed: '✅ Completed'
                  }[task.executionState] || task.executionState}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Last action: {formatRelativeTime(task.lastActionAt)} • Heartbeat: {formatRelativeTime(task.lastHeartbeatAt)}
              </div>
            </div>

            {/* Status */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                STATUS
              </label>
              <select
                className="input select"
                value={task.status}
                onChange={e => handleStatusChange(e.target.value as TaskStatus)}
                style={{ width: '100%' }}
              >
                {TASK_STATUSES.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {/* Assignee & Priority Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  ASSIGNEE
                </label>
                {editing ? (
                  <input
                    className="input"
                    value={editForm.assignee}
                    onChange={e => setEditForm(f => ({ ...f, assignee: e.target.value }))}
                    placeholder="human or clawdbot"
                  />
                ) : (
                  <span>{task.assignee || '-'}</span>
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  PRIORITY
                </label>
                {editing ? (
                  <select
                    className="input select"
                    value={editForm.priority}
                    onChange={e => setEditForm(f => ({ ...f, priority: e.target.value as typeof PRIORITIES[number] }))}
                  >
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                ) : (
                  <span className={`priority-badge priority-${task.priority.toLowerCase()}`}>
                    {task.priority}
                  </span>
                )}
              </div>
            </div>

            {/* Approval Required Banner */}
            {task.needsApproval && (
              <div style={{
                background: 'rgba(210, 153, 34, 0.1)',
                border: '1px solid var(--accent-orange)',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>⚠️ Approval Required</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    This task requires human approval before the bot can proceed.
                  </div>
                </div>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={handleApprove}
                >
                  Approve
                </button>
              </div>
            )}

            {/* Description */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                DESCRIPTION
              </label>
              {editing ? (
                <textarea
                  className="input textarea"
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                />
              ) : (
                <div className="markdown-content">
                  {task.description ? renderMarkdown(task.description) : (
                    <span style={{ color: 'var(--text-secondary)' }}>No description</span>
                  )}
                </div>
              )}
            </div>

            {/* Tags */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                TAGS
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {task.tags.length === 0 ? (
                  <span style={{ color: 'var(--text-secondary)' }}>No tags</span>
                ) : (
                  task.tags.map(tag => (
                    <span key={tag} style={{
                      background: 'var(--bg-tertiary)',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '13px'
                    }}>
                      {tag}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Dependencies */}
            {task.blockedBy.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  BLOCKED BY ({task.blockedBy.length})
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {task.blockedBy.map(depId => (
                    <div key={depId} style={{
                      background: 'var(--bg-secondary)',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      fontSize: '13px'
                    }}>
                      🔒 {depId.slice(0, 8)}...
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dates */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '16px',
              fontSize: '13px',
              color: 'var(--text-secondary)'
            }}>
              <div>Created: {formatDate(task.createdAt)}</div>
              <div>Updated: {formatDate(task.updatedAt)}</div>
              {task.startedAt && <div>Started: {formatDate(task.startedAt)}</div>}
              {task.completedAt && <div>Completed: {formatDate(task.completedAt)}</div>}
              {task.approvedAt && <div>Approved: {formatDate(task.approvedAt)}</div>}
            </div>
          </div>
        )}

        {activeTab === 'plan' && (
          <div>
            {task.planDocument && task.planDocument.trim() ? (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  CURRENT PLAN
                </label>
                <div
                  className="markdown-content"
                  style={{
                    background: 'var(--bg-secondary)',
                    padding: '16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    borderLeft: '3px solid var(--accent-blue)'
                  }}
                  dangerouslySetInnerHTML={{ __html: marked.parse(task.planDocument) }}
                />
              </div>
            ) : (
              <div className="empty-state" style={{ marginBottom: '20px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  No plan yet. The plan will appear here when the planner bot completes and sends the plan via <strong>POST /tasks/:id/planning-complete</strong> with a <code>plan</code> field in the body.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px' }}>
                  If the task was moved to Backlog but no plan appears, the agent may have called planning-complete without including the <code>plan</code> payload.
                </p>
              </div>
            )}
            {/* Progress Overview */}
            <div style={{
              background: 'var(--bg-secondary)',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px' }}>Progress</span>
                <span style={{ fontSize: '14px', color: 'var(--accent-purple)' }}>
                  {task.planChecklist.length > 0 
                    ? Math.round(((task.currentStepIndex) / task.planChecklist.length) * 100)
                    : 0}%
                </span>
              </div>
              <div style={{
                height: '6px',
                background: 'var(--bg-tertiary)',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${task.planChecklist.length > 0 ? ((task.currentStepIndex) / task.planChecklist.length) * 100 : 0}%`,
                  background: 'var(--accent-purple)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>

            {/* Checklist */}
            {task.planChecklist.length === 0 ? (
              <div className="empty-state">
                <p>No plan checklist defined</p>
              </div>
            ) : (
              <div>
                {task.planChecklist.map((step, index) => (
                  <div 
                    key={index}
                    className={`checklist-item ${index < task.currentStepIndex ? 'completed' : ''}`}
                    onClick={() => handleChecklistStep(index)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className={`checklist-checkbox ${index < task.currentStepIndex ? 'checked' : ''}`}>
                      {index < task.currentStepIndex && '✓'}
                    </div>
                    <span className="checklist-text">{step}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Progress Log */}
            {task.progressLog.length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <h4 style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  PROGRESS LOG
                </h4>
                {task.progressLog.map((entry) => (
                  <div key={entry.id} className="progress-log-item">
                    <div style={{ fontSize: '13px' }}>
                      <span style={{
                        background: entry.status === 'done' ? 'var(--accent-green)' : 
                                   entry.status === 'failed' ? 'var(--accent-red)' : 'var(--accent-orange)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        marginRight: '8px'
                      }}>
                        {entry.status.toUpperCase()}
                      </span>
                      {entry.step}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {formatDate(entry.completedAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'conversation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Chronological conversation (user context and bot results). Add context below to continue the thread.
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              paddingBottom: '200px'
            }}>
              {conversationMessages.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '24px',
                  color: 'var(--text-secondary)',
                  fontSize: '13px'
                }}>
                  No messages yet. Add context below or run the task to start the conversation.
                </div>
              ) : (
                conversationMessages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      background: msg.role === 'assistant' ? 'rgba(88, 166, 255, 0.08)' : 'var(--bg-tertiary)',
                      padding: '12px',
                      borderRadius: '8px',
                      borderLeft: msg.role === 'assistant' ? '3px solid var(--accent-blue)' : '3px solid var(--accent-orange)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{
                        background: msg.role === 'assistant' ? 'var(--accent-blue)' : 'var(--accent-orange)',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 600
                      }}>
                        {msg.role === 'assistant' ? '🤖 Clawdbot' : '👤 You'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {formatDate(msg.createdAt)}
                      </span>
                    </div>
                    <div className={msg.role === 'assistant' ? 'markdown-content' : ''} style={{ fontSize: '13px' }}>
                      {msg.role === 'assistant' ? (
                        <div dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }} />
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div style={{
              position: 'sticky',
              bottom: 0,
              background: 'var(--bg-primary)',
              padding: '12px 0',
              borderTop: '1px solid var(--border-color)'
            }}>
              <textarea
                className="input textarea"
                value={additionalContext}
                onChange={e => setAdditionalContext(e.target.value)}
                placeholder="Enter new context, feedback, or instructions..."
                rows={3}
                style={{
                  width: '100%',
                  borderColor: 'var(--accent-orange)',
                  background: 'rgba(210, 153, 34, 0.05)'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {additionalContext.length} characters
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {task.status === 'Review' && (
                    <>
                      <button
                        className="btn btn-sm"
                        onClick={() => handleStatusChange('Backlog')}
                        title="Move back to Backlog"
                        style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}
                      >
                        📥 Backlog
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => handleStatusChange('Ready')}
                        title="Move to Ready for bot to reprocess"
                        style={{ background: 'var(--accent-green)', color: 'white', borderColor: 'var(--accent-green)' }}
                      >
                        📋 Ready
                      </button>
                    </>
                  )}
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSubmitContext}
                    disabled={!additionalContext.trim()}
                    title="Add context to feed (without changing status)"
                  >
                    ➕ Add Context
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'planning' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Planning conversation: add feedback for the planner. The plan will appear here as the assistant message. If the task is not in Planning, submitting will queue it for the planner.
            </div>
            <div style={{
              background: 'var(--bg-secondary)',
              padding: '16px',
              borderRadius: '8px',
              borderLeft: '3px solid var(--border-color)'
            }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Task (initial description)
              </label>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>{task.title}</div>
              {task.description && task.description.trim() ? (
                <div
                  className="markdown-content"
                  style={{ fontSize: '13px', color: 'var(--text-primary)' }}
                  dangerouslySetInnerHTML={{ __html: marked.parse(task.description) }}
                />
              ) : (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No description</div>
              )}
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              paddingBottom: '200px'
            }}>
              {planningMessages.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '24px',
                  color: 'var(--text-secondary)',
                  fontSize: '13px'
                }}>
                  No planning messages yet. Add feedback below to queue this task for the planner.
                </div>
              ) : (
                planningMessages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      background: msg.role === 'assistant' ? 'rgba(88, 166, 255, 0.08)' : 'var(--bg-tertiary)',
                      padding: '12px',
                      borderRadius: '8px',
                      borderLeft: msg.role === 'assistant' ? '3px solid var(--accent-blue)' : '3px solid var(--accent-orange)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{
                        background: msg.role === 'assistant' ? 'var(--accent-blue)' : 'var(--accent-orange)',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 600
                      }}>
                        {msg.role === 'assistant' ? '🤖 Planner' : '👤 You'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {formatDate(msg.createdAt)}
                      </span>
                    </div>
                    <div className={msg.role === 'assistant' ? 'markdown-content' : ''} style={{ fontSize: '13px' }}>
                      {msg.role === 'assistant' ? (
                        <div dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }} />
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div style={{
              position: 'sticky',
              bottom: 0,
              background: 'var(--bg-primary)',
              padding: '12px 0',
              borderTop: '1px solid var(--border-color)'
            }}>
              <textarea
                className="input textarea"
                value={planningContext}
                onChange={e => setPlanningContext(e.target.value)}
                placeholder="Enter planning feedback or instructions..."
                rows={3}
                style={{
                  width: '100%',
                  borderColor: 'var(--accent-orange)',
                  background: 'rgba(210, 153, 34, 0.05)'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSubmitPlanningContext}
                  disabled={!planningContext.trim()}
                  title="Add to planning conversation (queues task for planner if not in Planning)"
                >
                  ➕ Add to planning
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Work Results (assistant messages from conversation) */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                WORK RESULTS
              </label>
              {(() => {
                const assistantMessages = conversationMessages.filter(m => m.role === 'assistant');
                if (assistantMessages.length === 0) {
                  return (
                    <div style={{
                      background: 'var(--bg-secondary)',
                      padding: '24px',
                      borderRadius: '8px',
                      textAlign: 'center',
                      color: 'var(--text-secondary)'
                    }}>
                      No results recorded yet. Results are added when work is completed.
                    </div>
                  );
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {assistantMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="markdown-content"
                        style={{
                          background: 'var(--bg-secondary)',
                          padding: '16px',
                          borderRadius: '8px'
                        }}
                      >
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          {formatDate(msg.createdAt)}
                        </div>
                        <div dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }} />
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Git Commits */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                GIT COMMITS ({task.commits?.length || 0})
              </label>
              {task.commits && task.commits.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {task.commits.map((commit, index) => (
                    <div key={index} style={{
                      background: 'var(--bg-secondary)',
                      padding: '12px',
                      borderRadius: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{
                          background: 'var(--accent-green)',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontFamily: 'monospace'
                        }}>
                          {commit.sha.slice(0, 7)}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {formatDate(commit.timestamp)}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', marginBottom: '6px' }}>
                        {commit.message}
                      </div>
                      {commit.url && (
                        <a 
                          href={commit.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ fontSize: '12px', color: 'var(--accent-blue)' }}
                        >
                          View on GitHub →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  background: 'var(--bg-secondary)',
                  padding: '24px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  color: 'var(--text-secondary)'
                }}>
                  No commits recorded. Git commits are added when code is pushed.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'runs' && (
          <div>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '14px' }}>BOT RUNS</h4>
              {task.executionState === 'failed' && (
                <button className="btn btn-sm" onClick={handleRetry}>
                  🔄 New Retry
                </button>
              )}
            </div>
            
            {botRuns.length === 0 ? (
              <div className="empty-state">
                <p>No bot runs recorded</p>
                {task.executionState === 'failed' && (
                  <button className="btn btn-primary btn-sm" onClick={handleRetry} style={{ marginTop: '12px' }}>
                    Start Retry Run
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {botRuns.map((run) => (
                  <div key={run.id} style={{
                    background: 'var(--bg-secondary)',
                    padding: '16px',
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{
                        background: run.status === 'completed' ? 'var(--accent-green)' : 
                                   run.status === 'failed' ? 'var(--accent-red)' : 'var(--accent-orange)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px'
                      }}>
                        {run.status.toUpperCase()} • Attempt #{run.attemptNumber}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {formatDate(run.startedAt)}
                      </span>
                    </div>
                    {run.summary && (
                      <div style={{ fontSize: '13px' }}>{run.summary}</div>
                    )}
                    {run.endedAt && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Duration: {Math.round((new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px' }}>ACTIVITY LOG</h4>
            
            {auditEvents.length === 0 ? (
              <div className="empty-state">
                <p>No activity recorded</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(auditEvents as unknown[]).map((event: any) => (
                  <div key={event.id} style={{
                    padding: '12px',
                    borderLeft: '2px solid var(--border-color)',
                    marginLeft: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{
                        background: event.actor === 'clawdbot' ? 'rgba(163, 113, 247, 0.2)' : 'rgba(88, 166, 255, 0.2)',
                        color: event.actor === 'clawdbot' ? 'var(--accent-purple)' : 'var(--accent-blue)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 600
                      }}>
                        {event.actor === 'clawdbot' ? '🤖' : '👤'} {event.actor}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {formatDate(event.timestamp)}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>
                      {event.eventType.replace('task.', '').replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {JSON.stringify(event.after || {}, null, 2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'state' && (
          <div>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px' }}>TIME IN STATE</h4>
            {stateLogs.length === 0 ? (
              <div className="empty-state">
                <p>No state history recorded</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px 8px 0', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Entered</th>
                      <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Exited</th>
                      <th style={{ padding: '8px 0 8px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stateLogs.map((log) => {
                      const isOpen = log.exitedAt == null;
                      const liveSeconds = isOpen && log.enteredAt
                        ? Math.round((Date.now() - new Date(log.enteredAt).getTime()) / 1000)
                        : null;
                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px 12px 8px 0', fontWeight: 500 }}>{log.status}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{formatDate(log.enteredAt)}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                            {log.exitedAt ? formatDate(log.exitedAt) : 'In progress'}
                          </td>
                          <td style={{ padding: '8px 0 8px 12px', fontFamily: 'monospace' }}>
                            {isOpen && liveSeconds != null ? formatDuration(liveSeconds) : formatDuration(log.duration ?? undefined)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 600 }}>
                      <td style={{ padding: '12px 12px 12px 0' }}>Total</td>
                      <td style={{ padding: '12px 12px', color: 'var(--text-secondary)' }}>—</td>
                      <td style={{ padding: '12px 12px', color: 'var(--text-secondary)' }}>—</td>
                      <td style={{ padding: '12px 0 12px 12px', fontFamily: 'monospace' }}>
                        {formatDuration(
                          stateLogs.reduce((acc, log) => {
                            if (log.exitedAt != null && log.duration != null) return acc + log.duration;
                            if (log.exitedAt == null && log.enteredAt)
                              return acc + Math.round((Date.now() - new Date(log.enteredAt).getTime()) / 1000);
                            return acc;
                          }, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end',
        flexShrink: 0
      }}>
        {editing ? (
          <>
            <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save</button>
          </>
        ) : (
          <>
            <button className="btn" onClick={() => setEditing(true)}>Edit</button>
            <button 
              className="btn" 
              onClick={handleDelete}
              style={{ color: 'var(--accent-red)' }}
            >
              Delete
            </button>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <>
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={() => setShowDeleteModal(false)}
          />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '24px',
            zIndex: 101,
            width: '400px',
            maxWidth: '90vw',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>Delete Task?</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Are you sure you want to delete "{task.title}"? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button 
                className="btn" 
                onClick={confirmDelete}
                style={{ background: 'var(--accent-red)', color: 'white', borderColor: 'var(--accent-red)' }}
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
