import { useState, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Task } from '../shared-types';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  isSelected?: boolean;
  isAnimating?: boolean;
  isSystemUpdated?: boolean;
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

  const executionStateColors: Record<string, string> = {
    queued: 'var(--text-secondary)',
    running: 'var(--accent-green)',
    waiting: 'var(--accent-orange)',
    idle: 'var(--accent-orange)',
    failed: 'var(--accent-red)',
    completed: 'var(--accent-blue)'
  };

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${task.assignee === 'clawdbot' ? 'bot-assigned' : ''} ${task.status === 'Blocked' ? 'blocked' : ''} ${isIdleTooLong ? 'idle-too-long' : ''} ${isSelected ? 'selected' : ''} ${isAnimating ? 'status-changed' : ''} ${isSystemUpdated ? 'system-updated' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onClick={(e) => {
        // Double-click to open drawer
        if (e.detail === 2) {
          e.stopPropagation();
          onClick();
        }
      }}
      data-task-id={task.id}
    >
      {/* Debug indicator for selected task */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: -20,
          left: 0,
          right: 0,
          fontSize: '10px',
          color: 'var(--accent-blue)',
          background: 'rgba(88, 166, 255, 0.1)',
          padding: '2px 4px',
          borderRadius: '2px'
        }}>
          Selected: {task.id.slice(0, 8)}...
        </div>
      )}

      {/* Drag handle - only this area is draggable */}
      <div 
        className="drag-handle"
        {...listeners}
        {...attributes}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '8px',
          cursor: 'grab',
          padding: '2px',
          margin: '-2px -2px 8px -2px',
          borderRadius: '4px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 500, flex: 1 }}>
          {task.title}
        </h3>
        {task.assignee === 'clawdbot' && (
          <span style={{
            fontSize: '10px',
            background: 'rgba(163, 113, 247, 0.2)',
            color: 'var(--accent-purple)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: 600,
            marginLeft: '8px',
            flexShrink: 0
          }}>
            🤖 BOT
          </span>
        )}
      </div>

      {task.description && (
        <p style={{ 
          margin: '0 0 8px 0', 
          fontSize: '12px', 
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {task.description}
        </p>
      )}

      {/* Execution State Indicator */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        marginBottom: '8px',
        fontSize: '11px'
      }}>
        <span style={{ color: executionStateColors[task.executionState] || 'var(--text-secondary)' }}>
          {executionStateIcons[task.executionState]} {task.executionState}
        </span>
        {task.needsApproval && (
          <span style={{
            background: 'rgba(210, 153, 34, 0.2)',
            color: 'var(--accent-orange)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px'
          }}>
            ⚠️ Needs Approval
          </span>
        )}
      </div>

      {/* Idle warning with tooltip */}
      {isIdleTooLong && (
        <div style={{ 
          fontSize: '11px', 
          color: 'var(--accent-red)',
          marginBottom: '8px'
        }}>
          ⚠️ Idle too long
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className={`priority-badge ${priorityClass}`}>
          {task.priority}
        </span>
        
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {task.tags.slice(0, 2).map(tag => (
            <span key={tag} style={{
              fontSize: '10px',
              background: 'var(--bg-primary)',
              padding: '2px 6px',
              borderRadius: '4px',
              color: 'var(--text-secondary)'
            }}>
              {tag}
            </span>
          ))}
          {task.tags.length > 2 && (
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              +{task.tags.length - 2}
            </span>
          )}
        </div>
      </div>

      {/* Plan progress */}
      {task.status === 'InProgress' && task.planChecklist.length > 0 && (
        <div style={{ 
          marginTop: '8px', 
          fontSize: '11px', 
          color: 'var(--accent-purple)' 
        }}>
          Step {task.currentStepIndex + 1} of {task.planChecklist.length}
        </div>
      )}

      {/* Blocked by */}
      {task.blockedBy.length > 0 && (
        <div style={{ 
          marginTop: '8px', 
          fontSize: '11px', 
          color: 'var(--accent-red)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          🔒 Blocked by {task.blockedBy.length} task(s)
        </div>
      )}

      {/* Blocked reason (legacy) */}
      {task.status === 'Blocked' && task.blockedReason && !task.blockedBy.length && (
        <div style={{ 
          marginTop: '8px', 
          fontSize: '11px', 
          color: 'var(--accent-red)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          ⚠️ {task.blockedReason}
        </div>
      )}
    </div>
  );
}
