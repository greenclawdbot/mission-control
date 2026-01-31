import { useState, useEffect, useCallback } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import { Task, TaskStatus, TASK_STATUSES } from './shared-types';
import { TaskCard } from './components/TaskCard';
import { TaskDrawer } from './components/TaskDrawer';
import { SummaryBar } from './components/SummaryBar';
import { NewTaskModal } from './components/NewTaskModal';
import { ThemeToggle } from './components/ThemeToggle';
import { api } from './api/client';
import { useSSE } from './hooks/useSSE';

// Manual override state type: undefined = use auto-behavior, true = collapsed, false = expanded
type CollapseOverride = boolean | undefined;

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [loading, setLoading] = useState(true);
  const [animatingTasks, setAnimatingTasks] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [systemUpdatedTasks, setSystemUpdatedTasks] = useState<Set<string>>(new Set());
  
  // Track manual collapse overrides for each column (undefined = auto)
  const [collapsedColumns, setCollapsedColumns] = useState<Record<TaskStatus, CollapseOverride>>(() => {
    const initial: Record<TaskStatus, CollapseOverride> = {} as Record<TaskStatus, CollapseOverride>;
    TASK_STATUSES.forEach(status => {
      initial[status] = undefined; // Start with auto behavior
    });
    return initial;
  });

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      const response = await api.getTasks();
      setTasks(response.tasks);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // SSE connection for live updates
  const handleSSEEvent = useCallback((event: { type: string; data: Task }) => {
    console.log('[App] SSE Event:', event.type, event.data);
    
    // Don't animate system updates while user is dragging
    if (isDragging) return;
    
    switch (event.type) {
      case 'task:created':
        // Only add task if it doesn't already exist (prevents duplicates)
        setTasks(prev => {
          if (prev.some(t => t.id === event.data.id)) {
            return prev; // Task already exists, skip
          }
          return [event.data, ...prev];
        });
        // Animate new task only if not dragging
        if (!isDragging) {
          setSystemUpdatedTasks(prev => new Set([...prev, event.data.id]));
          setTimeout(() => {
            setSystemUpdatedTasks(prev => {
              const next = new Set(prev);
              next.delete(event.data.id);
              return next;
            });
          }, 500);
        }
        break;
      case 'task:updated':
        setTasks(prev => prev.map(t => t.id === event.data.id ? event.data : t));
        // Animate status change only if not dragging
        if (!isDragging) {
          setSystemUpdatedTasks(prev => new Set([...prev, event.data.id]));
          setTimeout(() => {
            setSystemUpdatedTasks(prev => {
              const next = new Set(prev);
              next.delete(event.data.id);
              return next;
            });
          }, 500);
        }
        break;
      case 'task:deleted':
        setTasks(prev => prev.filter(t => t.id !== event.data.id));
        break;
    }
  }, [isDragging]);

  const { connected, nextCheck } = useSSE(handleSSEEvent);

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setIsDragging(true);
  }, []);

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    setIsDragging(false);
    
    const { active, over } = event;

    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Use minimal animation for manual drags (just to clean up visual state)
    setAnimatingTasks(prev => new Set([...prev, taskId]));

    // Optimistic update
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: newStatus } : t
    ));

    // Clean up animation state quickly for manual drags
    setTimeout(() => {
      setAnimatingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }, 200);

    // API call
    try {
      await api.moveTask(taskId, newStatus);
    } catch (error) {
      console.error('Failed to move task:', error);
      fetchTasks(); // Revert on error
    }
  };

  // Handle task update from drawer
  const handleTaskUpdate = async (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    setSelectedTask(updatedTask);
  };

  // Handle task delete
  const handleTaskDelete = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setSelectedTask(null);
  };

  // Toggle column collapse/expand
  const toggleColumnCollapse = useCallback((status: TaskStatus) => {
    setCollapsedColumns(prev => ({
      ...prev,
      [status]: !prev[status] // Toggle: if undefined/true -> false, if false -> true
    }));
  }, []);

  // Group tasks by status - inline collapse logic to avoid stale closures
  const columns = TASK_STATUSES.map(status => {
    const columnTasks = tasks.filter(t => t.status === status);
    const override = collapsedColumns[status];
    return {
      status,
      tasks: columnTasks,
      isCollapsed: override !== undefined ? override : columnTasks.length === 0
    };
  });

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        color: 'var(--text-secondary)'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ 
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <header style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
            🚀 Mission Control
          </h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <ThemeToggle />
            {/* Reserved for: Account/Login, Settings, Help */}
          </div>
        </header>

        {/* Summary Bar */}
        <SummaryBar tasks={tasks} nextCheck={nextCheck} />

        {/* Kanban Toolbar */}
        <div style={{
          padding: '12px 24px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => setShowNewTask(true)}
          >
            + New Task
          </button>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Future filters will go here */}
          </div>
        </div>

        {/* Split-pane content area */}
        <div className="content-area" style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden'
        }}>
          {/* Board area - shrinks when inspector is open */}
          <div className="board-area" style={{
            flex: 1,
            minWidth: 0,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <main style={{
              flex: 1,
              padding: '24px',
              overflowX: 'auto'
            }}>
              <div style={{
                display: 'flex',
                gap: '16px',
                minWidth: 'fit-content'
              }}>
                {columns.map(column => (
                  <Column 
                    key={column.status} 
                    status={column.status} 
                    tasks={column.tasks}
                    onTaskClick={setSelectedTask}
                    selectedTask={selectedTask}
                    animatingTasks={animatingTasks}
                    systemUpdatedTasks={systemUpdatedTasks}
                    isCollapsed={column.isCollapsed}
                    onToggleCollapse={() => toggleColumnCollapse(column.status)}
                  />
                ))}
              </div>
            </main>
          </div>

          {/* Task Inspector - non-modal split pane */}
          {selectedTask && (
            <TaskDrawer
              task={selectedTask}
              onClose={() => setSelectedTask(null)}
              onUpdate={handleTaskUpdate}
              onDelete={handleTaskDelete}
            />
          )}
        </div>

        {/* New Task Modal - stays modal */}
        {showNewTask && (
          <NewTaskModal
            onClose={() => setShowNewTask(false)}
            onCreated={(task) => {
              // Add the new task to state directly
              // Note: Server does NOT emit task:created SSE for tasks created via API
              // so we don't need to worry about duplicate SSE events
              setTasks(prev => [task, ...prev]);
              setShowNewTask(false);
            }}
          />
        )}
      </div>
    </DndContext>
  );
}

