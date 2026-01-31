import { useState, useEffect, useRef } from 'react';
import { Task } from '../shared-types';

interface SummaryBarProps {
  tasks: Task[];
  nextCheck: Date | null;
}

// Countdown timer component with adaptive average
function CountdownTimer({ targetDate }: { targetDate: Date | null }) {
  const [timeLeft, setTimeLeft] = useState<string>('--:--');
  const [avgInterval, setAvgInterval] = useState<number | null>(null);
  const pollTimestamps = useRef<number[]>([]);

  useEffect(() => {
    // Load historical poll timestamps from localStorage
    const stored = localStorage.getItem('pollTimestamps');
    if (stored) {
      try {
        pollTimestamps.current = JSON.parse(stored);
      } catch (e) {}
    }

    // Track when we receive a new targetDate (happens on each poll)
    if (targetDate) {
      const now = Date.now();
      pollTimestamps.current.push(now);
      
      // Keep only last 10 poll timestamps
      if (pollTimestamps.current.length > 10) {
        pollTimestamps.current.shift();
      }
      
      // Calculate average interval
      if (pollTimestamps.current.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < pollTimestamps.current.length; i++) {
          intervals.push(pollTimestamps.current[i] - pollTimestamps.current[i-1]);
        }
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        setAvgInterval(Math.round(avg / 1000)); // Convert to seconds
      }
      
      // Persist to localStorage
      localStorage.setItem('pollTimestamps', JSON.stringify(pollTimestamps.current));
    }
  }, [targetDate?.toISOString()]);

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

  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
      <span>{timeLeft}</span>
      {avgInterval && (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          (avg: {avgInterval}s)
        </span>
      )}
    </div>
  );
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
          
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Done
        </div>
      </div>
      <div>
        <div style={{ 
            fontSize: '24px', 
            fontWeight: 600,
            color: 'var(--text-secondary)'
          }}>
            <CountdownTimer targetDate={nextCheck} />
          </div>
          <div style={{ 
          fontSize: '12px', 
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Next check
        </div></div>
    </div>
  );
}
