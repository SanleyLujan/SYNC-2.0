// Detalhe do grupo: header, total de km (soma dos membros), entrar/sair,
// e lista de membros rankeada por km contribuído.
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image'; // recorta avatar no círculo (web + nativo)
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { fontSize, spacing, borderRadius } from '../../theme';
import { AppTheme } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { groupsApi, GroupSummary, GroupJoinRequest } from '../../services/groups.service';
import { useAuthStore } from '../../store/authStore';
import { showToast } from '../../components/ui/Toast';
import { confirmAsync } from '../../utils/confirm';

interface Member {
  id: string;
  role: 'admin' | 'member';
  contributedKm: number;
  contributedActivities?: number;
  user: { id: string; name: string; avatarUrl?: string; city?: string } | null;
}

const MEDAL = ['🥇', '🥈', '🥉'];

export default function GroupDetailScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((state) => state.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { groupId, groupName } = route.params as { groupId: string; groupName?: string };
  const currentUser = useAuthStore((s) => s.user);

  const [group, setGroup] = useState<GroupSummary | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<GroupJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [g, m] = await Promise.all([
        groupsApi.detail(groupId).catch(() => null),
        groupsApi.members(groupId).catch(() => []),
      ]);
      if (g) setGroup(g);
      setMembers((m as Member[]) || []);
      if (g?.admin_id === currentUser?.id) {
        setRequests(await groupsApi.requests(groupId).catch(() => []));
      } else {
        setRequests([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId, currentUser?.id]);

  useEffect(() => { load(); }, [load]);

  const isMember = members.some((m) => m.user?.id === currentUser?.id);
  const isAdmin = group?.admin_id === currentUser?.id;
  const requestPending = group?.joinRequestStatus === 'pending';

  const handleJoin = async () => {
    setBusy(true);
    try {
      const result = group?.isPrivate ? await groupsApi.requestJoin(groupId) : await groupsApi.join(groupId);
      showToast(result?.status === 'pending' ? 'Solicitação enviada ao admin.' : 'Você entrou no grupo!', 'success');
      await load(true);
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Não foi possível entrar', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestDecision = async (requestId: string, approve: boolean) => {
    setBusy(true);
    try {
      if (approve) await groupsApi.approveRequest(groupId, requestId);
      else await groupsApi.rejectRequest(groupId, requestId);
      showToast(approve ? 'Membro aprovado.' : 'Solicitação recusada.', 'success');
      await load(true);
    } catch {
      showToast('Não foi possível atualizar a solicitação.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (member: Member) => {
    const ok = await confirmAsync('Remover membro?', `${member.user?.name || 'Este atleta'} sairá do grupo.`, {
      confirmText: 'Remover', destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await groupsApi.removeMember(groupId, member.id);
      showToast('Membro removido.', 'success');
      await load(true);
    } catch {
      showToast('Erro ao remover membro.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    const ok = await confirmAsync('Sair do grupo?', 'Seus km contribuídos permanecem no histórico do grupo.', {
      confirmText: 'Sair', destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await groupsApi.leave(groupId);
      showToast('Você saiu do grupo', 'info');
      await load(true);
    } catch {
      showToast('Erro ao sair', 'error');
    } finally {
      setBusy(false);
    }
  };

  const renderMember = ({ item, index }: { item: Member; index: number }) => {
    const isMe = item.user?.id === currentUser?.id;
    return (
      <View style={[styles.memberRow, isMe && styles.memberRowMe]}>
        <View style={styles.rankWrap}>
          {index < 3 ? (
            <Text style={styles.medal}>{MEDAL[index]}</Text>
          ) : (
            <Text style={styles.rankNum}>{index + 1}</Text>
          )}
        </View>
        {item.user?.avatarUrl ? (
          <Image source={{ uri: item.user.avatarUrl }} style={styles.memberAvatar} />
        ) : (
          <View style={[styles.memberAvatar, styles.memberAvatarFallback]}>
            <Text style={styles.memberInitial}>{item.user?.name?.[0]?.toUpperCase() || '?'}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.memberName} numberOfLines={1}>
              {item.user?.name || 'Atleta'}{isMe ? ' (você)' : ''}
            </Text>
            {item.role === 'admin' && (
              <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>ADMIN</Text></View>
            )}
          </View>
          {item.contributedActivities != null && (
            <Text style={styles.memberSub}>{item.contributedActivities} atividades</Text>
          )}
        </View>
        <Text style={styles.memberKm}>{(item.contributedKm || 0).toFixed(1)} km</Text>
        {isAdmin && item.role !== 'admin' && (
          <TouchableOpacity
            style={styles.removeMemberBtn}
            onPress={() => handleRemoveMember(item)}
            disabled={busy}
            accessibilityLabel={`Remover ${item.user?.name || 'membro'}`}
          >
            <Ionicons name="close" size={16} color={theme.danger} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderRequest = (item: GroupJoinRequest) => (
    <View key={item.id} style={styles.requestRow}>
      <View style={styles.requestInfo}>
        <Text style={styles.requestName}>{item.user?.name || 'Atleta'}</Text>
        <Text style={styles.requestSub}>Solicitou entrada</Text>
      </View>
      <TouchableOpacity style={styles.approveBtn} onPress={() => handleRequestDecision(item.id, true)} disabled={busy}>
        <Ionicons name="checkmark" size={16} color={theme.primaryText} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRequestDecision(item.id, false)} disabled={busy}>
        <Ionicons name="close" size={16} color={theme.primaryText} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.mode === 'dark'
          ? [theme.surfaceSecondary, theme.surface, theme.background]
          : [theme.surface, theme.surfaceSecondary, theme.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.header, { paddingTop: Math.max(insets.top + 12, 56) }]}
      >
        <TouchableOpacity onPress={() => navigation?.goBack?.()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{group?.name || groupName || 'Grupo'}</Text>
        <View style={{ width: 38 }} />
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.id}
          renderItem={renderMember}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={theme.primary} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListHeaderComponent={
            <View>
              {/* Hero */}
              <View style={styles.hero}>
                <LinearGradient colors={theme.gradientPrimary} style={styles.heroAvatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={styles.heroLetter}>{(group?.name || 'G')[0]?.toUpperCase()}</Text>
                </LinearGradient>
                {group?.description ? <Text style={styles.heroDesc}>{group.description}</Text> : null}
                <View style={styles.heroMetaRow}>
                  {group?.sport ? <Text style={styles.heroMeta}>🏃 {group.sport}</Text> : null}
                  {group?.city ? <Text style={styles.heroMeta}>📍 {group.city}</Text> : null}
                  {group?.isPrivate ? <Text style={styles.heroMeta}>🔒 Privado</Text> : null}
                </View>

                {/* Stats */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{Math.round(group?.totalDistanceKm || 0)}</Text>
                    <Text style={styles.statLabel}>km do grupo</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{group?.memberCount ?? members.length}</Text>
                    <Text style={styles.statLabel}>membros</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{group?.totalActivities ?? 0}</Text>
                    <Text style={styles.statLabel}>atividades</Text>
                  </View>
                </View>

                {/* Join / Leave */}
                {isMember ? (
                  <TouchableOpacity style={[styles.actionBtn, styles.leaveBtn]} onPress={handleLeave} disabled={busy}>
                    {busy ? <ActivityIndicator size="small" color={theme.danger} /> : (
                      <><Ionicons name="exit-outline" size={18} color={theme.danger} /><Text style={styles.leaveText}>Sair do grupo</Text></>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.actionBtn} onPress={handleJoin} disabled={busy || requestPending} activeOpacity={0.85}>
                    <LinearGradient colors={theme.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.joinGradient}>
                      {busy ? <ActivityIndicator size="small" color={theme.primaryText} /> : (
                        <><Ionicons name={requestPending ? 'time-outline' : group?.isPrivate ? 'mail-outline' : 'add'} size={18} color={theme.primaryText} /><Text style={styles.joinText}>{requestPending ? 'Solicitação pendente' : group?.isPrivate ? 'Solicitar entrada' : 'Entrar no grupo'}</Text></>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>

              {isAdmin && requests.length > 0 && (
                <View style={styles.requestsBox}>
                  <Text style={styles.requestsTitle}>Solicitações pendentes</Text>
                  {requests.map(renderRequest)}
                </View>
              )}

              <View style={styles.membersHeader}>
                <Ionicons name="trophy" size={16} color="#FCD34D" />
                <Text style={styles.membersTitle}>Ranking de membros</Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={40} color={theme.textMuted} />
              <Text style={styles.emptyText}>Ainda sem membros com km registrados.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: theme.divider, borderWidth: 1, borderColor: theme.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: fontSize.lg, fontWeight: '800', color: theme.textPrimary },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hero: { alignItems: 'center', padding: spacing.lg, gap: spacing.sm },
  heroAvatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  heroLetter: { color: theme.primaryText, fontSize: 32, fontWeight: '900' },
  heroDesc: { color: theme.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 4 },
  heroMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  heroMeta: { color: theme.textSecondary, fontSize: 12 },

  statsRow: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch',
    backgroundColor: theme.surface, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: theme.divider,
    paddingVertical: spacing.md, marginTop: spacing.sm,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { color: theme.primary, fontSize: 22, fontWeight: '900' },
  statLabel: { color: theme.textSecondary, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: theme.divider },

  actionBtn: { alignSelf: 'stretch', borderRadius: borderRadius.md, overflow: 'hidden', marginTop: spacing.sm },
  joinGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  joinText: { color: theme.primaryText, fontSize: 15, fontWeight: '800' },
  leaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14,
    backgroundColor: theme.dangerSoft, borderWidth: 1, borderColor: theme.danger,
  },
  leaveText: { color: theme.danger, fontSize: 15, fontWeight: '700' },

  membersHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.xs },
  membersTitle: { color: theme.textPrimary, fontSize: 15, fontWeight: '800' },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.md, marginBottom: spacing.xs,
    backgroundColor: theme.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: theme.divider, padding: spacing.sm,
  },
  memberRowMe: { borderColor: theme.primary, backgroundColor: theme.primarySoft },
  rankWrap: { width: 28, alignItems: 'center' },
  medal: { fontSize: 18 },
  rankNum: { color: theme.textSecondary, fontWeight: '800', fontSize: 13 },
  memberAvatar: { width: 40, height: 40, borderRadius: 20 },
  memberAvatarFallback: { backgroundColor: theme.primarySoft, alignItems: 'center', justifyContent: 'center' },
  memberInitial: { color: theme.primary, fontWeight: '800', fontSize: 16 },
  memberName: { color: theme.textPrimary, fontSize: 14, fontWeight: '700', maxWidth: 150 },
  memberSub: { color: theme.textSecondary, fontSize: 11, marginTop: 2 },
  memberKm: { color: theme.mode === 'dark' ? '#FCD34D' : theme.primary, fontSize: 15, fontWeight: '800' },
  adminBadge: { backgroundColor: theme.primarySoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  adminBadgeText: { color: theme.primary, fontSize: 9, fontWeight: '800' },
  removeMemberBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.dangerSoft,
  },
  requestsBox: {
    marginHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.md,
    backgroundColor: theme.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: theme.divider, padding: spacing.md,
  },
  requestsTitle: { color: theme.textPrimary, fontSize: 14, fontWeight: '800', marginBottom: spacing.sm },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  requestInfo: { flex: 1 },
  requestName: { color: theme.textPrimary, fontSize: 13, fontWeight: '700' },
  requestSub: { color: theme.textSecondary, fontSize: 11, marginTop: 2 },
  approveBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.success, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.danger, alignItems: 'center', justifyContent: 'center' },

  emptyWrap: { alignItems: 'center', marginTop: 40, gap: 10 },
  emptyText: { color: theme.textSecondary, fontSize: 13 },
});