// Column component
function Column({ 
  status, 
  tasks, 
  onTaskClick,
  selectedTask,
  animatingTasks,
  systemUpdatedTasks,
  isCollapsed,
  onToggleCollapse
}: { 
  status: TaskStatus; 
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  selectedTask: Task | null;
  animatingTasks: Set<string>;
  systemUpdatedTasks: Set<string>;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  const statusColors: Record<TaskStatus, { color: string; label: string }> = {
    Backlog: { color: 'var(--text-secondary)', label: 'Backlog' },
    Ready: { color: 'var(--accent-blue)', label: 'Ready' },
    InProgress: { color: 'var(--accent-purple)', label: 'In Progress' },
    Blocked: { color: 'var(--accent-red)', label: 'Blocked' },
    Review: { color: 'var(--accent-orange)', label: 'Review' },
    Done: { color: 'var(--accent-green)', label: 'Done' }
  };

  const config = statusColors[status];

  // Collapsed column styles
  const collapsedWidth = 64;
  const expandedWidth = 280;

  return (
    <div 
      ref={setNodeRef}
      className={`kanban-column ${isOver ? 'is-over' : ''} ${isCollapsed ? 'collapsed' : ''}`}
      style={{
        width: isCollapsed ? collapsedWidth : expandedWidth,
        flexShrink: 0,
        transition: 'width 0.2s ease',
        opacity: isOver && !isCollapsed ? 0.8 : 1
      }}
    >
      {isCollapsed ? (
        // Collapsed state: vertical header
        <div 
          className="kanban-column-header collapsed"
          onClick={onToggleCollapse}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onToggleCollapse()}
          aria-label={`Expand ${config.label} column`}
          style={{
            height: '100%',
            minHeight: '400px',
            padding: '12px 8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            borderBottom: 'none'
          }}
        >
          {/* Count at top */}
          <span style={{
            background: 'var(--bg-tertiary)',
            padding: '4px 8px',
            borderRadius: '10px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            marginBottom: '12px',
            flexShrink: 0
          }}>
            ({tasks.length})
          </span>
          
          {/* Vertical title */}
          <span style={{
            color: config.color,
            fontWeight: 600,
            fontSize: '13px',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            transform: 'rotate(180deg)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxHeight: '280px',
            flex: 1
          }}>
            {config.label}
          </span>
          
          {/* Chevron indicator */}
          <ChevronIcon style={{ marginTop: '12px', flexShrink: 0 }} />
        </div>
      ) : (
        // Expanded state: normal layout
        <>
          <div className="kanban-column-header">
            <button
              onClick={onToggleCollapse}
              className="collapse-toggle"
              aria-label={`Collapse ${config.label} column`}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                marginRight: '8px',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--text-secondary)'
              }}
            >
              <ChevronIcon collapsed style={{ transition: 'transform 0.2s' }} />
            </button>
            <span style={{ color: config.color }}>
              {config.label}
            </span>
            <span style={{
              background: 'var(--bg-tertiary)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '12px',
              color: 'var(--text-secondary)'
            }}>
              {tasks.length}
            </span>
          </div>
          
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tasks.length === 0 ? (
              <div className="empty-state">
                <p style={{ margin: 0, fontSize: '13px' }}>No tasks</p>
              </div>
            ) : (
              tasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task}
                  onClick={() => onTaskClick(task)}
                  isSelected={selectedTask?.id === task.id}
                  isAnimating={animatingTasks.has(task.id)}
                  isSystemUpdated={systemUpdatedTasks.has(task.id)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Chevron icon component
function ChevronIcon({ collapsed = false, style }: { collapsed?: boolean; style?: React.CSSProperties }) {
  return (
    <svg 
      width="16" 
      height="16" 
      viewBox="0 0 16 16" 
      fill="currentColor"
      style={{
        ...style,
        transform: collapsed ? 'rotate(-90deg)' : 'rotate(90deg)',
        transition: 'transform 0.2s ease'
      }}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default App;
