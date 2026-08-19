import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
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

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark',
      theme: darkTheme,
      isLoading: false,

      loadTheme: async () => {
        try {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          const mode = isThemeMode(stored) ? stored : 'dark';
          const theme = themeByMode(mode);
          applyTheme(theme);
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
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ mode: state.mode }),
      onRehydrateStorage: () => (state) => {
        const mode = state?.mode && isThemeMode(state.mode) ? state.mode : 'dark';
        const theme = themeByMode(mode);
        applyTheme(theme);
        state?.setMode(mode).catch(() => {});
      },
    },
  ),
);

applyTheme(darkTheme);
