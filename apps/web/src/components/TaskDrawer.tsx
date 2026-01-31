import { useState, useEffect, useCallback } from 'react';
import { Task, TaskStatus, TASK_STATUSES, PRIORITIES, ExecutionState } from '../shared-types';
import { api } from '../api/client';
import { marked } from 'marked';

interface TaskDrawerProps {
  task: Task;
  onClose: () => void;
  onUpdate: (task: Task) => void;
  onDelete: (taskId: string) => void;
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

export function TaskDrawer({ task: initialTask, onClose, onUpdate, onDelete }: TaskDrawerProps) {
  const [task, setTask] = useState(initialTask);
  const [activeTab, setActiveTab] = useState<'details' | 'plan' | 'results' | 'runs' | 'activity'>('details');
  const [editing, setEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [auditEvents, setAuditEvents] = useState<unknown[]>([]);
  const [botRuns, setBotRuns] = useState<BotRun[]>([]);
  const [editForm, setEditForm] = useState({
    title: task.title,
    description: task.description || '',
    status: task.status,
    executionState: task.executionState,
    priority: task.priority,
    assignee: task.assignee || '',
    needsApproval: task.needsApproval
  });

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
        const [taskRes, eventsRes, runsRes] = await Promise.all([
          api.getTask(task.id),
          api.getTaskEvents(task.id),
          fetch(`/api/v1/tasks/${task.id}/runs`).then(r => r.json()).catch(() => ({ runs: [] }))
        ]);
        setTask(taskRes.task);
        setAuditEvents(eventsRes.events || []);
        setBotRuns(((runsRes as { runs?: BotRun[] }).runs) || []);
      } catch (error) {
        console.error('Failed to fetch task data:', error);
      }
    };
    fetchData();
  }, [task.id]);

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
      const response = await api.updateTask(task.id, { status });
      setTask(response.task);
      onUpdate(response.task);
    } catch (error) {
      console.error('Failed to update status:', error);
      const taskRes = await api.getTask(task.id);
      setTask(taskRes.task);
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

  const renderMarkdown = (text?: string) => {
    if (!text) return null;
    return <div className="markdown-content" dangerouslySetInnerHTML={{ __html: marked(text) }} />;
  };

  return (
    <aside className="task-inspector" aria-label="Task Inspector">
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
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
        background: 'var(--bg-secondary)'
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
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        padding: '0 20px'
      }}>
        {(['details', 'plan', 'results', 'runs', 'activity'] as const).map(tab => (
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
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
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

        {activeTab === 'results' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Work Results */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                WORK RESULTS
              </label>
              {task.results ? (
                <div 
                  className="markdown-content"
                  style={{
                    background: 'var(--bg-secondary)',
                    padding: '16px',
                    borderRadius: '8px'
                  }}
                  dangerouslySetInnerHTML={{ __html: marked.parse(task.results) }}
                />
              ) : (
                <div style={{
                  background: 'var(--bg-secondary)',
                  padding: '24px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  color: 'var(--text-secondary)'
                }}>
                  No results recorded yet. Results are added when work is completed.
                </div>
              )}
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
      </div>

      {/* Footer Actions */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end'
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
    </aside>
  );
}
