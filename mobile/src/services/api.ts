import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { secureStorage } from './secure-storage';

const ACCESS_TOKEN_KEY = '@sync:token';
const REFRESH_TOKEN_KEY = '@sync:refresh-token';
const REFRESH_EXPIRES_KEY = '@sync:refresh-expires-at';

// URL do backend de produção (Render). É o DEFAULT quando não há env var,
// pra garantir que o app funcione em qualquer lugar (deploy, celular, preview)
// sem depender de configuração extra.
const PROD_API = 'https://sync-backend-o2zc.onrender.com';

// Ordem de resolução da base da API:
// 1. EXPO_PUBLIC_API_URL (injetada no build) — sobrepõe tudo.
// 2. Dev local explícito: web em localhost:8081 OU nativo em dev → localhost:3000.
// 3. Qualquer outro caso (deploy web, celular, preview) → produção (Render).
const getApiBase = () => {
  const env = (process.env.EXPO_PUBLIC_API_URL || '').trim();
  if (env) {
    const normalized = env.replace(/\/$/, '');
    return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Só usa backend local quando explicitamente rodando backend em localhost.
    // (o preview Expo Web roda em localhost mas NAO tem backend local, entao
    //  apontamos pra produção pra funcionar de imediato.)
    if (host === '127.0.0.1') {
      return `${window.location.protocol}//${host}:3000/api`;
    }
    return PROD_API + '/api';
  }
  // Nativo sem env var -> producao (antes caia em localhost:3000 e falhava no
  // celular, pois localhost no device é o próprio aparelho).
  return PROD_API + '/api';
};

export const API_URL = getApiBase();
// Base sem o /api — usado por sockets e static (avatars)
export const API_HOST = API_URL.replace(/\/api$/, '');
export const WEB_APP_URL = (process.env.EXPO_PUBLIC_WEB_URL || 'https://sync-2-0-blush.vercel.app')
  .trim()
  .replace(/\/$/, '');

// O Render pode levar cerca de um minuto para iniciar o serviço após um
// período ocioso. Esta chamada GET acorda a API antes de operações POST que
// não podem ser repetidas com segurança, como cadastro e login.
export async function ensureApiAvailable(): Promise<void> {
  await axios.get(`${API_URL}/health`, { timeout: 75_000 });
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: adiciona token JWT em todas as requisições.
// SECURITY: lê APENAS do SecureStore (Keychain/EncryptedSharedPreferences).
// Em web, secureStorage usa um wrapper sobre localStorage com prefixo.
api.interceptors.request.use(async (config) => {
  const token = await secureStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Migração: se ainda houver token em AsyncStorage (legacy), move pro SecureStore e remove
  if (!token) {
    const legacy = await AsyncStorage.getItem(ACCESS_TOKEN_KEY).catch(() => null);
    if (legacy) {
      await secureStorage.setItem(ACCESS_TOKEN_KEY, legacy).catch(() => {});
      await AsyncStorage.removeItem(ACCESS_TOKEN_KEY).catch(() => {});
      config.headers.Authorization = `Bearer ${legacy}`;
    }
  }
  return config;
});

// Callback registrado pelo authStore — disparado quando a sessão expira, pra
// mandar o usuário de volta ao login (em vez de deixá-lo preso numa tela
// fazendo chamadas que sempre falham). Evita import circular (api ↔ store).
let sessionExpiredHandler: (() => void) | null = null;
export function setSessionExpiredHandler(fn: (() => void) | null) {
  sessionExpiredHandler = fn;
}

async function clearStoredSession() {
  await Promise.all([
    secureStorage.removeItem(ACCESS_TOKEN_KEY),
    secureStorage.removeItem(REFRESH_TOKEN_KEY),
    secureStorage.removeItem(REFRESH_EXPIRES_KEY),
    AsyncStorage.removeItem(ACCESS_TOKEN_KEY).catch(() => {}),
    AsyncStorage.removeItem('@sync:user').catch(() => {}),
  ]);
  sessionExpiredHandler?.();
}

let refreshPromise: Promise<string> | null = null;
let sessionGeneration = 0;
export function invalidatePendingRefresh() { sessionGeneration++; }
let sessionWriteQueue: Promise<unknown> = Promise.resolve();
export function withSessionWriteLock<T>(write: () => Promise<T>): Promise<T> {
  const operation = sessionWriteQueue.then(write);
  sessionWriteQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

class InvalidSessionError extends Error {}

async function refreshAccessToken(expectedAccess: string | null): Promise<string> {
  if (refreshPromise) return refreshPromise;
  const renew = async () => {
    const generation = sessionGeneration;
    const latestAccess = await secureStorage.getItem(ACCESS_TOKEN_KEY);
    if (latestAccess && expectedAccess && latestAccess !== expectedAccess) return latestAccess;
    const refreshToken = await secureStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) throw new InvalidSessionError('Refresh token ausente');

    const { data } = await axios.post(
      `${API_URL}/auth/refresh`,
      { refreshToken },
      { timeout: 30_000, headers: { 'Content-Type': 'application/json' } },
    );
    if (!data?.accessToken || !data?.refreshToken) {
      throw new Error('Resposta de renovação inválida');
    }
    await withSessionWriteLock(async () => {
      if (generation !== sessionGeneration || await secureStorage.getItem(REFRESH_TOKEN_KEY) !== refreshToken) {
        throw new Error('Sessão alterada durante a renovação');
      }
      await secureStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      await secureStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      if (data.refreshExpiresAt) {
        await secureStorage.setItem(REFRESH_EXPIRES_KEY, String(data.refreshExpiresAt));
      }
    });
    return data.accessToken as string;
  };
  // PWA/abas da mesma origem compartilham storage. Web Locks evita que duas
  // abas consumam simultaneamente o mesmo refresh; cada uma relê após o lock.
  const pending = (async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.locks) {
      return await navigator.locks.request('sync-session-refresh', renew);
    }
    return await renew();
  })();
  refreshPromise = pending;

  try {
    return await pending;
  } finally {
    refreshPromise = null;
  }
}

