import { useState, useEffect, useCallback } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import { Task, TaskStatus, TASK_STATUSES } from './shared-types';
import { TaskCard } from './components/TaskCard';
import { TaskDrawer } from './components/TaskDrawer';
import { SummaryBar } from './components/SummaryBar';
import { NewTaskModal } from './components/NewTaskModal';
import { api } from './api/client';
import { useSSE } from './hooks/useSSE';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [loading, setLoading] = useState(true);
  const [animatingTasks, setAnimatingTasks] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [systemUpdatedTasks, setSystemUpdatedTasks] = useState<Set<string>>(new Set());

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
        setTasks(prev => [event.data, ...prev]);
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

  const { connected } = useSSE(handleSSEEvent);

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

  // Group tasks by status
  const columns = TASK_STATUSES.map(status => ({
    status,
    tasks: tasks.filter(t => t.status === status)
  }));

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
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setShowNewTask(true)}
            >
              + New Task
            </button>
          </div>
        </header>

        {/* Summary Bar */}
        <SummaryBar tasks={tasks} />

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
  systemUpdatedTasks
}: { 
  status: TaskStatus; 
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  selectedTask: Task | null;
  animatingTasks: Set<string>;
  systemUpdatedTasks: Set<string>;
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

  return (
    <div 
      ref={setNodeRef}
      className="kanban-column"
      style={{
        width: '280px',
        flexShrink: 0,
        opacity: isOver ? 0.8 : 1
      }}
    >
      <div className="kanban-column-header">
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
    </div>
  );
}

export default App;
