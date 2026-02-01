import { useState, useEffect, useCallback } from 'react';
import { Project } from '../shared-types';
import { api } from '../api/client';

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPath, setEditPath] = useState('');
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getProjects(showArchived);
      setProjects(res.projects);
    } catch (e) {
      console.error('Failed to load projects', e);
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPath.trim()) return;
    try {
      await api.createProject({ name: newName.trim(), folderPath: newPath.trim() });
      setNewName('');
      setNewPath('');
      setShowAdd(false);
      loadProjects();
    } catch (e) {
      console.error('Failed to create project', e);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await api.updateProject(id, { name: editName.trim(), folderPath: editPath.trim() });
      setEditingId(null);
      loadProjects();
    } catch (e) {
      console.error('Failed to update project', e);
    }
  };

  const handleSetPath = async (id: string, folderPath: string) => {
    try {
      await api.setProjectPath(id, folderPath.trim());
      loadProjects();
    } catch (e) {
      console.error('Failed to set path', e);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await api.archiveProject(id);
      loadProjects();
    } catch (e) {
      console.error('Failed to archive project', e);
    }
  };

  const startEdit = (p: Project) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditPath(p.folderPath);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>Projects</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={e => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            + Add project
          </button>
        </div>
      </div>

      {showAdd && (
        <form
          onSubmit={handleAdd}
          style={{
            padding: '16px',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxWidth: '400px'
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Name</label>
            <input
              className="input"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Project name"
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Folder path</label>
            <input
              className="input"
              value={newPath}
              onChange={e => setNewPath(e.target.value)}
              placeholder="/path/to/project"
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-primary">Create</button>
            <button type="button" className="btn" onClick={() => { setShowAdd(false); setNewName(''); setNewPath(''); }}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : projects.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>{showArchived ? 'No archived projects.' : 'No projects. Add one above.'}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {projects.map(p => (
            <div
              key={p.id}
              style={{
                padding: '12px 16px',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap'
              }}
            >
              {editingId === p.id ? (
                <>
                  <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: 0 }}>
                    <input
                      className="input"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Name"
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <input
                      className="input"
                      value={editPath}
                      onChange={e => setEditPath(e.target.value)}
                      placeholder="Folder path"
                      style={{ flex: 2, minWidth: 0 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleUpdate(p.id)}>Save</button>
                    <button className="btn btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.folderPath}
                    </div>
                    {p.archivedAt && (
                      <span style={{ fontSize: '12px', color: 'var(--accent-orange)' }}>Archived</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button className="btn btn-sm" onClick={() => startEdit(p)}>Edit</button>
                    {!p.archivedAt && (
                      <>
                        <button
                          className="btn btn-sm"
                          onClick={() => {
                            const path = window.prompt('Folder path', p.folderPath);
                            if (path != null) handleSetPath(p.id, path);
                          }}
                        >
                          Set path
                        </button>
                        <button className="btn btn-sm" onClick={() => handleArchive(p.id)}>Archive</button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
