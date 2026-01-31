import { useState, useEffect } from 'react';
import { Task } from '../shared-types';

interface SummaryBarProps {
  tasks: Task[];
  nextCheck: Date | null;
}

// Countdown timer component
function CountdownTimer({ targetDate }: { targetDate: Date | null }) {
  const [timeLeft, setTimeLeft] = useState<string>('--:--');

  useEffect(() => {
    if (!targetDate) {
      setTimeLeft('--:--');
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const target = targetDate.getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft('0:00');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    // Update immediately
    updateTimer();

    // Then update every second
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return <span>{timeLeft}</span>;
}

export function SummaryBar({ tasks, nextCheck }: SummaryBarProps) {
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

  return (
    <div style={{
      padding: '16px 24px',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      gap: '48px',
      background: 'var(--bg-secondary)'
    }}>
      <div>
        <div style={{ 
          fontSize: '24px', 
          fontWeight: 600,
          color: 'var(--text-secondary)'
        }}>
          {tasksThisWeek}
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          This Week
        </div>
      </div>

      <div>
        <div style={{ 
          fontSize: '24px', 
          fontWeight: 600,
          color: 'var(--accent-purple)'
        }}>
          {inProgress}
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          In Progress
        </div>
      </div>

      <div>
        <div style={{ 
          fontSize: '24px', 
          fontWeight: 600,
          color: 'var(--accent-green)'
        }}>
          {runningBots}
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Running Bots
        </div>
      </div>

      <div>
        <div style={{ 
          fontSize: '24px', 
          fontWeight: 600,
          color: 'var(--accent-orange)'
        }}>
          {idleTasks}
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Idle Tasks
        </div>
      </div>

      <div>
        <div style={{ 
          fontSize: '24px', 
          fontWeight: 600,
          color: 'var(--text-primary)'
        }}>
          {total}
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Total
        </div>
      </div>

      <div>
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 600,
            color: 'var(--accent-green)'
          }}>
            {completionPercent}%
          </div>
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 600,
            color: 'var(--text-secondary)'
          }}>
            <CountdownTimer targetDate={nextCheck} />
          </div>
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Done • Next check
        </div>
      </div>
    </div>
  );
}
