import { Task } from '../shared-types';

interface SummaryBarProps {
  tasks: Task[];
}

export function SummaryBar({ tasks }: SummaryBarProps) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const tasksThisWeek = tasks.filter(t => new Date(t.createdAt) >= weekAgo).length;
  const inProgress = tasks.filter(t => t.status === 'InProgress').length;
  const completed = tasks.filter(t => t.status === 'Done').length;
  const total = tasks.length;
  const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  // New observability metrics
  const runningBots = tasks.filter(t => t.executionState === 'running' && t.assignee === 'clawdbot').length;
  const idleTasks = tasks.filter(t => t.executionState === 'idle').length;
  const blockedTasks = tasks.filter(t => t.status === 'Blocked' || t.blockedBy.length > 0).length;

  const stats = [
    { label: 'This Week', value: tasksThisWeek },
    { label: 'In Progress', value: inProgress, color: 'var(--accent-purple)' },
    { label: 'Running Bots', value: runningBots, color: 'var(--accent-green)' },
    { label: 'Idle Tasks', value: idleTasks, color: 'var(--accent-orange)' },
    { label: 'Total', value: total },
    { label: 'Done', value: `${completionPercent}%`, color: 'var(--accent-green)' }
  ];

  return (
    <div style={{
      padding: '16px 24px',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      gap: '48px',
      background: 'var(--bg-secondary)'
    }}>
      {stats.map(stat => (
        <div key={stat.label}>
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 600,
            color: stat.color || 'var(--text-primary)'
          }}>
            {stat.value}
          </div>
          <div style={{ 
            fontSize: '12px', 
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}
