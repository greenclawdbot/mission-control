import { Task } from '../shared-types';

interface TaskTabBarProps {
  openTaskIds: string[];
  activeTaskId: string | null;
  tasks: Task[];
  onSelectTab: (id: string | null) => void;
  onCloseTab: (id: string) => void;
}

const MAX_TITLE_LENGTH = 28;

function truncateTitle(title: string): string {
  if (title.length <= MAX_TITLE_LENGTH) return title;
  return title.slice(0, MAX_TITLE_LENGTH - 3) + '...';
}

export function TaskTabBar({ openTaskIds, activeTaskId, tasks, onSelectTab, onCloseTab }: TaskTabBarProps) {
  const isBoardActive = activeTaskId === null;

  return (
    <div
      className="task-tab-bar"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '0 8px 0 0',
        flexShrink: 0,
        minHeight: 0,
        overflowX: 'auto'
      }}
    >
      {/* Home tab: Kanban board */}
      <div
        role="tab"
        aria-selected={isBoardActive}
        aria-label="Kanban board"
        onClick={() => onSelectTab(null)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '10px 14px',
          borderBottom: isBoardActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
          background: isBoardActive ? 'var(--bg-primary)' : 'transparent',
          color: isBoardActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '13px',
          flexShrink: 0
        }}
      >
        <span style={{ fontWeight: 600 }}>Kanban</span>
      </div>
      {openTaskIds.map((taskId) => {
        const task = tasks.find((t) => t.id === taskId);
        const title = task ? truncateTitle(task.title) : taskId.slice(0, 8);
        const isActive = activeTaskId === taskId;
        return (
          <div
            key={taskId}
            role="tab"
            aria-selected={isActive}
            aria-label={`Task: ${task?.title ?? taskId}`}
            onClick={() => onSelectTab(taskId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 8px 10px 14px',
              borderBottom: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
              background: isActive ? 'var(--bg-primary)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
              flexShrink: 0,
              maxWidth: '220px',
              minWidth: 0
            }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0
              }}
              title={task?.title ?? taskId}
            >
              {title}
            </span>
            <button
              type="button"
              className="task-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(taskId);
              }}
              aria-label="Close tab"
              title="Close tab"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
