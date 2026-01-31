import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // Load saved theme or default to dark
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
    const initialTheme = saved || 'dark';
    setTheme(initialTheme);
    document.body.setAttribute('data-theme', initialTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.body.setAttribute('data-theme', newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      style={{
        background: 'transparent',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        padding: '6px 12px',
        cursor: 'pointer',
        color: 'var(--text-primary)',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
      <span style={{ fontSize: '12px' }}>{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  );
}
