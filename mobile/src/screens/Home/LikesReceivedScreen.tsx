import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, fontSize, borderRadius } from '../../theme';
import { useThemeStore } from '../../store/themeStore';
import SectionHeader from '../../components/layout/SectionHeader';
import { SPORTS } from '../../types';
import { TAB_BAR_HEIGHT } from '../../navigation/MainTabNavigator';
import { matchingApi, LikeReceivedItem } from '../../services/matching.service';
import Skeleton from '../../components/ui/Skeleton';
import Avatar from '../../components/ui/Avatar';
import { useHaptic } from '../../hooks/useHaptic';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function LikesReceivedScreen() {
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const navigation = useNavigation<any>();
  const haptic = useHaptic();
  const [items, setItems] = useState<LikeReceivedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actioning, setActioning] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const list = await matchingApi.likesReceived();
      setItems(list);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const respond = useCallback(
    async (item: LikeReceivedItem, action: 'like' | 'pass') => {
      if (actioning[item.likeId]) return;
      setActioning((p) => ({ ...p, [item.likeId]: true }));
      try {
        const res = await matchingApi.swipe(item.user.id, action);
        if (action === 'like') {
          haptic.success();
          if (res.matched) {
            navigation.navigate('MatchScreen', { matchId: res.matchId, userName: item.user.name, userId: item.user.id, userAvatar: (item.user as any).avatarUrl });
          }
        } else {
          haptic.light();
        }
      } catch {
        haptic.error();
      } finally {
        setItems((prev) => prev.filter((x) => x.likeId !== item.likeId));
        setActioning((p) => {
          const copy = { ...p };
          delete copy[item.likeId];
          return copy;
        });
      }
    },
    [actioning, haptic, navigation],
  );

  const header = (
    <SectionHeader
      title="Quem te curtiu"
      subtitle={items.length > 0
        ? `${items.length} ${items.length === 1 ? 'curtida pendente' : 'curtidas pendentes'}`
        : 'Uma curtida pode virar parceria.'}
      actions={
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
      }
    />
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {header}
        <View style={{ padding: spacing.md, gap: spacing.md }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={156} borderRadius={18} style={{ backgroundColor: theme.surfaceSecondary }} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {header}
      {items.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="heart-outline" size={40} color={theme.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Nenhuma curtida pendente</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Quando alguém te curtir, vai aparecer aqui. Continue se mostrando!
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: theme.primary }]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Voltar pra descoberta"
          >
            <Text style={[styles.buttonText, { color: theme.primaryText }]}>Voltar pra descoberta</Text>
            <Ionicons name="arrow-forward" size={18} color={theme.primaryText} />
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.likeId}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + spacing.lg }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, shadowOpacity: theme.mode === 'light' ? 0.07 : 0.2 }]}>
              <View style={styles.profileRow}>
                <View>
                  {item.user.avatarUrl ? (
                    <Avatar uri={item.user.avatarUrl} size={56} style={{ backgroundColor: theme.surfaceSecondary }} />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: theme.primarySoft }]}>
                      <Text style={[styles.initial, { color: theme.primary }]}>{item.user.name?.[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                  {item.isSuperLike && (
                    <View style={[styles.superBadge, { backgroundColor: theme.blue, borderColor: theme.surface }]} accessibilityLabel="Supercurtida">
                      <Ionicons name="star" size={11} color={theme.primaryText} />
                    </View>
                  )}
                </View>
                <View style={styles.profileInfo}>
                  <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={2}>{item.user.name}</Text>
                  {!!item.user.bio && (
                    <Text style={[styles.bio, { color: theme.textSecondary }]} numberOfLines={2}>{item.user.bio}</Text>
                  )}
                  {!!item.user.sports?.length && (
                    <View style={styles.sportsRow}>
                      {item.user.sports.slice(0, 3).map((sport) => (
                        <View key={sport} style={[styles.sportPill, { backgroundColor: theme.primarySoft }]}>
                          <Text style={[styles.sportText, { color: theme.mode === 'light' ? '#A83246' : '#9DC4FF' }]}>
                            {SPORTS.find((s) => s.id === sport)?.label || sport}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
              <View style={[styles.cardFooter, { borderTopColor: theme.divider }]}>
                <Text style={[styles.time, { color: theme.textSecondary }]}>{relativeDate(item.createdAt)}</Text>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
                    onPress={() => respond(item, 'pass')}
                    disabled={!!actioning[item.likeId]}
                    accessibilityRole="button"
                    accessibilityLabel={`Passar curtida de ${item.user.name}`}
                    accessibilityState={{ disabled: !!actioning[item.likeId], busy: !!actioning[item.likeId] }}
                  >
                    {actioning[item.likeId]
                      ? <ActivityIndicator size="small" color={theme.textSecondary} />
                      : <Ionicons name="close" size={18} color={theme.textSecondary} />}
                    <Text style={[styles.buttonText, { color: theme.textSecondary }]}>Passar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.primary, borderColor: theme.primary }]}
                    onPress={() => respond(item, 'like')}
                    disabled={!!actioning[item.likeId]}
                    accessibilityRole="button"
                    accessibilityLabel={`Curtir ${item.user.name}`}
                    accessibilityState={{ disabled: !!actioning[item.likeId], busy: !!actioning[item.likeId] }}
                  >
                    {actioning[item.likeId]
                      ? <ActivityIndicator size="small" color={theme.primaryText} />
                      : <Ionicons name="heart" size={18} color={theme.primaryText} />}
                    <Text style={[styles.buttonText, { color: theme.primaryText }]}>Curtir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 2 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  profileInfo: { flex: 1, minWidth: 0 },
  avatarFallback: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 22, fontWeight: '800' },
  superBadge: { position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: fontSize.md, fontWeight: '800' },
  bio: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  sportsRow: { flexDirection: 'row', gap: 4, marginTop: 8, flexWrap: 'wrap' },
  sportPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  sportText: { fontSize: 11, fontWeight: '600' },
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, marginTop: 14, paddingTop: 12 },
  time: { fontSize: 11 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { minHeight: 44, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 12, fontWeight: '700' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 21, marginTop: spacing.sm, maxWidth: 320 },
  emptyButton: { minHeight: 44, marginTop: spacing.lg, paddingHorizontal: spacing.lg, borderRadius: borderRadius.md, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
