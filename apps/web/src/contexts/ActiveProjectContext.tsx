import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { api } from '../api/client';

const STORAGE_KEY = 'mission-control-active-project';

type ProjectOption = { id: string; name: string; color?: string | null };

type ActiveProjectContextValue = {
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  projects: ProjectOption[];
  loadProjects: () => Promise<void>;
};

const ActiveProjectContext = createContext<ActiveProjectContextValue | null>(null);

export function useActiveProject(): ActiveProjectContextValue {
  const ctx = useContext(ActiveProjectContext);
  if (!ctx) throw new Error('useActiveProject must be used within ActiveProjectProvider');
  return ctx;
}

export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  const setActiveProjectId = useCallback((id: string | null) => {
    setActiveProjectIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const res = await api.getProjects(false);
      setProjects(res.projects.map(p => ({ id: p.id, name: p.name, color: p.color ?? undefined })));
    } catch (e) {
      console.error('Failed to load projects', e);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const value: ActiveProjectContextValue = {
    activeProjectId,
    setActiveProjectId,
    projects,
    loadProjects
  };

  return (
    <ActiveProjectContext.Provider value={value}>
      {children}
    </ActiveProjectContext.Provider>
  );
}
