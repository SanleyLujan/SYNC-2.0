import { confirmAsync } from '../../utils/confirm';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { ProfileStackParamList } from '../../navigation/types';
import { colors, fontSize, spacing, borderRadius } from '../../theme';
import {
  segmentsApi,
  Segment,
  LeaderboardRow,
  MyEffortsResult,
  formatElapsed,
} from '../../services/segments.service';
import MapView, { Marker, Polyline } from '../../components/map/SyncMap';
import Avatar from '../../components/ui/Avatar';
import ErrorState from '../../components/ui/ErrorState';
import { showToast } from '../../components/ui/Toast';
import { useHaptic } from '../../hooks/useHaptic';
import { feedApi } from '../../services/feed.service';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'SegmentDetail'>;
  route: RouteProp<ProfileStackParamList, 'SegmentDetail'>;
};

const medal = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function SegmentDetailScreen({ navigation, route }: Props) {
  const { segmentId } = route.params;
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const haptic = useHaptic();
  const [segment, setSegment] = useState<Segment | null>(null);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [mine, setMine] = useState<MyEffortsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [sharing, setSharing] = useState(false);
  const [scope, setScope] = useState<'global' | 'friends'>('global');

  const load = useCallback(async () => {
    setError(false);
    try {
      const [s, b] = await Promise.all([
        segmentsApi.detail(segmentId),
        scope === 'friends'
          ? segmentsApi.leaderboardFriends(segmentId)
          : segmentsApi.leaderboard(segmentId),
      ]);
      if (!s) { setError(true); return; }
      setSegment(s);
      setBoard(b);
      // Histórico dos meus tempos (não bloqueia a tela se falhar)
      segmentsApi.myEfforts(segmentId).then(setMine).catch(() => {});
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [segmentId, scope]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const shareToFeed = async () => {
    if (!segment || sharing) return;
    setSharing(true);
    try {
      // Legenda context-aware: KOM > tempo próprio > só o segmento
      const me = useAuthStore.getState().user;
      const mine = board.find((r) => r.userId === me?.id);
      let caption: string;
      if (mine && mine.isKOM) {
        caption = `🏆 Sou o KOM do segmento "${segment.name}" com ${formatElapsed(mine.elapsedSec)}! Quem vem tentar? #Sync #Segmento`;
      } else if (mine) {
        caption = `💪 Fiz ${formatElapsed(mine.elapsedSec)} no segmento "${segment.name}" (${mine.rank}º lugar). Bora competir! #Sync #Segmento`;
      } else {
        caption = `🚩 Conhece o segmento "${segment.name}"? ${(segment.distanceMeters / 1000).toFixed(2)} km de pura disputa no Sync! #Segmento`;
      }
      await feedApi.publish({ caption, sport: segment.sport, distanceKm: segment.distanceMeters / 1000 });
      haptic.success();
      showToast('Compartilhado no feed! 🎉', 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Não foi possível compartilhar.', 'error');
    } finally {
      setSharing(false);
    }
  };

  const renderRow = ({ item }: { item: LeaderboardRow }) => (
    <View style={[styles.row, { borderBottomColor: theme.divider }]}>
      <View style={styles.rankWrap}>
        {item.rank <= 3 ? (
          <Ionicons name="trophy" size={18} color={medal[item.rank - 1]} />
        ) : (
          <Text style={[styles.rankNum, { color: theme.textSecondary }]}>{item.rank}</Text>
        )}
      </View>
      <Avatar uri={item.avatarUrl} size={40} style={styles.rowAvatar} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowName, { color: theme.textPrimary }]} numberOfLines={1}>{item.name}</Text>
        {!!item.city && <Text style={[styles.rowCity, { color: theme.textSecondary }]} numberOfLines={1}>{item.city}</Text>}
      </View>
      {item.isKOM && (
        <View style={styles.komTag}>
          <Text style={styles.komTagText}>KOM</Text>
        </View>
      )}
      <Text style={[styles.rowTime, { color: theme.textPrimary }]}>{formatElapsed(item.elapsedSec)}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (error || !segment) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ErrorState onRetry={() => { setLoading(true); load(); }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={theme.mode === 'dark'
          ? ['#071427', '#040B16', theme.background]
          : ['#FFFFFF', '#F9FAFC', theme.background]}
        style={[styles.header, { paddingTop: Math.max(insets.top + 12, 56) }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerName, { color: theme.textPrimary }]} numberOfLines={1}>{segment.name}</Text>
      </LinearGradient>

      <FlatList
        data={board}
        keyExtractor={(r) => r.userId}
        renderItem={renderRow}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        ListHeaderComponent={
          <View>
            {/* Mapa do trecho: início (verde) → fim (vermelho) com linha */}
            <View style={styles.mapWrap} pointerEvents="none">
              <MapView
                style={styles.map}
                region={{
                  latitude: (segment.startLat + segment.endLat) / 2,
                  longitude: (segment.startLng + segment.endLng) / 2,
                  latitudeDelta: Math.max(Math.abs(segment.startLat - segment.endLat) * 2.2, 0.01),
                  longitudeDelta: Math.max(Math.abs(segment.startLng - segment.endLng) * 2.2, 0.01),
                }}
                pointerEvents="none"
              >
                <Polyline
                  coordinates={segment.geometry || []}
                  strokeColor={theme.primary}
                  strokeWidth={4}
                />
                <Marker coordinate={{ latitude: segment.startLat, longitude: segment.startLng }}>
                  <View style={[styles.pin, { backgroundColor: '#10B981' }]}>
                    <Ionicons name="play" size={12} color="#fff" />
                  </View>
                </Marker>
                <Marker coordinate={{ latitude: segment.endLat, longitude: segment.endLng }}>
                  <View style={[styles.pin, { backgroundColor: '#EF4444' }]}>
                    <Ionicons name="flag" size={12} color="#fff" />
                  </View>
                </Marker>
              </MapView>
            </View>

            {/* Stats do segmento */}
            <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: theme.textPrimary }]}>{(segment.distanceMeters / 1000).toFixed(2)}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>km</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.divider }]} />
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: theme.textPrimary }]}>{segment.attemptsCount}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>tentativas</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.divider }]} />
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: '#FFD700' }]}>
                  {segment.bestTimeSec != null ? formatElapsed(segment.bestTimeSec) : '—'}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>KOM</Text>
              </View>
            </View>

            {!!segment.description && (
              <Text style={[styles.desc, { color: theme.textSecondary }]}>{segment.description}</Text>
            )}

            {/* Seus tempos — evolução (mais alto = mais rápido) */}
            {mine && mine.count > 0 && (
              <View style={[styles.myCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.myHeader}>
                  <Text style={[styles.myTitle, { color: theme.textPrimary }]}>Seus tempos</Text>
                  <Text style={[styles.myBest, { color: theme.textSecondary }]}>
                    Melhor: <Text style={{ color: '#FFD700', fontWeight: '800' }}>{formatElapsed(mine.bestSec || 0)}</Text>
                  </Text>
                </View>
                {mine.count > 1 ? (
                  <>
                    <View style={styles.sparkRow}>
                      {(() => {
                        const times = mine.efforts.map((e) => e.elapsedSec);
                        const max = Math.max(...times);
                        const min = Math.min(...times);
                        const span = Math.max(1, max - min);
                        return mine.efforts.slice(-20).map((e, i) => {
                          // mais rápido (menor tempo) = barra mais alta
                          const h = 12 + ((max - e.elapsedSec) / span) * 40;
                          const isBest = e.elapsedSec === min;
                          return (
                            <View
                              key={i}
                              style={[styles.sparkBar, { height: h, backgroundColor: isBest ? '#FFD700' : theme.primary }]}
                            />
                          );
                        });
                      })()}
                    </View>
                    <Text style={[styles.myFootnote, { color: theme.textSecondary }]}>
                      {mine.count} tentativas · último: {formatElapsed(mine.lastSec || 0)}
                      {(mine.lastSec || 0) <= (mine.bestSec || 0) ? '  🔥 seu recorde!' : ''}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.myFootnote, { color: theme.textSecondary }]}>Sua 1ª passagem por aqui. Volte pra melhorar o tempo! 💪</Text>
                )}
              </View>
            )}

            <View style={styles.ctaRow}>
              <TouchableOpacity style={[styles.recordBtn, { padding: 12, backgroundColor: theme.primary }]} onPress={async () => {
                if (!segment?.geometry?.length) return;
                if (!await confirmAsync('Participar do ranking?', 'Seu nome e tempo nos segmentos percorridos neste treino ficarão públicos. Não há XP extra; pratique no seu ritmo.', { confirmText: 'Iniciar treino' })) return;
                navigation.getParent()?.navigate('TrackingTab', { screen: 'ActiveTracking', params: { sport: segment.sport, segmentsOptIn: true, plannedRoute: segment.geometry } });
              }}>
                <Text style={styles.recordBtnText}>{segment.geometry?.length ? 'Treinar neste segmento' : 'Segmento legado · recrie pelo seu treino'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.shareBtn, { backgroundColor: theme.primarySoft, borderColor: theme.primary + '40' }]} onPress={shareToFeed} disabled={sharing} activeOpacity={0.85}>
                {sharing ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Ionicons name="share-social" size={20} color={theme.primary} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.boardHeader}>
              <Text style={[styles.boardTitle, { color: theme.textPrimary }]}>Classificação</Text>
              <View style={[styles.scopeToggle, { backgroundColor: theme.surfaceSecondary }]}>
                {(['global', 'friends'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.scopeBtn,
                      scope === s && { backgroundColor: theme.primary },
                    ]}
                    onPress={() => { if (scope !== s) { setLoading(true); setScope(s); } }}
                  >
                    <Text style={[styles.scopeText, { color: scope === s ? theme.primaryText : theme.textSecondary }]}>
                      {s === 'global' ? 'Global' : 'Seguindo'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="podium-outline" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {scope === 'friends'
                ? 'Nenhum atleta que você segue correu aqui ainda. Chame a galera!'
                : 'Ninguém marcou tempo ainda. Seja o primeiro KOM! 🏆'}
            </Text>
          </View>
        }
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
      />


    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  center: { flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: { flex: 1, fontSize: fontSize.xl, fontWeight: '800', color: '#fff' },
  mapWrap: {
    height: 160, borderRadius: borderRadius.lg, overflow: 'hidden',
    marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  map: { flex: 1 },
  pin: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  boardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  scopeToggle: { flexDirection: 'row', backgroundColor: '#15151F', borderRadius: borderRadius.full, padding: 3 },
  scopeBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: borderRadius.full },
  scopeBtnActive: { backgroundColor: colors.primary },
  scopeText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.secondaryText },
  scopeTextActive: { color: '#fff' },
  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#15151F', borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: fontSize.xs, color: colors.secondaryText, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.08)' },
  desc: { fontSize: fontSize.sm, color: colors.secondaryText, lineHeight: 20, marginBottom: spacing.md },
  myCard: {
    backgroundColor: '#15151F', borderRadius: borderRadius.lg, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  myHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  myTitle: { fontSize: fontSize.sm, fontWeight: '800', color: colors.text },
  myBest: { fontSize: fontSize.xs, color: colors.secondaryText },
  sparkRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 56 },
  sparkBar: { flex: 1, minWidth: 4, borderRadius: 2, maxWidth: 16 },
  myFootnote: { fontSize: fontSize.xs, color: colors.secondaryText, marginTop: spacing.sm },
  ctaRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  recordBtn: { flex: 1, borderRadius: borderRadius.md, overflow: 'hidden' },
  shareBtn: {
    width: 52, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.primary + '40', backgroundColor: colors.primary + '12',
  },
  recordBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14,
  },
  recordBtnText: { color: '#fff', fontWeight: '700', fontSize: fontSize.md },
  boardTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rankWrap: { width: 26, alignItems: 'center' },
  rankNum: { fontSize: fontSize.sm, fontWeight: '700', color: colors.secondaryText },
  rowAvatar: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  rowName: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  rowCity: { fontSize: 11, color: colors.secondaryText, marginTop: 1 },
  komTag: { backgroundColor: 'rgba(255,215,0,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full },
  komTagText: { fontSize: 10, fontWeight: '800', color: '#FFD700' },
  rowTime: { fontSize: fontSize.md, fontWeight: '800', color: colors.text, minWidth: 56, textAlign: 'right' },
  emptyWrap: { alignItems: 'center', paddingTop: 40, gap: spacing.sm },
  emptyText: { fontSize: fontSize.sm, color: colors.secondaryText, textAlign: 'center', paddingHorizontal: spacing.xl, lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxWidth: 340, backgroundColor: '#15151F', borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1 },
  modalTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: spacing.lg },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  timeInput: {
    width: 72, textAlign: 'center', fontSize: 28, fontWeight: '800', color: colors.text,
    backgroundColor: '#0A0A0F', borderRadius: borderRadius.md, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  timeColon: { fontSize: 28, fontWeight: '800', color: colors.secondaryText },
  timeHint: { fontSize: fontSize.xs, color: colors.secondaryText, textAlign: 'center', marginTop: spacing.sm },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  modalCancel: { flex: 1, paddingVertical: 12, borderRadius: borderRadius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  modalCancelText: { color: colors.secondaryText, fontWeight: '700' },
  modalSave: { flex: 1, paddingVertical: 12, borderRadius: borderRadius.md, backgroundColor: colors.primary, alignItems: 'center' },
  modalSaveText: { color: '#fff', fontWeight: '800' },
});
