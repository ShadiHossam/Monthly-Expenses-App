import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Appearance } from 'react-native';
import { storage } from '../lib/storage';

interface ThemeContextType {
  isDark: boolean;
  toggleDark: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children, onColorSchemeChange }: {
  children: React.ReactNode;
  onColorSchemeChange?: (isDark: boolean) => void;
}) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    storage.getTheme().then(saved => {
      let dark: boolean;
      if (saved === 'dark') dark = true;
      else if (saved === 'light') dark = false;
      else dark = Appearance.getColorScheme() === 'dark';
      setIsDark(dark);
      onColorSchemeChange?.(dark);
    });
  }, []);

  const toggleDark = useCallback(async () => {
    const next = !isDark;
    setIsDark(next);
    await storage.setTheme(next ? 'dark' : 'light');
    onColorSchemeChange?.(next);
  }, [isDark, onColorSchemeChange]);

  return (
    <ThemeContext.Provider value={{ isDark, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
