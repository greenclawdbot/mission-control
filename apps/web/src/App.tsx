import { Routes, Route, Navigate } from 'react-router-dom';
import { ActiveProjectProvider } from './contexts/ActiveProjectContext';
import { Layout } from './components/Layout';
import { KanbanPage } from './pages/KanbanPage';
import { PromptsPage } from './pages/PromptsPage';
import { ProjectsPage } from './pages/ProjectsPage';

function App() {
  return (
    <ActiveProjectProvider>
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/kanban" replace />} />
        <Route path="kanban" element={<KanbanPage />} />
        <Route path="prompts" element={<PromptsPage />} />
        <Route path="projects" element={<ProjectsPage />} />
      </Route>
    </Routes>
    </ActiveProjectProvider>
  );
}

export default App;
