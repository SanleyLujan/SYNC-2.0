import React, { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme';

type GoogleIdentity = {
  initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void; auto_select: boolean }) => void;
  renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
};
const identity = () => (window as unknown as { google?: { accounts?: { id?: GoogleIdentity } } }).google?.accounts?.id;
let scriptPromise: Promise<GoogleIdentity> | undefined;
function loadGoogle(): Promise<GoogleIdentity> {
  const ready = identity();
  if (ready) return Promise.resolve(ready);
  if (!scriptPromise) {
    scriptPromise = new Promise<GoogleIdentity>((resolve, reject) => {
      const script = document.createElement('script');
      const fail = () => { script.remove(); reject(new Error('Google indisponível. Recarregue a página ou entre com email e senha.')); };
      const timer = window.setTimeout(fail, 15000);
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => { window.clearTimeout(timer); const api = identity(); if (api) resolve(api); else fail(); };
      script.onerror = () => { window.clearTimeout(timer); fail(); };
      document.head.appendChild(script);
    }).catch(error => { scriptPromise = undefined; throw error; });
  }
  return scriptPromise;
}

export default function GoogleSignInButton() {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  const host = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!clientId) return;
    let active = true;
    loadGoogle().then(api => {
      if (!active || !host.current) return;
      api.initialize({ client_id: clientId, auto_select: false, callback: async response => {
        if (!active || busy.current) return;
        if (!response.credential) { setError('Não foi possível concluir o login com Google.'); return; }
        busy.current = true;
        setLoading(true);
        setError('');
        try { await useAuthStore.getState().loginWithGoogle(response.credential); }
        catch (err: any) {
          if (active) {
            const message = err.response?.data?.message;
            setError(typeof message === 'string' ? message : 'Não foi possível entrar. Tente novamente.');
          }
        } finally { busy.current = false; if (active) setLoading(false); }
      } });
      api.renderButton(host.current, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', locale: 'pt-BR', width: Math.min(400, host.current.clientWidth || 280) });
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [clientId]);
  if (!clientId) return null;
  return (
    <View style={{ marginTop: 20, gap: 12, alignItems: 'center' }}>
      <Text style={{ color: colors.textSecondary }}>ou</Text>
      <div ref={host} style={{ width: '100%', display: 'flex', justifyContent: 'center', pointerEvents: loading ? 'none' : 'auto', opacity: loading ? 0.6 : 1 }} />
      {loading && <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>Entrando com Google…</Text>}
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.error, textAlign: 'center' }}>{error}</Text>}
    </View>
  );
}
