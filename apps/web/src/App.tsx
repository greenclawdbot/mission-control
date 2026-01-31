import { useState, useEffect, useCallback } from 'react';
import { DndContext, DragEndEvent, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import { Task, TaskStatus, TASK_STATUSES } from './shared-types';
import { TaskCard } from './components/TaskCard';
import { TaskDrawer } from './components/TaskDrawer';
import { SummaryBar } from './components/SummaryBar';
import { NewTaskModal } from './components/NewTaskModal';
import { api } from './api/client';
import { useWebSocket } from './hooks/useWebSocket';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clearingDemo, setClearingDemo] = useState(false);

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

  // WebSocket connection for live updates
  useWebSocket({
    onTaskCreated: (task) => {
      setTasks(prev => {
        // Avoid duplicates
        if (prev.some(t => t.id === task.id)) return prev;
        return [task, ...prev];
      });
    },
    onTaskUpdated: (updatedTask) => {
      setTasks(prev => prev.map(t => 
        t.id === updatedTask.id ? updatedTask : t
      ));
      // Also update selected task if it's the one being viewed
      setSelectedTask(prev => 
        prev?.id === updatedTask.id ? updatedTask : prev
      );
    },
    onTaskDeleted: (taskId) => {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setSelectedTask(prev => prev?.id === taskId ? null : prev);
    }
  });

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic update
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: newStatus } : t
    ));

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

  // Handle clear demo data
  const handleClearDemoData = async () => {
    if (!confirm('Are you sure you want to delete all demo tasks? This cannot be undone.')) {
      return;
    }
    
    setClearingDemo(true);
    try {
      await api.clearDemoData();
      await fetchTasks(); // Refresh the board
    } catch (error) {
      console.error('Failed to clear demo data:', error);
      alert('Failed to clear demo data');
    } finally {
      setClearingDemo(false);
    }
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
    <DndContext onDragEnd={handleDragEnd}>
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
            {tasks.length > 0 && (
              <button 
                className="btn btn-sm"
                onClick={handleClearDemoData}
                disabled={clearingDemo}
                style={{ color: 'var(--accent-red)' }}
              >
                {clearingDemo ? 'Clearing...' : 'Clear Demo Data'}
              </button>
            )}
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
  selectedTask 
}: { 
  status: TaskStatus; 
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  selectedTask: Task | null;
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
            />
          ))
        )}
      </div>
    </div>
  );
}

export default App;
