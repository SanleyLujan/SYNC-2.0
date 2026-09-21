import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { socketService } from '../services/socket.service';
import { isAppForeground, onAppForegroundChange } from '../services/app-foreground';

export function useChatPresence(matchId: string, userId: string) {
  const [snapshot, setSnapshot] = useState<{ matchId: string; userId: string; online: boolean } | null>(null);
  useFocusEffect(useCallback(() => {
    let mounted = true;
    let foreground = isAppForeground();
    let generation = 0;
    let busy = false;
    const clear = () => { generation++; busy = false; setSnapshot(null); };
    clear();
    const load = async () => {
      if (!mounted || !foreground || busy || socketService.getStatus() !== 'connected') return;
      busy = true;
      const requestGeneration = generation;
      try {
        const { data } = await api.get(`/chat/${matchId}/presence`, { timeout: 8000 });
        if (mounted && requestGeneration === generation) {
          setSnapshot(data?.userId === userId && typeof data.online === 'boolean' ? { matchId, userId, online: data.online } : null);
        }
      } catch {
        if (mounted && requestGeneration === generation) setSnapshot(null);
      } finally {
        if (requestGeneration === generation) busy = false;
      }
    };
    const unsubscribeStatus = socketService.onStatusChange(status => {
      if (status === 'connected') void load(); else clear();
    });
    const unsubscribeForeground = onAppForegroundChange(active => {
      foreground = active;
      clear();
      if (active) void load();
    });
    const timer = setInterval(() => { void load(); }, 10_000);
    return () => { mounted = false; generation++; clearInterval(timer); unsubscribeStatus(); unsubscribeForeground(); };
  }, [matchId, userId]));
  return snapshot?.matchId === matchId && snapshot.userId === userId ? snapshot.online : null;
}
