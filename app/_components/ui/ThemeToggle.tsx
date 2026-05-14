'use client';

import { useTheme } from '@/app/_contexts/ThemeContext';
import { Moon, Sun, Monitor } from 'lucide-react';
import { TOKENS } from '@/app/_components/_pmTheme';

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const getIcon = () => {
    if (theme === 'system') return <Monitor className="w-4 h-4" />;
    return resolvedTheme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />;
  };

  const getLabel = () => {
    if (theme === 'system') return 'Sistema';
    return theme === 'dark' ? 'Oscuro' : 'Claro';
  };

  return (
    <button
      onClick={cycleTheme}
      className="inline-flex items-center justify-center gap-1.5 h-10 px-2.5 rounded transition-colors"
      style={{
        background: '#fff',
        border: `1px solid ${TOKENS.slate200}`,
        color: TOKENS.charcoal,
        boxShadow: '0 1px 2px rgba(18, 24, 38, 0.04)',
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background = TOKENS.slate100)
      }
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fff')}
      title={`Tema actual: ${getLabel()}`}
      aria-label={`Cambiar tema. Actual: ${getLabel()}`}
    >
      {getIcon()}
    </button>
  );
}
