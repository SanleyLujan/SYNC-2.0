import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { AppTheme, ThemeMode, applyTheme, darkTheme, themeByMode } from '../theme/colors';

const STORAGE_KEY = '@sync:theme-mode';

interface ThemeState {
  mode: ThemeMode;
  theme: AppTheme;
  isLoading: boolean;
  loadTheme: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
}

const isThemeMode = (value: string | null): value is ThemeMode => (
  value === 'dark' || value === 'light'
);

export const useThemeStore = create<ThemeState>()((set) => ({
      mode: 'dark',
      theme: darkTheme,
      isLoading: true,

      loadTheme: async () => {
        try {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          let candidate: string | null = stored;
          // Migra o JSON gravado pela versão antiga do Zustand persist.
          if (stored?.startsWith('{')) {
            try { candidate = JSON.parse(stored)?.state?.mode || null; } catch { candidate = null; }
          }
          const mode = isThemeMode(candidate) ? candidate : 'dark';
          const theme = themeByMode(mode);
          applyTheme(theme);
          await AsyncStorage.setItem(STORAGE_KEY, mode);
          set({ mode, theme, isLoading: false });
        } catch {
          applyTheme(darkTheme);
          set({ mode: 'dark', theme: darkTheme, isLoading: false });
        }
      },

      setMode: async (mode) => {
        const theme = themeByMode(mode);
        applyTheme(theme);
        set({ mode, theme });
        await AsyncStorage.setItem(STORAGE_KEY, mode);
      },
    }));

applyTheme(darkTheme);
