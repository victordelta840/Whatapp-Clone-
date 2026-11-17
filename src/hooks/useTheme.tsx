import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ThemeMode } from '@/types';

const THEME_STORAGE_KEY = 'converse-theme';
const TEXT_SCALE_KEY = 'converse-text-scale';
const ENTER_SENDS_KEY = 'converse-enter-sends';

export type TextSizeOption = 'small' | 'medium' | 'large';

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (next: ThemeMode) => void;
  textSize: TextSizeOption;
  setTextSize: (next: TextSizeOption) => void;
  enterSends: boolean;
  setEnterSends: (next: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode;
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function applyResolvedThemeToDom(resolved: 'light' | 'dark'): void {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', resolved === 'dark' ? '#111B21' : '#00A884');
    }
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch {
      // ignore storage access issues
    }
    return 'system';
  });

  const [systemDark, setSystemDark] = useState<boolean>(() =>
    resolveMode('system') === 'dark',
  );
  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  const [textSize, setTextSizeState] = useState<TextSizeOption>(() => {
    try {
      const saved = localStorage.getItem(TEXT_SCALE_KEY);
      if (saved === 'small' || saved === 'medium' || saved === 'large') return saved;
    } catch {
      // ignore
    }
    return 'medium';
  });

  const [enterSends, setEnterSendsState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(ENTER_SENDS_KEY);
      if (saved === 'false') return false;
      if (saved === 'true') return true;
    } catch {
      // ignore
    }
    return typeof window !== 'undefined'
      ? !window.matchMedia('(pointer: coarse)').matches
      : true;
  });

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const setTextSize = useCallback((next: TextSizeOption) => {
    setTextSizeState(next);
    try {
      localStorage.setItem(TEXT_SCALE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const setEnterSends = useCallback((next: boolean) => {
    setEnterSendsState(next);
    try {
      localStorage.setItem(ENTER_SENDS_KEY, String(next));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    applyResolvedThemeToDom(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const scale = textSize === 'small' ? '0.92' : textSize === 'large' ? '1.12' : '1';
    document.documentElement.style.setProperty('--app-text-scale', scale);
  }, [textSize]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        textSize,
        setTextSize,
        enterSends,
        setEnterSends,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
