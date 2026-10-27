import React, { useState, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  ImageBackground,
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MapStackParamList } from '../../navigation/types';
import { Event as EventType } from '../../types';
import { colors, fontSize, spacing, borderRadius, AppTheme } from '../../theme';
import { useThemeStore } from '../../store/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getSportImage, emptyImages } from '../../theme/images';
import EmptyState from '../../components/ui/EmptyState';
import api from '../../services/api';
import { confirmAsync } from '../../utils/confirm';
import { showToast } from '../../components/ui/Toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  navigation: NativeStackNavigationProp<MapStackParamList, 'MyEvents'>;
};

const sportIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  running: 'walk',
  cycling: 'bicycle',
  swimming: 'water',
  football: 'football',
  basketball: 'basketball',
  tennis: 'tennisball',
  yoga: 'body',
  gym: 'barbell',
  hiking: 'trail-sign',
};

const sportColors: Record<string, string> = {
  running: '#FF6B35',
  cycling: '#2E7BFF',
  swimming: '#00BCD4',
  football: '#4CAF50',
  basketball: '#FF9800',
  gym: '#F44336',
  yoga: '#8BC34A',
  hiking: '#795548',
};

type Tab = 'created' | 'participating';

export default function MyEventsScreen({ navigation }: Props) {
  const theme = useThemeStore((state) => state.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('created');
  const [created, setCreated] = useState<EventType[]>([]);
  const [participating, setParticipating] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  useFocusEffect(useCallback(() => {
    loadMyEvents();
  }, []));

  const loadMyEvents = async () => {
    setError(false);
    try {
      const { data } = await api.get('/events/my');
      setCreated(data.created || []);
      setParticipating(data.participating || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMyEvents();
    setRefreshing(false);
  };

  const handleCancelEvent = async (eventId: string, title: string) => {
    const ok = await confirmAsync(
      'Cancelar evento',
      `Deseja cancelar o evento "${title}"? Esta ação não pode ser desfeita.`,
      { confirmText: 'Cancelar evento', destructive: true },
    );
    if (!ok) return;
    try {
      await api.delete(`/events/${eventId}`);
      setCreated((prev) => prev.filter((e) => e.id !== eventId));
      showToast('Evento cancelado com sucesso', 'success');
    } catch {
      showToast('Não foi possível cancelar o evento', 'error');
    }
  };

  const handleLeaveEvent = async (eventId: string, title: string) => {
    const ok = await confirmAsync('Sair do evento', `Deseja sair do evento "${title}"?`, {
      confirmText: 'Sair', destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/events/${eventId}/leave`);
      setParticipating((prev) => prev.filter((e) => e.id !== eventId));
    } catch {
      showToast('Não foi possível sair do evento', 'error');
    }
  };

  const renderEvent = ({ item }: { item: EventType }) => {
    const color = sportColors[item.sport] || theme.primary;
    const isPast = new Date(item.date) < new Date();
    const isCreated = tab === 'created';

    return (
      <TouchableOpacity
        style={[styles.eventCard, isPast && styles.eventCardPast]}
        onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
        activeOpacity={0.85}
      >
        <ImageBackground
          source={{ uri: getSportImage(item.sport) }}
          style={styles.eventThumb}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(10,10,15,0.1)', 'rgba(10,10,15,0.85)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.thumbBadge, { backgroundColor: color }]}>
            <Ionicons
              name={sportIcons[item.sport] || 'calendar'}
              size={14}
              color={colors.white}
            />
          </View>
        </ImageBackground>
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.eventDate}>
            {new Date(item.date).toLocaleDateString('pt-BR', {
              weekday: 'short',
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {item.address && (
            <Text style={styles.eventAddress} numberOfLines={1}>
              <Ionicons name="location-outline" size={11} color={theme.textSecondary} /> {item.address}
            </Text>
          )}
        </View>
        {!isPast && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              isCreated
                ? handleCancelEvent(item.id, item.title)
                : handleLeaveEvent(item.id, item.title)
            }
          >
            <Ionicons
              name={isCreated ? 'trash-outline' : 'exit-outline'}
              size={18}
              color={theme.danger}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const currentList = tab === 'created' ? created : participating;

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[theme.surfaceElevated, theme.surface, theme.background]}
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
        <Text style={styles.headerTitle}>Meus Eventos</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('CreateEvent')}
          accessibilityRole="button"
          accessibilityLabel="Criar novo evento"
        >
          <Ionicons name="add" size={22} color={theme.primaryText} />
        </TouchableOpacity>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'created' && styles.tabActive]}
          onPress={() => setTab('created')}
        >
          <Text style={[styles.tabText, tab === 'created' && styles.tabTextActive]}>
            Criados ({created.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'participating' && styles.tabActive]}
          onPress={() => setTab('participating')}
        >
          <Text style={[styles.tabText, tab === 'participating' && styles.tabTextActive]}>
            Participando ({participating.length})
          </Text>
        </TouchableOpacity>
      </View>

      {error && !loading && (
        <TouchableOpacity
          style={styles.errorBanner}
          onPress={() => { setLoading(true); loadMyEvents(); }}
          accessibilityRole="button"
          accessibilityLabel="Erro ao carregar. Tocar para tentar novamente."
        >
          <Ionicons name="cloud-offline-outline" size={16} color={theme.danger} />
          <Text style={styles.errorBannerText}>Erro ao carregar seus eventos. Toque pra tentar de novo.</Text>
          <Ionicons name="refresh" size={16} color={theme.danger} />
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={currentList}
          keyExtractor={(item) => item.id}
          renderItem={renderEvent}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
              progressBackgroundColor={theme.surface}
            />
          }
          ListEmptyComponent={
            <EmptyState
              image={emptyImages.noEvents}
              icon={tab === 'created' ? 'add-circle-outline' : 'calendar-outline'}
              title={
                tab === 'created'
                  ? 'Crie seu primeiro evento'
                  : 'Você ainda não participa de eventos'
              }
              subtitle={
                tab === 'created'
                  ? 'Organize uma corrida, pedal ou treino e reúna a galera.'
                  : 'Procure no Mapa eventos próximos e bata ponto.'
              }
              ctaLabel={tab === 'created' ? 'Criar evento' : undefined}
              onCtaPress={tab === 'created' ? () => navigation.navigate('CreateEvent') : undefined}
            />
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    backgroundColor: theme.dangerSoft, borderWidth: 1, borderColor: theme.danger,
    borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  errorBannerText: { flex: 1, color: theme.danger, fontSize: 13, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // paddingTop dinâmico via insets no JSX (notch/safe-area)
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
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
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: theme.textPrimary,
    letterSpacing: 0.3,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.primary,
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.primary,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  tabTextActive: {
    color: theme.primary,
    fontWeight: '700',
  },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: borderRadius.md,
    padding: 10,
    marginBottom: spacing.sm,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  eventCardPast: {
    opacity: 0.6,
  },
  eventThumb: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  thumbBadge: {
    margin: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sportIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  eventDate: {
    fontSize: fontSize.xs,
    color: theme.primary,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  eventAddress: {
    fontSize: fontSize.xs,
    color: theme.textSecondary,
    marginTop: 2,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.dangerSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  createBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: theme.primary,
    marginTop: spacing.sm,
  },
  createBtnText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.white,
  },
});
