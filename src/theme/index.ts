import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const lightColors = {
  primary: "#003336",
  primaryContainer: "#004b50",
  surface: "#f8fafa",
  surfaceLow: "#f2f4f4",
  surfaceHighest: "#e1e3e3",
  surfaceLowest: "#ffffff",
  text: "#191c1d",
  mutedText: "#707979",
  amber: "#ff970f",
  amberDark: "#653800",
  error: "#ba1a1a",
  errorContainer: "#ffdad6",
  secondaryContainer: "#c0e7ea",
  onSecondaryContainer: "#44696c",
  unreadContainer: "#e8f5f5",
  onUnreadContainer: "#003336",
  tertiaryContainer: "#653800",
  onTertiaryContainer: "#ff970f",
};

export const darkColors = {
  primary: "#61ebf3",
  primaryContainer: "#004b50", // adjusted for dark
  surface: "#101414",
  surfaceLow: "#171b1b",
  surfaceHighest: "#313535",
  surfaceLowest: "#000000",
  text: "#e0e3e3",
  mutedText: "#a0a4a4",
  amber: "#ffb45a",
  amberDark: "#855300",
  error: "#ffb4ab",
  errorContainer: "#93000a",
  secondaryContainer: "#344f51",
  onSecondaryContainer: "#a2cecf",
  unreadContainer: "#1f3739",
  onUnreadContainer: "#d9f2f2",
  tertiaryContainer: "#854b00",
  onTertiaryContainer: "#ffb45a",
};

export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  fonts: {
    heading: 'System', 
    body: 'System',    
  },
  sizes: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
};

export const theme = {
  colors: lightColors,
  spacing,
  typography,
};

export const darkTheme = {
  colors: darkColors,
  spacing,
  typography,
};

export type ThemeMode = 'light' | 'dark';

export type AppTheme = (typeof theme) & {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
};

const THEME_MODE_KEY = '@radar-concursos/theme-mode';

const defaultTheme: AppTheme = {
  ...theme,
  mode: 'light',
  isDark: false,
  setMode: async () => undefined,
};

const ThemeContext = createContext<AppTheme>(defaultTheme);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(THEME_MODE_KEY)
      .then(savedMode => {
        if (mounted && (savedMode === 'light' || savedMode === 'dark')) {
          setModeState(savedMode);
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback(async (nextMode: ThemeMode) => {
    setModeState(nextMode);
    try {
      await AsyncStorage.setItem(THEME_MODE_KEY, nextMode);
    } catch {
      // A storage failure should not prevent the current session from changing theme.
    }
  }, []);

  const appTheme = useMemo<AppTheme>(() => ({
    ...(mode === 'dark' ? darkTheme : theme),
    mode,
    isDark: mode === 'dark',
    setMode,
  }), [mode, setMode]);

  return React.createElement(ThemeContext.Provider, { value: appTheme }, children);
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
