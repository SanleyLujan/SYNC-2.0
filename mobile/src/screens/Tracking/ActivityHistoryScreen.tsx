import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TrackingStackParamList } from '../../navigation/types';
import { Activity } from '../../types';
import { fontSize, spacing, borderRadius } from '../../theme';
import { AppTheme } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { unwrapActivityHistory } from '../../utils/activity-history';
import { isDistanceActivity } from '../../utils/activity-metrics';

type Props = {
  navigation: NativeStackNavigationProp<TrackingStackParamList, 'ActivityHistory'>;
};

const sportIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  running: 'walk-outline',
  cycling: 'bicycle-outline',
  swimming: 'water-outline',
  hiking: 'trail-sign-outline',
  gym: 'barbell-outline',
};

const sportLabels: Record<string, string> = {
  running: 'Corrida',
  cycling: 'Ciclismo',
  swimming: 'Natacao',
  hiking: 'Trilha',
  gym: 'Academia',
};

// Map activityId → { isPRDistance: boolean; isPRPace: boolean }
function computePRMap(acts: Activity[]): Map<string, { distPR: boolean; durationPR: boolean; pacePR: boolean }> {
  const map = new Map<string, { distPR: boolean; durationPR: boolean; pacePR: boolean }>();
  // Group by sport
  const bySport = new Map<string, Activity[]>();
  for (const a of acts) {
    if (!bySport.has(a.sport)) bySport.set(a.sport, []);
    bySport.get(a.sport)!.push(a);
  }
  // For each sport find max distance and best (lowest) pace
  bySport.forEach((sportActs) => {
    const maxDist = Math.max(...sportActs.map((a) => a.distance ?? 0));
    const maxDuration = Math.max(...sportActs.map((a) => a.duration ?? 0));
    const paced = sportActs.filter((a) => a.avgPace);
    const bestPace = paced.length ? Math.min(...paced.map((a) => a.avgPace!)) : null;
    for (const a of sportActs) {
      map.set(a.id, {
        distPR: (a.distance ?? 0) === maxDist && maxDist > 0,
        durationPR: (a.duration ?? 0) === maxDuration && maxDuration > 0,
        pacePR: !!(a.avgPace && bestPace && a.avgPace === bestPace),
      });
    }
  });
  return map;
}

