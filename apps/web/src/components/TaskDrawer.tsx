import { TaskInspectorContent, TaskInspectorContentProps } from './TaskInspectorContent';

export function TaskDrawer(props: TaskInspectorContentProps) {
  return (
    <aside className="task-inspector" aria-label="Task Inspector">
      <TaskInspectorContent {...props} />
    </aside>
  );
}
