import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { useActiveProject } from '../contexts/ActiveProjectContext';

export function Layout() {
  const location = useLocation();
  const { activeProjectId, setActiveProjectId, projects } = useActiveProject();
  const showProjectBar = location.pathname !== '/projects';

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
      overflow: 'hidden'
    }}>
      <header style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
            🚀 Mission Control
          </h1>
          <NavLink
            to="/kanban"
            style={({ isActive }) => ({
              color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
              textDecoration: 'none',
              fontWeight: isActive ? 600 : 400
            })}
          >
            Kanban
          </NavLink>
          <NavLink
            to="/prompts"
            style={({ isActive }) => ({
              color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
              textDecoration: 'none',
              fontWeight: isActive ? 600 : 400
            })}
          >
            Prompts
          </NavLink>
          <NavLink
            to="/projects"
            style={({ isActive }) => ({
              color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
              textDecoration: 'none',
              fontWeight: isActive ? 600 : 400
            })}
          >
            Projects
          </NavLink>
        </nav>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <ThemeToggle />
        </div>
      </header>
      {showProjectBar && (
        <div style={{
          padding: '12px 24px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Project:</span>
          <select
            className="input select"
            value={activeProjectId ?? ''}
            onChange={e => setActiveProjectId(e.target.value || null)}
            style={{ minWidth: '160px' }}
          >
            <option value="">All</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Outlet />
      </div>
    </div>
  );
}
