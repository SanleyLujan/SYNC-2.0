import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VerificationReviewCard from '../../components/VerificationReviewCard';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';
import { fontSize, spacing, borderRadius } from '../../theme';
import { AppTheme } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { TAB_BAR_HEIGHT } from '../../navigation/MainTabNavigator';
import { showToast } from '../../components/ui/Toast';
import { confirmAsync } from '../../utils/confirm';

export default function AdminPanelScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [reports, setReports] = useState<any>(null);
  const [moderation, setModeration] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [d, r, m] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/reports', { params: { days: 30 } }),
        api.get('/admin/moderation'),
      ]);
      setDashboard(d.data);
      setReports(r.data);
      setModeration(m.data);
    } catch (e: any) {
      setLoadError(true);
      setModeration(null);
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
    ['Posts denunciados', metrics.postReportsCount],
    ['Verificações', metrics.verificationCount],
    ['Feedbacks', metrics.feedbackCount],
    ['Atividades', metrics.activitiesCount],
    ['Posts', metrics.postsCount],
  ];

  const review = async (path: string, body: any, prompt: string, destructive = false) => {
    const ok = await confirmAsync('Confirmar ação?', prompt, { confirmText: 'Confirmar', destructive });
    if (!ok) return;
    try {
      await api.put(path, body);
      showToast('Ação administrativa registrada.', 'success');
      await load();
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Não foi possível concluir a ação.', 'error');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + spacing.lg }}>
      <LinearGradient colors={[theme.surfaceElevated, theme.surface, theme.background]} style={[styles.header, { paddingTop: Math.max(insets.top + 10, 28) }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => navigation?.goBack?.()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Admin</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Atualizar painel administrativo" onPress={load} style={styles.backBtn}>
          <Ionicons name="refresh" size={18} color={theme.textPrimary} />
        </TouchableOpacity>
      </LinearGradient>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : loadError ? (
        <View style={styles.section}>
          <Text style={styles.itemText}>Não foi possível carregar o painel. A fila não está disponível para análise.</Text>
          <TouchableOpacity style={styles.neutralBtn} onPress={load}><Text style={styles.neutralText}>Tentar novamente</Text></TouchableOpacity>
        </View>
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
            <Text style={styles.sectionTitle}>Contas denunciadas · pendentes</Text>
            {(moderation?.userReports || []).map((r: any) => (
              <View key={r.id} style={styles.item}>
                <Text style={styles.itemTitle}>{r.reported?.name || 'Conta'} · {r.reason}</Text>
                <Text style={styles.itemSub}>Denunciado por {r.reporter?.name || 'usuário'}</Text>
                {!!r.description && <Text style={styles.itemText}>{r.description}</Text>}
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.neutralBtn} onPress={() => review(`/admin/user-reports/${r.id}`, { decision: 'dismiss' }, 'Descartar esta denúncia?')}>
                    <Text style={styles.neutralText}>Descartar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dangerBtn} onPress={() => review(`/admin/user-reports/${r.id}`, { decision: 'deactivate' }, 'Desativar esta conta? Ela perderá o acesso ao app.', true)}>
                    <Text style={styles.dangerText}>Desativar conta</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {(moderation?.userReports || []).length === 0 && <Text style={styles.empty}>Nenhuma denúncia de conta pendente.</Text>}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Posts denunciados · pendentes</Text>
            {(moderation?.postReports || []).map((r: any) => (
              <View key={r.id} style={styles.item}>
                <Text style={styles.itemTitle}>{r.post?.author?.name || 'Publicação'} · {r.reason}</Text>
                {!!r.post?.caption && <Text style={styles.itemText}>{r.post.caption}</Text>}
                {!!r.post?.photoUrl && <Image source={{ uri: r.post.photoUrl }} style={styles.postImage} />}
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.neutralBtn} onPress={() => review(`/admin/post-reports/${r.id}`, { decision: 'dismiss' }, 'Descartar esta denúncia?')}>
                    <Text style={styles.neutralText}>Descartar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dangerBtn} onPress={() => review(`/admin/post-reports/${r.id}`, { decision: 'remove' }, 'Remover definitivamente esta publicação?', true)}>
                    <Text style={styles.dangerText}>Remover post</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {(moderation?.postReports || []).length === 0 && <Text style={styles.empty}>Nenhum post denunciado pendente.</Text>}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Verificação de perfis · pendentes</Text>
            <Text style={[styles.itemText, moderation?.verificationStorage?.available === false && styles.dangerText]}>{moderation?.verificationStorage?.message}</Text>
            {!!moderation?.verificationError && <Text accessibilityRole="alert" style={styles.dangerText}>{moderation.verificationError}</Text>}
            {(moderation?.verifications || []).map((r: any) => <VerificationReviewCard key={r.id} request={r} onReviewed={() => void load()} onRefresh={() => void load()} />)}
            {!moderation?.verificationError && (moderation?.verifications || []).length === 0 && <Text style={styles.empty}>Nenhum pedido de verificação pendente.</Text>}
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

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.surfaceSecondary, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  title: { color: theme.textPrimary, fontSize: fontSize.xl, fontWeight: '900' },
  loading: { paddingTop: 120, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md },
  metricCard: { flexGrow: 1, flexBasis: '45%', backgroundColor: theme.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: theme.border, borderTopWidth: 3, borderTopColor: theme.primary, padding: spacing.md },
  metricValue: { color: theme.mode === 'light' ? '#A83246' : theme.primary, fontSize: 24, fontWeight: '900' },
  metricLabel: { color: theme.textSecondary, fontSize: 12, marginTop: 4 },
  section: { marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: theme.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: theme.border, padding: spacing.md },
  sectionTitle: { color: theme.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: spacing.sm },
  line: { color: theme.textSecondary, fontSize: 13, marginBottom: 6 },
  item: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: theme.divider },
  itemTitle: { color: theme.textPrimary, fontSize: 13, fontWeight: '800' },
  itemSub: { color: theme.textSecondary, fontSize: 11, marginTop: 2 },
  itemText: { color: theme.textSecondary, fontSize: 12, marginTop: 6 },
  empty: { color: theme.textSecondary, fontSize: 12, paddingVertical: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  neutralBtn: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceSecondary, borderRadius: 10, padding: 10, alignItems: 'center', justifyContent: 'center' },
  neutralText: { color: theme.textPrimary, fontSize: 11, fontWeight: '700' },
  dangerBtn: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: theme.danger, backgroundColor: theme.dangerSoft, borderRadius: 10, padding: 10, alignItems: 'center', justifyContent: 'center' },
  dangerText: { color: theme.mode === 'light' ? '#B91C1C' : '#FCA5A5', fontSize: 11, fontWeight: '800' },
  postImage: { width: '100%', height: 140, borderRadius: 10, marginTop: spacing.sm },
});
