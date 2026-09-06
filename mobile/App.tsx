import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform } from 'react-native';
import { View, Text, TouchableOpacity } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';
import LiveViewScreen from './src/screens/Live/LiveViewScreen';
import VerifyEmailScreen from './src/screens/Auth/VerifyEmailScreen';
import ResetPasswordScreen from './src/screens/Auth/ResetPasswordScreen';
import ToastHost from './src/components/ui/Toast';
import AccessibilityEffects from './src/components/AccessibilityEffects';
import ConnectionBanner from './src/components/ConnectionBanner';
import ErrorBoundary from './src/components/ErrorBoundary';
import { colors, borderRadius } from './src/theme';
import { useThemeStore } from './src/store/themeStore';

// Fallback global: se QUALQUER tela quebrar no render, mostra isto em vez de
// uma tela branca. No web dá pra recarregar; no nativo o botão tenta reabrir.
function GlobalCrashFallback() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 40, marginBottom: 12 }}>🛠️</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
        Algo deu errado por aqui
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
        Tivemos um problema ao exibir esta parte do app. Tente recarregar.
      </Text>
      <TouchableOpacity
        onPress={() => { if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.reload(); }}
        style={{ marginTop: 24, backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: borderRadius.md }}
        accessibilityRole="button"
        accessibilityLabel="Recarregar o app"
      >
        <Text style={{ color: colors.primaryText, fontWeight: '600', fontSize: 15 }}>Recarregar</Text>
      </TouchableOpacity>
    </View>
  );
}

// PWA: registra service worker no web
function registerServiceWorker() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then(() => console.log('[Sync] Service Worker registrado'))
        .catch((err) => console.warn('[Sync] SW failed:', err));
    });
  }
}

// Detecta rota pública /live/:token no web e renderiza só a tela de live
function getLiveToken(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/^\/live\/([a-z0-9_-]+)\/?$/i);
  return m?.[1] || null;
}

function getEmailVerificationToken(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (!window.location.pathname.match(/^\/verify-email\/?$/i)) return null;
  return new URLSearchParams(window.location.search).get('token');
}

function getPasswordResetToken(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (!window.location.pathname.match(/^\/reset-password\/?$/i)) return null;
  return new URLSearchParams(window.location.search).get('token');
}

export default function App() {
  const theme = useThemeStore((s) => s.theme);
  const loadTheme = useThemeStore((s) => s.loadTheme);
  const liveToken = getLiveToken();
  const emailVerificationToken = getEmailVerificationToken();
  const passwordResetToken = getPasswordResetToken();

  useEffect(() => {
    loadTheme();
    registerServiceWorker();
  }, [loadTheme]);

  if (liveToken) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
        <LiveViewScreen token={liveToken} />
      </GestureHandlerRootView>
    );
  }

  if (emailVerificationToken) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
        <VerifyEmailScreen token={emailVerificationToken} />
        <ToastHost />
      </GestureHandlerRootView>
    );
  }


  if (passwordResetToken) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
        <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
        <ResetPasswordScreen token={passwordResetToken} />
        <ToastHost />
      </GestureHandlerRootView>
    );
  }

  // No web, centraliza o app numa coluna estilo celular (maxWidth) pra não
  // esticar de ponta a ponta no desktop. No nativo, ocupa a tela toda.
  const isWeb = Platform.OS === 'web';

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        style={
          isWeb
            ? { flex: 1, alignItems: 'center', backgroundColor: theme.background }
            : { flex: 1 }
        }
      >
        <View
          style={
            isWeb
              ? { flex: 1, width: '100%', maxWidth: 480, backgroundColor: theme.background, overflow: 'hidden' }
              : { flex: 1 }
          }
        >
          <NavigationContainer documentTitle={{ formatter: () => 'Sync' }}>
            <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
            <AccessibilityEffects />
            <ConnectionBanner />
            <ErrorBoundary fallback={<GlobalCrashFallback />}>
              <RootNavigator />
            </ErrorBoundary>
            <ToastHost />
          </NavigationContainer>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}
