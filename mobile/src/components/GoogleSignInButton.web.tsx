import React, { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme';

export default function GoogleSignInButton() {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  const frame = useRef<HTMLIFrameElement>(null);
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const initialize = () => frame.current?.contentWindow?.postMessage({
    type: 'sync-google-init', clientId, width: Math.min(400, frame.current?.clientWidth || 280),
  }, window.location.origin);
  useEffect(() => {
    if (!clientId) return;
    let active = true;
    const unavailable = () => setError('Google indisponível. Recarregue a página ou entre com email e senha.');
    const timer = window.setTimeout(unavailable, 15000);
    const receive = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const data = event.data;
      if (data?.type === 'sync-google-ready') { window.clearTimeout(timer); return; }
      if (data?.type === 'sync-google-error') { window.clearTimeout(timer); unavailable(); return; }
      if (data?.type !== 'sync-google-credential' || typeof data.credential !== 'string' || !data.credential || data.credential.length > 10000 || busy.current) return;
      busy.current = true;
      setLoading(true);
      setError('');
      try { await useAuthStore.getState().loginWithGoogle(data.credential); }
      catch (err: any) {
        if (active) {
          const message = err.response?.data?.message;
          setError(typeof message === 'string' ? message : 'Não foi possível entrar. Tente novamente.');
        }
      } finally { busy.current = false; if (active) setLoading(false); }
    };
    window.addEventListener('message', receive);
    initialize();
    return () => { active = false; window.clearTimeout(timer); window.removeEventListener('message', receive); };
  }, [clientId]);
  if (!clientId) return null;
  return (
    <View style={{ marginTop: 20, gap: 12, alignItems: 'center' }}>
      <Text style={{ color: colors.textSecondary }}>ou</Text>
      <iframe ref={frame} src="/google-signin.html" title="Entrar com Google" onLoad={initialize}
        allow="identity-credentials-get"
        style={{ width: '100%', maxWidth: 410, height: 48, border: 0, pointerEvents: loading ? 'none' : 'auto', opacity: loading ? 0.6 : 1 }} />
      {loading && <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>Entrando com Google…</Text>}
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.error, textAlign: 'center' }}>{error}</Text>}
    </View>
  );
}
