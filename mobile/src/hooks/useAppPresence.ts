import { useEffect } from 'react';
import { socketService } from '../services/socket.service';
import { isAppForeground, onAppForegroundChange } from '../services/app-foreground';

export function useAppPresence(userId: string | null) {
  useEffect(() => {
    if (!userId) { socketService.disconnect(); return; }
    socketService.setAppActive(isAppForeground());
    const unsubscribe = onAppForegroundChange(active => socketService.setAppActive(active));
    return () => { unsubscribe(); socketService.disconnect(); };
  }, [userId]);
}
