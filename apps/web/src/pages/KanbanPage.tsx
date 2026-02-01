import { useState, useEffect, useCallback } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, useDroppable } from '@dnd-kit/core';
import { Task, TaskStatus, TASK_STATUSES, getProjectColor } from '../shared-types';

const PROJECT_DROP_PREFIX = 'project-';
import { TaskCard } from '../components/TaskCard';
import { TaskDrawer } from '../components/TaskDrawer';
import { SummaryBar } from '../components/SummaryBar';
import { NewTaskModal } from '../components/NewTaskModal';
import { api } from '../api/client';
import { useSSE } from '../hooks/useSSE';
import { useActiveProject } from '../contexts/ActiveProjectContext';

type CollapseOverride = boolean | undefined;

export function KanbanPage() {
  const { activeProjectId, setActiveProjectId, projects } = useActiveProject();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      return localStorage.getItem('kanban-sidebar-open') !== 'false';
    } catch {
      return true;
    }
  });
  const [animatingTasks, setAnimatingTasks] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [systemUpdatedTasks, setSystemUpdatedTasks] = useState<Set<string>>(new Set());

  const [collapsedColumns, setCollapsedColumns] = useState<Record<TaskStatus, CollapseOverride>>(() => {
    const initial: Record<TaskStatus, CollapseOverride> = {} as Record<TaskStatus, CollapseOverride>;
    TASK_STATUSES.forEach(status => {
      initial[status] = undefined;
    });
    return initial;
  });
  const [taskCounts, setTaskCounts] = useState<Record<string, { notDone: number; done: number }>>({});

  const fetchTaskCounts = useCallback(async () => {
    try {
      const res = await api.getProjectTaskCounts();
      setTaskCounts(res.counts);
    } catch (e) {
      console.error('Failed to load project task counts', e);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const response = await api.getTasks(
        activeProjectId != null ? { projectId: activeProjectId } : undefined
      );
      setTasks(response.tasks);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    fetchTaskCounts();
  }, [fetchTaskCounts]);

  const handleSSEEvent = useCallback((event: { type: string; data: Task }) => {
    if (isDragging) return;
    switch (event.type) {
      case 'task:created':
        setTasks(prev => {
          if (prev.some(t => t.id === event.data.id)) return prev;
          return [event.data, ...prev];
        });
        if (!isDragging) {
          setSystemUpdatedTasks(prev => new Set([...prev, event.data.id]));
          setTimeout(() => setSystemUpdatedTasks(prev => {
            const next = new Set(prev);
            next.delete(event.data.id);
            return next;
          }), 500);
        }
        break;
      case 'task:updated':
        setTasks(prev => prev.map(t => t.id === event.data.id ? event.data : t));
        if (!isDragging) {
          setSystemUpdatedTasks(prev => new Set([...prev, event.data.id]));
          setTimeout(() => setSystemUpdatedTasks(prev => {
            const next = new Set(prev);
            next.delete(event.data.id);
            return next;
          }), 500);
        }
        break;
      case 'task:deleted':
        setTasks(prev => prev.filter(t => t.id !== event.data.id));
        break;
    }
    fetchTaskCounts();
  }, [isDragging, fetchTaskCounts]);

  const { nextCheck } = useSSE(handleSSEEvent);

  const handleDragStart = useCallback((_event: DragStartEvent) => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    setIsDragging(false);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const overId = String(over.id);

    if (overId.startsWith(PROJECT_DROP_PREFIX)) {
      const projectIdRaw = overId.slice(PROJECT_DROP_PREFIX.length);
      const projectId = projectIdRaw === 'none' ? null : projectIdRaw;
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      try {
        const updated = await api.updateTask(taskId, { projectId });
        setTasks(prev => prev.map(t => t.id === taskId ? updated.task : t));
        if (selectedTask?.id === taskId) setSelectedTask(updated.task);
        fetchTaskCounts();
      } catch (e) {
        console.error('Failed to set task project', e);
        fetchTasks();
      }
      return;
    }

    const newStatus = over.id as TaskStatus;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;
    setAnimatingTasks(prev => new Set([...prev, taskId]));
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    setTimeout(() => setAnimatingTasks(prev => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    }), 200);
    try {
      await api.moveTask(taskId, newStatus);
    } catch (error) {
      console.error('Failed to move task:', error);
      fetchTasks();
    }
  };

  const handleTaskUpdate = async (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    setSelectedTask(updatedTask);
    fetchTaskCounts();
  };

  const handleTaskDelete = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setSelectedTask(null);
    fetchTaskCounts();
  };

  const toggleColumnCollapse = useCallback((status: TaskStatus) => {
    setCollapsedColumns(prev => ({ ...prev, [status]: !prev[status] }));
  }, []);

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <SummaryBar tasks={tasks} nextCheck={nextCheck} />
        <div style={{
          padding: '12px 24px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNewTask(true)}>
            + New Task
          </button>
        </div>
        <div className="content-area" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
          {sidebarOpen && (
            <aside
              style={{
                width: '200px',
                flexShrink: 0,
                borderRight: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', fontWeight: 600, fontSize: '13px', flexShrink: 0 }}>
                Projects
              </div>
              <div style={{ padding: '8px', overflow: 'auto', flex: 1, minHeight: 0 }}>
                <ProjectSidebarItem
                  label="All"
                  isActive={activeProjectId === null}
                  onClick={() => setActiveProjectId(null)}
                />
                <ProjectDropTarget
                  id={`${PROJECT_DROP_PREFIX}none`}
                  label="No project"
                  filterValue="none"
                  activeProjectId={activeProjectId}
                  setActiveProjectId={setActiveProjectId}
                  notDone={taskCounts['none']?.notDone}
                  done={taskCounts['none']?.done}
                />
                {projects.map((p, i) => (
                  <ProjectDropTarget
                    key={p.id}
                    id={`${PROJECT_DROP_PREFIX}${p.id}`}
                    label={p.name}
                    filterValue={p.id}
                    activeProjectId={activeProjectId}
                    setActiveProjectId={setActiveProjectId}
                    color={getProjectColor(p, i)}
                    notDone={taskCounts[p.id]?.notDone}
                    done={taskCounts[p.id]?.done}
                  />
                ))}
              </div>
            </aside>
          )}
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(prev => {
              const next = !prev;
              try { localStorage.setItem('kanban-sidebar-open', String(next)); } catch {}
              return next;
            });
            }}
            style={{
              position: 'absolute',
              left: sidebarOpen ? 200 : 0,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 10,
              width: '20px',
              height: '40px',
              padding: 0,
              border: '1px solid var(--border-color)',
              borderRadius: '0 4px 4px 0',
              background: 'var(--bg-secondary)',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            {sidebarOpen ? '‹' : '›'}
          </button>
          <div className="board-area" style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <main style={{ flex: 1, padding: '24px', overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: '16px', minWidth: 'fit-content' }}>
              {columns.map(column => (
                <Column
                  key={column.status}
                  status={column.status}
                  tasks={column.tasks}
                  projects={projects}
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
        {selectedTask && (
          <TaskDrawer
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdate={handleTaskUpdate}
            onDelete={handleTaskDelete}
          />
        )}
        </div>
      </div>
      {showNewTask && (
        <NewTaskModal
          onClose={() => setShowNewTask(false)}
          onCreated={(task) => {
            setTasks(prev => [task, ...prev]);
            setShowNewTask(false);
          }}
          projects={projects}
          defaultProjectId={activeProjectId === 'none' ? undefined : activeProjectId ?? undefined}
        />
      )}
    </DndContext>
  );
}

function ProjectSidebarItem({
  label,
  isActive,
  onClick
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{
        padding: '10px 12px',
        marginBottom: '4px',
        borderRadius: '8px',
        fontSize: '13px',
        background: isActive ? 'rgba(88, 166, 255, 0.2)' : 'var(--bg-tertiary)',
        color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)',
        transition: 'background 0.15s, color 0.15s',
        cursor: 'pointer',
        border: isActive ? '1px solid var(--accent-blue)' : '1px solid transparent'
      }}
    >
      {label}
    </div>
  );
}

function ProjectDropTarget({
  id,
  label,
  filterValue,
  activeProjectId,
  setActiveProjectId,
  color,
  notDone,
  done
}: {
  id: string;
  label: string;
  filterValue: string;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  color?: string;
  notDone?: number;
  done?: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const isActive = activeProjectId === filterValue;
  const showPill = notDone !== undefined && done !== undefined;
  const handleClick = () => setActiveProjectId(filterValue);
  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
      style={{
        padding: '10px 12px',
        marginBottom: '4px',
        borderRadius: '8px',
        fontSize: '13px',
        background: isOver ? 'var(--accent-blue)' : isActive ? 'rgba(88, 166, 255, 0.2)' : 'var(--bg-tertiary)',
        color: isOver ? 'white' : isActive ? 'var(--accent-blue)' : 'var(--text-primary)',
        transition: 'background 0.15s, color 0.15s',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        border: !isOver && isActive ? '1px solid var(--accent-blue)' : '1px solid transparent',
        ...(color && !isOver && !isActive && { borderLeft: `4px solid ${color}` })
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {label}
      </span>
      {showPill && (
        <span
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: '11px',
            opacity: isOver ? 0.9 : 0.85
          }}
        >
          <span style={{ padding: '1px 4px', borderRight: isOver ? '1px solid rgba(255,255,255,0.5)' : '1px solid var(--border-color)', borderRadius: '4px 0 0 4px' }}>
            {notDone}
          </span>
          <span style={{ padding: '1px 4px', borderRadius: '0 4px 4px 0' }}>
            {done}
          </span>
        </span>
      )}
    </div>
  );
}

const statusColors: Record<TaskStatus, { color: string; label: string }> = {
  New: { color: 'var(--accent-blue)', label: 'New' },
  Planning: { color: 'var(--accent-purple)', label: 'Planning' },
  Backlog: { color: 'var(--text-secondary)', label: 'Backlog' },
  Ready: { color: 'var(--accent-blue)', label: 'Ready' },
  InProgress: { color: 'var(--accent-purple)', label: 'In Progress' },
  Blocked: { color: 'var(--accent-red)', label: 'Blocked' },
  Review: { color: 'var(--accent-orange)', label: 'Review' },
  Failed: { color: 'var(--accent-red)', label: 'Failed' },
  Done: { color: 'var(--accent-green)', label: 'Done' }
};

function Column({
  status,
  tasks,
  projects,
  onTaskClick,
  selectedTask,
  animatingTasks,
  systemUpdatedTasks,
  isCollapsed,
  onToggleCollapse
}: {
  status: TaskStatus;
  tasks: Task[];
  projects: { id: string; name: string; color?: string | null }[];
  onTaskClick: (task: Task) => void;
  selectedTask: Task | null;
  animatingTasks: Set<string>;
  systemUpdatedTasks: Set<string>;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const config = statusColors[status];
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
          <ChevronIcon style={{ marginTop: '12px', flexShrink: 0 }} />
        </div>
      ) : (
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
            <span style={{ color: config.color }}>{config.label}</span>
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
                  projectName={task.projectId ? projects.find(p => p.id === task.projectId)?.name ?? undefined : undefined}
                  projectColor={(() => {
                    const proj = task.projectId ? projects.find(p => p.id === task.projectId) : undefined;
                    return proj ? getProjectColor(proj, projects.indexOf(proj)) : undefined;
                  })()}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

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
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
