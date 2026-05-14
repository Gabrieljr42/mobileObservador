import { useColorScheme } from 'react-native';

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

export function useAppTheme() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : theme;
}
