import { useColorScheme } from 'react-native';
import { BaseColors, AccentPalettes, AccentColorKey } from './tokens';
import { useThemeStore } from '../store/themeStore';

export function useTheme() {
  const systemScheme = useColorScheme();
  const { mode, accent, setMode, setAccent } = useThemeStore();

  // Default to light mode (white background) unless explicitly set to dark
  const resolvedMode: 'light' | 'dark' = mode === 'dark' ? 'dark' : 'light';

  const base = BaseColors[resolvedMode];
  const accentPalette = AccentPalettes[accent] || AccentPalettes.indigo;

  const colors = {
    ...base,
    primary: accentPalette.primary,
    primaryLight: accentPalette.primaryLight,
    primaryDark: accentPalette.primaryDark,
    primaryBg: accentPalette.primaryBg,
  };

  return {
    colors,
    isDark: resolvedMode === 'dark',
    mode,
    resolvedMode,
    accent,
    setMode,
    setAccent,
  };
}

