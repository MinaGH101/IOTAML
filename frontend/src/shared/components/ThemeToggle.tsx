import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../app/providers/ThemeProvider';
import { IconButton } from '../ui';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const label = theme === 'dark' ? 'حالت روشن' : 'حالت تاریک';

  return (
    <IconButton
      icon={theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      aria-label={label}
      title={label}
      className={`icon-button theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
    />
  );
}
