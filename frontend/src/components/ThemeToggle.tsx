import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import type { Theme } from '../utils/appShared';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('iota-ml-theme') as Theme) || 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('iota-ml-theme', theme);
  }, [theme]);

  return (
    <button className={`icon-button theme-toggle ${className}`} type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="روشن/تاریک" aria-label="روشن/تاریک">
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
