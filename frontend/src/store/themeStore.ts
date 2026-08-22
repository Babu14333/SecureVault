import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccentColorKey, ThemeMode } from '../theme/tokens';

const STORAGE_THEME_MODE_KEY = '@securevault_theme_mode_v2';
const STORAGE_THEME_ACCENT_KEY = '@securevault_theme_accent_v2';

interface ThemeState {
  mode: ThemeMode;
  accent: AccentColorKey;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColorKey) => void;
  loadSavedTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'light',
  accent: 'indigo',

  setMode: (mode) => {
    set({ mode });
    AsyncStorage.setItem(STORAGE_THEME_MODE_KEY, mode).catch((err) =>
      console.warn('Failed to persist theme mode:', err)
    );
  },

  setAccent: (accent) => {
    set({ accent });
    AsyncStorage.setItem(STORAGE_THEME_ACCENT_KEY, accent).catch((err) =>
      console.warn('Failed to persist theme accent:', err)
    );
  },

  loadSavedTheme: async () => {
    try {
      // Clear legacy dark mode persistence if present
      await AsyncStorage.removeItem('@securevault_theme_mode').catch(() => {});

      const savedMode = (await AsyncStorage.getItem(STORAGE_THEME_MODE_KEY)) as ThemeMode | null;
      const savedAccent = (await AsyncStorage.getItem(STORAGE_THEME_ACCENT_KEY)) as AccentColorKey | null;

      set({
        mode: savedMode || 'light',
        accent: savedAccent || 'indigo',
      });
    } catch (err) {
      console.warn('Failed to load saved theme settings:', err);
    }
  },
}));

