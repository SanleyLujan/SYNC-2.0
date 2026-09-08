import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthResponse, RegistrationResponse, User } from '../types';
import { authService } from '../services/auth.service';
import api, { setSessionExpiredHandler } from '../services/api';
import { useThemeStore } from './themeStore';
import { stopBackgroundTracking } from '../services/background-tracking.service';
import { trackingSocket } from '../services/tracking-socket.service';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  register: (name: string, email: string, password: string, confirmPassword: string, extra?: { weightKg?: number; heightCm?: number; gender?: string; cpf?: string }) => Promise<RegistrationResponse>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  setUser: (user: User) => void;
  setAuth: (user: User, token: string, refreshToken?: string, refreshExpiresAt?: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const data = await authService.login(email, password);
    if (data.user?.themeMode) await useThemeStore.getState().setMode(data.user.themeMode);
    // saveAuth já foi chamado dentro do authService — token está no SecureStore
    set({ user: data.user, token: data.accessToken, isAuthenticated: true, isLoading: false });
  },

  loginWithGoogle: async (idToken) => {
    const data = await authService.googleLogin(idToken);
    const user = { ...data.user, onboardingCompleted: data.user?.onboardingCompleted ?? false };
    if (user.themeMode) await useThemeStore.getState().setMode(user.themeMode);
    set({ user, token: data.accessToken, isAuthenticated: true, isLoading: false });
  },

  register: async (name, email, password, confirmPassword, extra) => {
    const data = await authService.register(name, email, password, confirmPassword, extra);
    return data;
  },

  logout: async () => {
    await authService.logout();
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadStoredAuth: async () => {
    try {
      const stored = await authService.getStoredUser();
      if (stored) {
        if (stored.user?.themeMode) await useThemeStore.getState().setMode(stored.user.themeMode);
        set({
          user: stored.user,
          token: stored.token,
          isAuthenticated: true,
          isLoading: false,
        });
        // Atualiza onboarding/perfil no retorno ao app, sem apagar a sessão
        // local em falha de rede. O interceptor trata revogação definitiva.
        try {
          const { data: current } = await api.get('/users/me');
          if (current?.id === stored.user.id && get().user?.id === stored.user.id) {
            get().setUser(current);
          }
        } catch {}
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  setUser: (user) => {
    // Persist so the updated profile survives an app restart
    AsyncStorage.setItem('@sync:user', JSON.stringify(user)).catch(() => {});
    set({ user });
  },

  setAuth: async (user, token, refreshToken, refreshExpiresAt) => {
    if (user.themeMode) await useThemeStore.getState().setMode(user.themeMode);
    await authService.saveAuth({ user, accessToken: token, refreshToken, refreshExpiresAt });
    set({ user, token, isAuthenticated: true });
  },
}));

// Quando a api detecta sessão expirada (401 em /users/me ou /auth/*), zera o
// estado em memória pra que o RootNavigator devolva o usuário ao login.
setSessionExpiredHandler(() => {
  const state = useAuthStore.getState();
  if (state.isAuthenticated) {
    trackingSocket.disconnect();
    void stopBackgroundTracking({ clearQueue: true }).catch(() => {});
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
  }
});
