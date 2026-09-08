import api, { ensureApiAvailable, invalidatePendingRefresh, withSessionWriteLock } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from './secure-storage';
import { AuthResponse, RegistrationResponse, User, SportLevel } from '../types';
import { unregisterPushToken } from './push-notifications.service';
import { stopBackgroundTracking } from './background-tracking.service';

const ACCESS_TOKEN_KEY = '@sync:token';
const REFRESH_TOKEN_KEY = '@sync:refresh-token';
const REFRESH_EXPIRES_KEY = '@sync:refresh-expires-at';

function generateSecureId(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Demo user somente para modo demo explícito (botão "Entrar no modo demo")
const DEMO_USER: User = {
  id: 'demo-user-001',
  name: 'Usuario Demo',
  email: 'demo@sync-app.com',
  bio: 'Apaixonado por esportes e vida saudavel! Sempre buscando novos parceiros de treino.',
  avatarUrl: '',
  sports: ['running', 'cycling', 'gym'],
  level: SportLevel.INTERMEDIATE,
  objectives: ['health', 'social'],
  availability: ['morning', 'evening'],
  latitude: -23.5505,
  longitude: -46.6333,
  city: 'Sao Paulo, SP',
  isActive: true,
  onboardingCompleted: true,
  createdAt: new Date().toISOString(),
};

export const authService = {
  async register(
    name: string, email: string, password: string, confirmPassword: string,
    extra?: { weightKg?: number; heightCm?: number; gender?: string; cpf?: string },
  ): Promise<RegistrationResponse> {
    await ensureApiAvailable();
    const { data } = await api.post(
      '/auth/register',
      { name, email, password, confirmPassword, ...extra },
      { timeout: 30_000 },
    );
    return data;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    await ensureApiAvailable();
    const { data } = await api.post('/auth/login', { email, password }, { timeout: 30_000 });
    await this.saveAuth(data);
    return data;
  },

  // Login/cadastro com Google. Recebe o id_token do Google Sign-In e troca
  // por uma sessão Sync. Requer GOOGLE_CLIENT_ID configurado no backend.
  async googleLogin(idToken: string): Promise<AuthResponse> {
    const { data } = await api.post('/auth/google', { idToken });
    await this.saveAuth(data);
    return data;
  },

  async loginDemo(): Promise<AuthResponse> {
    const demoData: AuthResponse = {
      user: { ...DEMO_USER },
      accessToken: `demo-${generateSecureId()}`,
    };
    await this.saveAuth(demoData);
    return demoData;
  },

  async forgotPassword(email: string): Promise<void> {
    await api.post('/auth/forgot-password', { email });
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await api.post('/auth/reset-password', { token, newPassword });
  },

  async verifyEmail(token: string): Promise<void> {
    await api.post('/auth/verify-email', { token });
  },

  async verifyEmailCode(email: string, code: string): Promise<AuthResponse> {
    const { data } = await api.post('/auth/verify-email-code', { email, code });
    await this.saveAuth(data);
    return data;
  },

  async requestVerification(email: string): Promise<{ ok: true; message: string; emailVerificationSent?: boolean }> {
    const { data } = await api.post('/auth/request-verification', { email });
    return data;
  },

  async resendVerification(): Promise<{ ok: true; message: string; emailVerificationSent?: boolean }> {
    const { data } = await api.post('/auth/resend-verification');
    return data;
  },

  async logout(): Promise<void> {
    invalidatePendingRefresh();
    const refreshToken = await secureStorage.getItem(REFRESH_TOKEN_KEY).catch(() => null);
    await stopBackgroundTracking({ clearQueue: true }).catch(() => {});
    await unregisterPushToken().catch(() => {});
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    await withSessionWriteLock(async () => {
      invalidatePendingRefresh();
      await secureStorage.removeItem(ACCESS_TOKEN_KEY);
      await secureStorage.removeItem(REFRESH_TOKEN_KEY);
      await secureStorage.removeItem(REFRESH_EXPIRES_KEY);
      // Compat: limpa AsyncStorage caso tenha legacy
      await AsyncStorage.removeItem(ACCESS_TOKEN_KEY).catch(() => {});
      await AsyncStorage.removeItem('@sync:user').catch(() => {});
    });
  },

  async saveAuth(data: AuthResponse): Promise<void> {
    invalidatePendingRefresh();
    await withSessionWriteLock(async () => {
      // Token sensível → SecureStore. Perfil → AsyncStorage.
      await secureStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      if (data.refreshToken) {
        await secureStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      } else {
        await secureStorage.removeItem(REFRESH_TOKEN_KEY);
      }
      if (data.refreshExpiresAt) {
        await secureStorage.setItem(REFRESH_EXPIRES_KEY, data.refreshExpiresAt);
      } else {
        await secureStorage.removeItem(REFRESH_EXPIRES_KEY);
      }
      await AsyncStorage.setItem('@sync:user', JSON.stringify(data.user));
    });
  },

  async getStoredUser() {
    const userStr = await AsyncStorage.getItem('@sync:user');
    let token = await secureStorage.getItem(ACCESS_TOKEN_KEY);
    // Fallback: migra de AsyncStorage se token antigo existir
    if (!token) {
      const legacy = await AsyncStorage.getItem(ACCESS_TOKEN_KEY).catch(() => null);
      if (legacy) {
        await secureStorage.setItem(ACCESS_TOKEN_KEY, legacy);
        await AsyncStorage.removeItem(ACCESS_TOKEN_KEY).catch(() => {});
        token = legacy;
      }
    }
    if (userStr && token) {
      return { user: JSON.parse(userStr), token };
    }
    return null;
  },
};
