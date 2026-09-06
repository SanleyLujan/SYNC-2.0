import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image as PrivateImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';
import { colors, fontSize, spacing, borderRadius } from '../../theme';
import { showToast } from '../../components/ui/Toast';
import { confirmAsync } from '../../utils/confirm';

export default function AdminPanelScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [dashboard, setDashboard] = useState<any>(null);
  const [reports, setReports] = useState<any>(null);
  const [moderation, setModeration] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
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
            {(moderation?.verifications || []).map((r: any) => (
              <View key={r.id} style={styles.item}>
                <Text style={styles.itemTitle}>{r.user?.name || 'Usuário'}</Text>
                <Text style={styles.itemSub}>Links privados expiram em 5 minutos</Text>
                <View style={styles.kycImages}>
                  <PrivateImage source={{ uri: r.images?.selfie }} style={styles.kycImage} cachePolicy="none" contentFit="cover" />
                  <PrivateImage source={{ uri: r.images?.documentFront }} style={styles.kycImage} cachePolicy="none" contentFit="cover" />
                  <PrivateImage source={{ uri: r.images?.documentBack }} style={styles.kycImage} cachePolicy="none" contentFit="cover" />
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.neutralBtn} onPress={() => review(`/admin/verifications/${r.id}`, { decision: 'reject', reason: 'As imagens não permitiram confirmar a identidade.' }, 'Recusar este pedido?')}>
                    <Text style={styles.neutralText}>Recusar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => review(`/admin/verifications/${r.id}`, { decision: 'approve' }, 'Confirmar que as imagens pertencem à mesma pessoa?')}>
                    <Text style={styles.approveText}>Aprovar selo</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {(moderation?.verifications || []).length === 0 && <Text style={styles.empty}>Nenhum pedido de verificação pendente.</Text>}
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
  empty: { color: 'rgba(255,255,255,0.45)', fontSize: 12, paddingVertical: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  neutralBtn: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  neutralText: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700' },
  dangerBtn: { flex: 1, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  dangerText: { color: '#F87171', fontSize: 11, fontWeight: '800' },
  approveBtn: { flex: 1, borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)', backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  approveText: { color: '#22C55E', fontSize: 11, fontWeight: '800' },
  postImage: { width: '100%', height: 140, borderRadius: 10, marginTop: spacing.sm },
  kycImages: { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
  kycImage: { flex: 1, height: 90, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
});
