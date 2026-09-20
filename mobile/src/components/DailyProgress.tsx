import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useThemeStore } from '../store/themeStore';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { currentDailySnapshot, dailyDeadline } from '../utils/daily-progress';

export default function DailyProgress() {
  const theme = useThemeStore(s => s.theme);
  const userId = useAuthStore(s => s.user?.id);
  const [snapshot, setSnapshot] = useState<{ userId: string; expiresAt: number; data: any } | null>(null);
  const data = currentDailySnapshot(snapshot, userId, Date.now());
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    let busy = false;
    let expiresAt = Infinity;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    setSnapshot(null); setError(false);
    const load = async () => {
      if (busy || !userId || !active) return;
      busy = true;
      try {
        const result = await api.get('/gamification/me');
        if (active && userId === useAuthStore.getState().user?.id) {
          expiresAt = dailyDeadline(result.data, Date.now());
          if (expiresAt <= Date.now()) { setSnapshot(null); setError(true); return; }
          setSnapshot({ userId, expiresAt, data: result.data }); setError(false);
          if (resetTimer) clearTimeout(resetTimer);
          resetTimer = setTimeout(() => { if (active) { setSnapshot(null); void load(); } }, Math.max(1000, expiresAt-Date.now()));
        }
      } catch { if (active) { setSnapshot(null); setError(true); } }
      finally { busy = false; }
    };
    load();
    const timer = setInterval(load, 60_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') { if (Date.now() >= expiresAt) setSnapshot(null); void load(); }
    });
    return () => { active = false; clearInterval(timer); if (resetTimer) clearTimeout(resetTimer); subscription.remove(); };
  }, [retry, userId]));
  return <View style={{ margin: 16, padding: 16, gap: 10, borderRadius: 16, backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }}>
    <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 17 }}>Missões diárias</Text>
    {error ? <TouchableOpacity onPress={() => setRetry(n => n+1)}><Text style={{ color: theme.primary }}>Não foi possível carregar. Toque para tentar novamente.</Text></TouchableOpacity>
      : !data ? <ActivityIndicator color={theme.primary} /> : <>
        <Text style={{ color: theme.textPrimary }}>Nível {data.level} · {data.totalXP} XP</Text>
        <Text style={{ color: theme.textSecondary }}>{data.todayXP}/{data.dailyCap} XP hoje · {data.nextLevelXP-data.currentLevelXP} XP para o próximo nível</Text>
        {data.missions.map((m: any) => <View key={`${data.day}:${m.id}`} style={{ gap: 5 }}>
          <Text style={{ color: theme.textPrimary }}>{m.completed ? '✓ ' : '○ '}{m.title}</Text>
          <View style={{ height: 5, borderRadius: 3, backgroundColor: theme.border }}><View style={{ height: 5, borderRadius: 3, width: `${Math.min(100,m.progress/m.target*100)}%`, backgroundColor: theme.primary }} /></View>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{m.metric === 'duration' ? `${Math.floor(m.progress/60)}/${m.target/60} min` : `${(m.progress/1000).toFixed(1)}/${m.target/1000} km`}
            {m.completed ? ` · ${m.awardedXP} XP recebidos` : ` · até ${m.xp} XP`}</Text>
        </View>)}
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{data.todayXP >= data.dailyCap ? 'Limite de XP de hoje atingido. Seus próximos treinos continuam registrados.' : 'No seu ritmo. Descansar não tira XP. Atividades concluídas contam automaticamente.'}</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 11 }}>Missões de {data.day.split('-').reverse().join('/')} · Renovação à meia-noite de Brasília. A atividade conta no dia em que termina.</Text>
      </>}
  </View>;
}
