import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useThemeStore } from '../store/themeStore';
import api from '../services/api';

export default function DailyProgress() {
  const theme = useThemeStore(s => s.theme);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    let busy = false;
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const result = await api.get('/gamification/me');
        if (active) { setData(result.data); setError(false); }
      } catch { if (active) { setData(null); setError(true); } }
      finally { busy = false; }
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => { active = false; clearInterval(timer); };
  }, [retry]));
  return <View style={{ margin: 16, padding: 16, gap: 10, borderRadius: 16, backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }}>
    <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 17 }}>Missões diárias</Text>
    {error ? <TouchableOpacity onPress={() => setRetry(n => n+1)}><Text style={{ color: theme.primary }}>Não foi possível carregar. Toque para tentar novamente.</Text></TouchableOpacity>
      : !data ? <ActivityIndicator color={theme.primary} /> : <>
        <Text style={{ color: theme.textPrimary }}>Nível {data.level} · {data.totalXP} XP</Text>
        <Text style={{ color: theme.textSecondary }}>{data.todayXP}/{data.dailyCap} XP hoje · {data.nextLevelXP-data.currentLevelXP} XP para o próximo nível</Text>
        {data.missions.map((m: any) => <View key={m.id} style={{ gap: 5 }}>
          <Text style={{ color: theme.textPrimary }}>{m.completed ? '✓ ' : '○ '}{m.title}</Text>
          <View style={{ height: 5, borderRadius: 3, backgroundColor: theme.border }}><View style={{ height: 5, borderRadius: 3, width: `${Math.min(100,m.progress/m.target*100)}%`, backgroundColor: theme.primary }} /></View>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{m.metric === 'duration' ? `${Math.floor(m.progress/60)}/${m.target/60} min` : `${(m.progress/1000).toFixed(1)}/${m.target/1000} km`}
            {m.completed ? ` · ${m.awardedXP} XP recebidos` : ` · até ${m.xp} XP`}</Text>
        </View>)}
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{data.todayXP >= data.dailyCap ? 'Limite de XP de hoje atingido. Seus próximos treinos continuam registrados.' : 'No seu ritmo. Descansar não tira XP. Atividades concluídas contam automaticamente.'}</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 11 }}>Renovação à meia-noite de Brasília. A atividade conta no dia em que termina.</Text>
      </>}
  </View>;
}
