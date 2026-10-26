import { AppState, Platform } from 'react-native';

export function isAppForeground() {
  if (Platform.OS === 'web' && typeof document !== 'undefined') return document.visibilityState === 'visible';
  return AppState.currentState === 'active';
}

export function onAppForegroundChange(listener: (active: boolean) => void) {
  const update = () => listener(isAppForeground());
  const subscription = AppState.addEventListener('change', update);
  const hidden = () => listener(false);
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', update);
    document.addEventListener('freeze', hidden);
    document.addEventListener('resume', update);
    window.addEventListener('pagehide', hidden);
    window.addEventListener('pageshow', update);
  }
  return () => {
    subscription.remove();
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', update);
      document.removeEventListener('freeze', hidden);
      document.removeEventListener('resume', update);
      window.removeEventListener('pagehide', hidden);
      window.removeEventListener('pageshow', update);
    }
  };
}
