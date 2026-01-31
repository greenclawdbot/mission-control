import { useState } from 'react';
import { Task, PRIORITIES, TASK_STATUSES } from '../shared-types';
import { api } from '../api/client';

interface NewTaskModalProps {
  onClose: () => void;
  onCreated: (task: Task) => void;
}

export function NewTaskModal({ onClose, onCreated }: NewTaskModalProps) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'Medium' as typeof PRIORITIES[number],
    assignee: 'clawdbot',
    tags: '',
    estimate: ''
  });
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    setCreating(true);
    try {
      const response = await api.createTask({
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        assignee: form.assignee,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        estimate: form.estimate ? parseFloat(form.estimate) : undefined
      });
      onCreated(response.task);
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div 
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 50
        }}
      />
      
      {/* Modal */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 51,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div 
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            width: '500px',
            maxWidth: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>New Task</h2>
            <button 
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '20px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
            {/* Title */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '13px', 
                color: 'var(--text-secondary)',
                marginBottom: '8px' 
              }}>
                Title *
              </label>
              <input
                className="input"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="What needs to be done?"
                autoFocus
                required
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '13px', 
                color: 'var(--text-secondary)',
                marginBottom: '8px' 
              }}>
                Description (Markdown)
              </label>
              <textarea
                className="input textarea"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Add details..."
                style={{ minHeight: '80px' }}
              />
            </div>

            {/* Assignee Toggle & Priority Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '13px', 
                  color: 'var(--text-secondary)',
                  marginBottom: '8px' 
                }}>
                  Assign To
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`btn ${form.assignee === 'clawdbot' ? 'btn-primary' : ''}`}
                    onClick={() => setForm(f => ({ ...f, assignee: 'clawdbot' }))}
                    style={{ flex: 1 }}
                  >
                    🤖 Bot
                  </button>
                  <button
                    type="button"
                    className={`btn ${form.assignee === 'human' ? 'btn-primary' : ''}`}
                    onClick={() => setForm(f => ({ ...f, assignee: 'human' }))}
                    style={{ flex: 1 }}
                  >
                    👤 Human
                  </button>
                </div>
              </div>
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '13px', 
                  color: 'var(--text-secondary)',
                  marginBottom: '8px' 
                }}>
                  Priority
                </label>
                <select
                  className="input select"
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value as typeof PRIORITIES[number] }))}
                >
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {/* Tags & Estimate Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '13px', 
                  color: 'var(--text-secondary)',
                  marginBottom: '8px' 
                }}>
                  Tags (comma-separated)
                </label>
                <input
                  className="input"
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="feature, bug, docs"
                />
              </div>
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '13px', 
                  color: 'var(--text-secondary)',
                  marginBottom: '8px' 
                }}>
                  Estimate (hours)
                </label>
                <input
                  className="input"
                  type="number"
                  step="0.5"
                  min="0"
                  value={form.estimate}
                  onChange={e => setForm(f => ({ ...f, estimate: e.target.value }))}
                  placeholder="2"
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn" 
                onClick={onClose}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={creating || !form.title.trim()}
              >
                {creating ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