// Interceptor: trata erros globalmente.
// Qualquer recurso protegido pode renovar o access token. Só uma recusa
// definitiva do refresh encerra a sessão; timeout/5xx preservam o login local.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config: any = error.config || {};
    const url: string = config.url || '';

    // Cold start do Render Free: a 1ª request pode demorar a responder
    // e estoura timeout/erro de rede. Tenta UMA vez de novo em GET idempotente
    // — assim o app não mostra "erro" só porque o backend estava acordando.
    const isNetworkOrTimeout = !error.response; // timeout ECONNABORTED ou rede
    const isGet = (config.method || 'get').toLowerCase() === 'get';
    if (isNetworkOrTimeout && isGet && !config._retried) {
      config._retried = true;
      await new Promise((r) => setTimeout(r, 1500));
      return api(config);
    }

    const publicAuthPaths = [
      '/auth/login',
      '/auth/register',
      '/auth/google',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/refresh',
      '/auth/logout',
      '/auth/verify-email',
      '/auth/verify-email-code',
      '/auth/request-verification',
    ];
    const isPublicAuthRequest = publicAuthPaths.some((path) => url.includes(path));

    if (error.response?.status === 401 && !isPublicAuthRequest && !config._authRetried) {
      config._authRetried = true;
      const generation = sessionGeneration;
      try {
        const current = await secureStorage.getItem(ACCESS_TOKEN_KEY);
        const sent = config.headers?.Authorization;
        // Um 401 atrasado pode pertencer ao access anterior, já renovado.
        const accessToken = current && sent && sent !== `Bearer ${current}`
          ? current : await refreshAccessToken(current);
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${accessToken}`;
        return api(config);
      } catch (refreshError: any) {
        if (refreshError instanceof InvalidSessionError || refreshError?.response?.status === 401) {
          await withSessionWriteLock(async () => {
            if (generation !== sessionGeneration) return;
            invalidatePendingRefresh();
            await clearStoredSession();
          });
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
