import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';
import { colors, fontSize, spacing, borderRadius } from '../../theme';
import { showToast } from '../../components/ui/Toast';

export default function AdminPanelScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [dashboard, setDashboard] = useState<any>(null);
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [d, r] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/reports', { params: { days: 30 } }),
      ]);
      setDashboard(d.data);
      setReports(r.data);
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Acesso admin indisponível', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const metrics = dashboard?.metrics || {};
  const metricItems = [
    ['Usuários', metrics.usersCount],
    ['Ativos', metrics.activeUsers],
    ['Denúncias', metrics.reportsCount],
    ['Feedbacks', metrics.feedbackCount],
    ['Atividades', metrics.activitiesCount],
    ['Posts', metrics.postsCount],
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
      <LinearGradient colors={['#15152E', '#0E0E1E', '#0A0A0F']} style={[styles.header, { paddingTop: Math.max(insets.top + 10, 48) }]}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Admin</Text>
        <TouchableOpacity onPress={load} style={styles.backBtn}>
          <Ionicons name="refresh" size={18} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color="#FF6B35" /></View>
      ) : (
        <>
          <View style={styles.grid}>
            {metricItems.map(([label, value]) => (
              <View key={label as string} style={styles.metricCard}>
                <Text style={styles.metricValue}>{String(value ?? 0)}</Text>
                <Text style={styles.metricLabel}>{label}</Text>
              </View>
            ))}
          </View>

          {reports && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Relatório 30 dias</Text>
              <Text style={styles.line}>Novos usuários: {reports.usage?.newUsers ?? 0}</Text>
              <Text style={styles.line}>Treinos concluídos: {reports.usage?.completedActivities ?? 0}</Text>
              <Text style={styles.line}>Posts no feed: {reports.engagement?.feedPosts ?? 0}</Text>
              <Text style={styles.line}>Mensagens: {reports.engagement?.chatMessages ?? 0}</Text>
              <Text style={styles.line}>Denúncias: {reports.safety?.securityReports ?? 0}</Text>
              <Text style={styles.line}>Chamados de suporte: {reports.safety?.supportTickets ?? 0}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Denúncias recentes</Text>
            {(dashboard?.recentReports || []).map((r: any) => (
              <View key={r.id} style={styles.item}>
                <Text style={styles.itemTitle}>{r.reason}</Text>
                <Text style={styles.itemSub}>{r.reporter?.name || 'Usuário'} denunciou {r.reported?.name || 'perfil'}</Text>
                {!!r.description && <Text style={styles.itemText}>{r.description}</Text>}
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Suporte e feedback</Text>
            {(dashboard?.recentFeedback || []).map((f: any) => (
              <View key={f.id} style={styles.item}>
                <Text style={styles.itemTitle}>{f.type} · {f.status || 'new'}</Text>
                <Text style={styles.itemSub}>{f.user?.name || 'Usuário'}</Text>
                <Text style={styles.itemText}>{f.message}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: fontSize.xl, fontWeight: '900' },
  loading: { paddingTop: 120, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md },
  metricCard: { width: '48%', backgroundColor: 'rgba(255,255,255,0.055)', borderRadius: borderRadius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: spacing.md },
  metricValue: { color: '#FF6B35', fontSize: 24, fontWeight: '900' },
  metricLabel: { color: colors.dark.secondaryText, fontSize: 12, marginTop: 4 },
  section: { marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: 'rgba(255,255,255,0.045)', borderRadius: borderRadius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: spacing.md },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: spacing.sm },
  line: { color: 'rgba(255,255,255,0.72)', fontSize: 13, marginBottom: 6 },
  item: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  itemTitle: { color: '#fff', fontSize: 13, fontWeight: '800' },
  itemSub: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },
  itemText: { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 6 },
});