export default function ActivityHistoryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useThemeStore(state => state.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [prMap, setPrMap] = useState<Map<string, { distPR: boolean; durationPR: boolean; pacePR: boolean }>>(new Map());

  useEffect(() => {
    loadActivities();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActivities(true);
    setRefreshing(false);
  };

  const loadActivities = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      const { data } = await api.get('/activities/history');
      const list = unwrapActivityHistory(data);
      setActivities(list);
      setPrMap(computePRMap(list));
    } catch (err) {
      console.log('Error:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}min`;
    return `${m}min`;
  };

  const renderItem = ({ item }: { item: Activity }) => {
    const pr = prMap.get(item.id);
    const distanceBased = isDistanceActivity(item.sport);
    const hasPR = distanceBased ? (pr?.distPR || pr?.pacePR) : pr?.durationPR;

    return (
    <TouchableOpacity
      style={[styles.card, hasPR && styles.cardPR]}
      onPress={() => navigation.navigate('ActivitySummary', { activityId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.sportIconWrap, hasPR && { backgroundColor: theme.successSoft }]}>
          <Ionicons
            name={sportIcons[item.sport] || 'fitness-outline'}
            size={20}
            color={hasPR ? theme.success : theme.primary}
          />
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.sportName}>
              {sportLabels[item.sport] || item.sport}
            </Text>
            {pr?.distPR && (
              <View style={styles.prBadge}>
                <Ionicons name="trophy" size={10} color={theme.success} />
                <Text style={styles.prBadgeText}>🏅 Dist. PR</Text>
              </View>
            )}
            {pr?.pacePR && !pr?.distPR && (
              <View style={styles.prBadge}>
                <Ionicons name="flash" size={10} color={theme.success} />
                <Text style={styles.prBadgeText}>⚡ Pace PR</Text>
              </View>
            )}
            {!distanceBased && pr?.durationPR && (
              <View style={styles.prBadge}>
                <Ionicons name="time" size={10} color={theme.success} />
                <Text style={styles.prBadgeText}>🏅 Tempo PR</Text>
              </View>
            )}
          </View>
          <Text style={styles.dateText}>
            {new Date(item.startTime).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}{' '}
            {new Date(item.startTime).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
      </View>
      <View style={styles.cardMetrics}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>
            {distanceBased ? (item.distance / 1000).toFixed(2) : formatDuration(item.duration)}
          </Text>
          <Text style={styles.metricLabel}>{distanceBased ? 'km' : 'tempo'}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>
            {distanceBased ? formatDuration(item.duration) : (item.calories ?? 0)}
          </Text>
          <Text style={styles.metricLabel}>{distanceBased ? 'tempo' : 'kcal'}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>
            {distanceBased ? (item.avgPace?.toFixed(1) || '--') : (item.laps?.length ?? 0)}
          </Text>
          <Text style={styles.metricLabel}>{distanceBased ? 'min/km' : 'voltas'}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>
            {distanceBased ? (item.avgSpeed?.toFixed(1) || '--') : (item.goalReachedAt ? 'sim' : '--')}
          </Text>
          <Text style={styles.metricLabel}>{distanceBased ? 'km/h' : 'meta'}</Text>
        </View>
      </View>
    </TouchableOpacity>
    );
  };

  // Group by month
  const totalDistance = activities.reduce((sum, a) => sum + a.distance, 0);
  const totalDuration = activities.reduce((sum, a) => sum + (a.duration || 0), 0);
  const totalActivities = activities.length;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.surfaceSecondary, theme.surface, theme.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.header, { paddingTop: Math.max(insets.top + 10, 48) }]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Histórico</Text>
        <View style={{ width: 38 }} />
      </LinearGradient>

      {/* Summary stats */}
      {!loading && activities.length > 0 && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalActivities}</Text>
            <Text style={styles.summaryLabel}>Atividades</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {(totalDistance / 1000).toFixed(1)}
            </Text>
            <Text style={styles.summaryLabel}>km total</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {Math.floor(totalDuration / 3600) > 0
                ? `${Math.floor(totalDuration / 3600)}h${Math.floor((totalDuration % 3600) / 60)}m`
                : `${Math.floor(totalDuration / 60)}m`}
            </Text>
            <Text style={styles.summaryLabel}>tempo total</Text>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator
          size="large"
          color={theme.primary}
          style={{ marginTop: 50 }}
        />
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} progressBackgroundColor={theme.surface} />
          }
          ListEmptyComponent={
            error ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="cloud-offline-outline" size={48} color={theme.textMuted} />
                <Text style={styles.emptyTitle}>Erro ao carregar</Text>
                <Text style={styles.emptyText}>Não foi possível buscar seu histórico.</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => loadActivities()}
                  accessibilityRole="button"
                  accessibilityLabel="Tentar novamente"
                >
                  <Ionicons name="refresh" size={16} color={theme.primaryText} />
                  <Text style={styles.retryText}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="fitness-outline" size={48} color={theme.textMuted} />
                <Text style={styles.emptyTitle}>Nenhuma atividade</Text>
                <Text style={styles.emptyText}>
                  Comece a treinar para ver seu histórico aqui
                </Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // paddingTop dinâmico via insets no JSX (notch/safe-area)
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: theme.textPrimary,
    letterSpacing: 0.3,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: theme.mode === 'dark' ? 0.2 : 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: theme.primary,
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: theme.divider,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: theme.mode === 'dark' ? 0.2 : 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPR: {
    borderColor: theme.success,
    backgroundColor: theme.surface,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  prBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: theme.successSoft,
    borderRadius: 20, borderWidth: 1, borderColor: theme.success,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  prBadgeText: { fontSize: 10, fontWeight: '700', color: theme.textPrimary },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sportIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  sportName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  dateText: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    marginTop: 2,
  },
  cardMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: theme.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: 10,
    color: theme.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: theme.divider,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
  },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: spacing.lg, backgroundColor: theme.primary,
    paddingVertical: 12, paddingHorizontal: spacing.xl, borderRadius: 12,
  },
  retryText: { color: theme.primaryText, fontWeight: '700', fontSize: 14 },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: theme.textPrimary,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
