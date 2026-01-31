import { useState, useRef, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Task } from '../shared-types';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  isSelected?: boolean;
  isAnimating?: boolean;
  isSystemUpdated?: boolean;
}

// Utility function to format elapsed time
function formatElapsedTime(startTime?: string): string {
  if (!startTime) return '-';

  const start = new Date(startTime).getTime();
  const now = Date.now();
  const elapsed = now - start;

  if (elapsed < 0) return '-';

  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Component for the timer badge
function StateTimerBadge({ task }: { task: Task }) {
  const [elapsed, setElapsed] = useState<string>('');

  useEffect(() => {
    // Initial calculation
    setElapsed(formatElapsedTime(task.currentStateStartedAt));

    // Update every second
    const interval = setInterval(() => {
      setElapsed(formatElapsedTime(task.currentStateStartedAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [task.currentStateStartedAt]);

  // Only show for non-terminal states
  const isTerminalState = ['Done', 'Backlog'].includes(task.status);

  if (isTerminalState || !task.currentStateStartedAt) return null;

  return (
    <span className="state-timer-badge" title={`Started: ${new Date(task.currentStateStartedAt).toLocaleString()}`}>
      ⏱️ {task.status}: {elapsed}
    </span>
  );
}

export function TaskCard({ task, onClick, isSelected, isAnimating, isSystemUpdated }: TaskCardProps) {
  const [clickStart, setClickStart] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`
  } : undefined;

  const priorityClassMap = {
    Low: 'priority-low',
    Medium: 'priority-medium',
    High: 'priority-high',
    Critical: 'priority-critical'
  };
  const priorityClass = priorityClassMap[task.priority as keyof typeof priorityClassMap] || 'priority-medium';

  const executionStateClassMap: Record<string, string> = {
    queued: 'queued',
    running: 'running',
    waiting: 'waiting',
    idle: 'idle',
    failed: 'failed',
    completed: 'completed'
  };
  const executionStateClass = executionStateClassMap[task.executionState] || 'queued';

  const executionStateIcons: Record<string, string> = {
    queued: '⏳',
    running: '🔄',
    waiting: '⏸️',
    idle: '💤',
    failed: '❌',
    completed: '✅'
  };

  // Check if idle for too long (more than 1 hour since lastActionAt)
  const isIdleTooLong = task.executionState === 'idle' && task.lastActionAt &&
    (Date.now() - new Date(task.lastActionAt).getTime()) > 60 * 60 * 1000;

  const handlePointerDown = (e: React.PointerEvent) => {
    setClickStart({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!clickStart) return;

    const dx = Math.abs(e.clientX - clickStart.x);
    const dy = Math.abs(e.clientY - clickStart.y);
    const threshold = 5; // pixels

    // Only trigger click if movement was minimal (not a drag)
    if (dx < threshold && dy < threshold) {
      e.stopPropagation();
      onClick();
    }
    setClickStart(null);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Always handle click on the card - this ensures clicking a different card
    // updates the selection even when the sidebar is already open
    onClick();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${task.assignee === 'clawdbot' ? 'bot-assigned' : ''} ${task.status === 'Blocked' ? 'blocked' : ''} ${isIdleTooLong ? 'idle-too-long' : ''} ${isSelected ? 'selected' : ''} ${isAnimating ? 'status-changed' : ''} ${isSystemUpdated ? 'system-updated' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onClick={handleCardClick}
      data-task-id={task.id}
    >
      {/* Debug indicator for selected task */}
      {isSelected && (
        <div className="selected-debug-indicator">
          Selected: {task.id.slice(0, 8)}...
        </div>
      )}

      {/* Drag handle - only this area is draggable */}
      <div
        className="task-card-header drag-handle"
        {...listeners}
        {...attributes}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="task-card-title">
          {task.title}
        </h3>
        {task.assignee === 'clawdbot' && (
          <span className="bot-badge">
            🤖 BOT
          </span>
        )}
      </div>

      {task.description && (
        <p className="task-card-description">
          {task.description}
        </p>
      )}

      {/* Execution State Indicator */}
      <div className="task-card-meta">
        <span className={`execution-state ${executionStateClass}`}>
          {executionStateIcons[task.executionState]} {task.executionState}
        </span>
        {task.needsApproval && (
          <span className="needs-approval-badge">
            ⚠️ Needs Approval
          </span>
        )}
      </div>

      {/* State Timer Badge */}
      <StateTimerBadge task={task} />

      {/* Idle warning with tooltip */}
      {isIdleTooLong && (
        <div className="idle-warning">
          ⚠️ Idle too long
        </div>
      )}

      <div className="task-card-footer">
        <span className={`priority-badge ${priorityClass}`}>
          {task.priority}
        </span>

        <div className="task-tags">
          {task.tags.slice(0, 2).map(tag => (
            <span key={tag} className="task-tag">
              {tag}
            </span>
          ))}
          {task.tags.length > 2 && (
            <span className="task-tags-more">
              +{task.tags.length - 2}
            </span>
          )}
        </div>
      </div>

      {/* Plan progress */}
      {task.status === 'InProgress' && task.planChecklist.length > 0 && (
        <div className="plan-progress task-card-section">
          Step {task.currentStepIndex + 1} of {task.planChecklist.length}
        </div>
      )}

      {/* Blocked by */}
      {task.blockedBy.length > 0 && (
        <div className="blocked-indicator task-card-section">
          🔒 Blocked by {task.blockedBy.length} task(s)
        </div>
      )}

      {/* Blocked reason (legacy) */}
      {task.status === 'Blocked' && task.blockedReason && !task.blockedBy.length && (
        <div className="blocked-indicator task-card-section">
          ⚠️ {task.blockedReason}
        </div>
      )}
    </div>
  );
}
