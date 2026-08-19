import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  TouchableOpacity,
  Platform,
  RefreshControl,
  Share,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { SPORTS, SportLevel } from '../../types';
import { colors, fontSize, spacing, borderRadius } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { heroImages, getSportImage } from '../../theme/images';
import Logo from '../../components/Logo';
import * as ImagePicker from 'expo-image-picker';
import { fetchCurrentWeather, WeatherData, getExerciseRecommendation, getRandomQuote, MotivationalQuote } from '../../services/external-apis';
import { getCurrentLocation } from '../../services/location.service';
import api from '../../services/api';
import { uploadMedia } from '../../services/media.service';
import { territoryApi } from '../../services/territory.service';
import { segmentsApi } from '../../services/segments.service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '../../navigation/MainTabNavigator';
import { showToast } from '../../components/ui/Toast';
import { confirmAsync } from '../../utils/confirm';

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'MyProfile'>;
};

const levelLabels: Record<SportLevel, string> = {
  [SportLevel.BEGINNER]: 'Iniciante',
  [SportLevel.INTERMEDIATE]: 'Intermediario',
  [SportLevel.ADVANCED]: 'Avancado',
};

const levelIcons: Record<SportLevel, string> = {
  [SportLevel.BEGINNER]: 'leaf',
  [SportLevel.INTERMEDIATE]: 'flame',
  [SportLevel.ADVANCED]: 'trophy',
};

interface Stats {
  totalActivities: number;
  totalDistanceKm: number;
  weeklyDistanceKm: number;
  totalDuration: number;
  currentStreak: number;
  bestStreak: number;
  averagePace: number;
  averageSpeed: number;
  totalMatches: number;
  totalEvents: number;
}

export default function MyProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const { user, setUser, logout } = useAuthStore();
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalActivities: 0, totalDistanceKm: 0, weeklyDistanceKm: 0, totalDuration: 0,
    currentStreak: 0, bestStreak: 0,
    averagePace: 0, averageSpeed: 0,
    totalMatches: 0, totalEvents: 0,
  });
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [quote, setQuote] = useState<MotivationalQuote | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [territory, setTerritory] = useState<{ cells: number; position: number | null; color: string } | null>(null);
  const [komCount, setKomCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    loadStats(() => mounted);
    loadWeather(() => mounted);
    setQuote(getRandomQuote());
    territoryApi.me().then((t) => { if (mounted) setTerritory(t); }).catch(() => {});
    segmentsApi.myKoms().then((r) => { if (mounted) setKomCount(r.count || 0); }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // isMounted() guard evita setState em componente desmontado (warning React)
  const loadStats = async (isMounted: () => boolean = () => true) => {
    setStatsLoading(true);
    try {
      const { data } = await api.get('/stats');
      const weeklyKm = data.weeklyDistance ?? data.weeklyDistanceKm ?? 0;
      if (!isMounted()) return;
      setStats({
        totalActivities: data.totalActivities || 0,
        totalDistanceKm: data.totalDistance || 0,
        weeklyDistanceKm: weeklyKm,
        totalDuration: (data.totalDuration || 0) * 3600,
        currentStreak: data.currentStreak || 0,
        bestStreak: data.bestStreak || 0,
        averagePace: data.averagePace || 0,
        averageSpeed: data.averageSpeed || 0,
        totalMatches: data.totalMatches || 0,
        totalEvents: data.totalEvents || 0,
      });
    } catch {
      try {
        const { data } = await api.get('/activities/history');
        const activities = Array.isArray(data) ? data : [];
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay()); // Sunday
        weekStart.setHours(0, 0, 0, 0);
        const weeklyActivities = activities.filter((a: any) => {
          const d = new Date(a.createdAt || a.startTime || 0);
          return d >= weekStart;
        });
        const totalDistance = activities.reduce((sum: number, a: any) => sum + (a.distance || 0), 0);
        const weeklyDistance = weeklyActivities.reduce((sum: number, a: any) => sum + (a.distance || 0), 0);
        const totalDuration = activities.reduce((sum: number, a: any) => sum + (a.duration || 0), 0);
        if (!isMounted()) return;
        setStats((s) => ({
          ...s,
          totalActivities: activities.length,
          totalDistanceKm: totalDistance / 1000,
          weeklyDistanceKm: weeklyDistance / 1000,
          totalDuration,
        }));
      } catch {
        // sem stats
      }
    } finally {
      if (isMounted()) setStatsLoading(false);
    }
  };

  const loadWeather = async (isMounted: () => boolean = () => true) => {
    try {
      const coords = await getCurrentLocation();
      const data = await fetchCurrentWeather(coords.latitude, coords.longitude);
      if (isMounted()) setWeather(data);
    } catch {
      // sem dados de clima
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadWeather()]);
    setQuote(getRandomQuote());
    setRefreshing(false);
  };

  const handleShareProfile = async () => {
    if (!user) return;
    try {
      await Share.share({
        message: `Confira meu perfil no Sync! Me encontre la: ${user.name} - Sync App`,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const handleLogout = async () => {
    const ok = await confirmAsync('Sair da conta?', 'Você voltará para a tela inicial do Sync.', {
      confirmText: 'Sair',
      destructive: true,
    });
    if (ok) {
      await setThemeMode('dark');
      await logout();
    }
  };

  const pickBanner = async () => {
    if (uploadingBanner) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToast('Permita o acesso à galeria para escolher o banner.', 'error');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.45,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploadingBanner(true);
      // Banner vai como base64 → guardado no banco (sempre exibe e sobrevive a
      // redeploy). Antes ia via /media/upload, cujos arquivos sumiam no disco
      // efêmero do Railway → o banner "não trocava".
      let bannerValue: string;
      if (asset.base64) {
        bannerValue = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
      } else {
        const up = await uploadMedia(asset.uri, {
          name: `banner-${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
        });
        bannerValue = up.url;
      }
      const { data } = await api.post('/users/me/banner', { bannerBase64: bannerValue });
      setUser(data);
      showToast('Capa atualizada!', 'success');
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Não foi possível enviar o banner', 'error');
    } finally {
      setUploadingBanner(false);
    }
  };

  if (!user) return null;

  const recommendation = weather ? getExerciseRecommendation(weather) : null;

  // Array estático de navegação (não memoizado: vem após early return de !user)
  const menuItems = [
    {
      icon: 'create-outline' as const,
      label: 'Editar perfil',
      subtitle: 'Alterar foto, bio e dados',
      onPress: () => navigation.navigate('EditProfile'),
      color: theme.primary,
    },
    {
      icon: 'medal-outline' as const,
      label: 'Conquistas',
      subtitle: 'Suas medalhas e XP acumulado',
      onPress: () => navigation.navigate('Achievements'),
      color: '#8B5CFF',
    },
    {
      icon: 'bar-chart-outline' as const,
      label: 'Dashboard de Stats',
      subtitle: 'Semana / mês / ano com gráficos',
      onPress: () => navigation.navigate('StatsDashboard' as any),
      color: theme.blue,
    },
    {
      icon: 'fitness-outline' as const,
      label: 'Planos de treino',
      subtitle: '5K / 10K / 21K com cronograma',
      onPress: () => navigation.navigate('Training' as any),
      color: '#10B981',
    },
    {
      icon: 'flag-outline' as const,
      label: 'Segmentos',
      subtitle: 'Trechos cronometrados e KOM/QOM',
      onPress: () => navigation.navigate('SegmentsList' as any),
      color: theme.warning,
    },
    {
      icon: 'trophy-outline' as const,
      label: 'Ranking mensal',
      subtitle: 'Veja sua posicao no ranking',
      onPress: () => navigation.navigate('Ranking'),
      color: '#FFD700',
    },
    {
      icon: 'notifications-outline' as const,
      label: 'Notificacoes',
      subtitle: 'Matches, mensagens e eventos',
      onPress: () => navigation.navigate('Notifications'),
      color: theme.blue,
    },
    {
      icon: 'share-social-outline' as const,
      label: 'Compartilhar perfil',
      subtitle: 'Convide amigos para o Sync',
      onPress: handleShareProfile,
      color: theme.success,
    },
    {
      icon: 'settings-outline' as const,
      label: 'Configuracoes',
      subtitle: 'Privacidade, notificacoes, conta',
      onPress: () => navigation.navigate('Settings'),
      color: theme.textSecondary,
    },
  ];

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const nextGoalTotal = 3;
  const nextGoalProgress = Math.min(stats.totalActivities, nextGoalTotal);
  const nextGoalPercent = nextGoalProgress / nextGoalTotal;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[theme.primary]}
          tintColor={theme.textPrimary}
        />
      }
    >
      {/* Profile header with hero cover */}
      <ImageBackground
        source={
          user.bannerUrl
            ? { uri: user.bannerUrl }
            : { uri: user.sports?.[0] ? getSportImage(user.sports[0]) : heroImages.runnerSunrise }
        }
        style={[styles.headerGradient, { paddingTop: Math.max(insets.top + 12, 60) }]}
        resizeMode="cover"
        fadeDuration={300}
      >
        <LinearGradient
          colors={theme.mode === 'dark'
            ? ['rgba(3,9,20,0.10)', 'rgba(3,9,20,0.62)', 'rgba(3,9,20,0.98)']
            : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.35)', 'rgba(247,248,251,0.98)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity
          style={[styles.headerActionBtn, styles.headerBackBtn, { top: Math.max(insets.top + 12, 56) }]}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.getParent()?.navigate('FeedTab' as never);
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.headerActionBtn, styles.bannerEditBtn, { top: Math.max(insets.top + 12, 56) }]}
          onPress={() => navigation.navigate('EditProfile')}
          disabled={uploadingBanner}
          accessibilityRole="button"
          accessibilityLabel="Editar perfil"
        >
          <Ionicons name="pencil-outline" size={18} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={[styles.avatarContainer, { shadowColor: theme.primary }]}>
            <View style={[
              styles.avatarRing,
              {
                borderColor: theme.primary,
                backgroundColor: theme.mode === 'dark' ? 'rgba(3,9,20,0.82)' : colors.white,
              },
            ]}>
              <Logo size={58} variant="filled" />
            </View>
            <TouchableOpacity
              style={[
                styles.editAvatarBtn,
                {
                  backgroundColor: theme.primary,
                  borderColor: theme.mode === 'dark' ? colors.white : theme.background,
                },
              ]}
              onPress={pickBanner}
              disabled={uploadingBanner}
              accessibilityRole="button"
              accessibilityLabel="Alterar foto de capa"
            >
              <Ionicons name={uploadingBanner ? 'hourglass-outline' : 'camera'} size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{user.name}</Text>
            {(user as any).isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={11} color="#fff" />
              </View>
            )}
            {(user as any).subscriptionTier === 'atleta_pro' && (
              <View style={[styles.tierBadge, { backgroundColor: '#7C3AED' }]}>
                <Ionicons name="trophy" size={10} color="#fff" />
              </View>
            )}
            {(user as any).subscriptionTier === 'premium' && (
              <View style={[styles.tierBadge, { backgroundColor: '#FF6B35' }]}>
                <Ionicons name="star" size={10} color="#fff" />
              </View>
            )}
          </View>
          {user.city && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.city}>{user.city}</Text>
            </View>
          )}
          {user.level && (levelIcons[user.level] || levelLabels[user.level]) && (
            <View style={[styles.levelBadge, { backgroundColor: theme.primarySoft }]}>
              <Ionicons
                name={(levelIcons[user.level] || 'fitness') as any}
                size={14}
                color={theme.primary}
              />
              <Text style={[styles.levelText, { color: theme.primary }]}>{levelLabels[user.level] || user.level}</Text>
            </View>
          )}
        </View>
      </ImageBackground>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg, marginBottom: spacing.md }}>
        <View style={[styles.profileGoalCard, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.primary }]}>
          <View style={styles.profileGoalSide}>
            <View style={[styles.profileGoalIcon, { backgroundColor: theme.primarySoft }]}>
              <Ionicons name="water" size={24} color={theme.primary} />
            </View>
            <View>
              <Text style={[styles.profileGoalValue, { color: theme.textPrimary }]}>{stats.currentStreak}</Text>
              <Text style={[styles.profileGoalLabel, { color: theme.textPrimary }]}>dias consecutivos</Text>
              <Text style={[styles.profileGoalHint, { color: theme.textSecondary }]}>
                {stats.currentStreak > 0 ? `Melhor: ${stats.bestStreak} dias` : 'Sem sequencia ainda'}
              </Text>
            </View>
          </View>
          <View style={[styles.profileGoalDivider, { backgroundColor: theme.divider }]} />
          <View style={styles.profileGoalMeta}>
            <Text style={[styles.profileGoalHint, { color: theme.textSecondary }]}>Proxima meta</Text>
            <Text style={[styles.profileGoalLabel, { color: theme.textPrimary }]}>Treine 3 vezes</Text>
            <Text style={[styles.profileGoalHint, { color: theme.textSecondary }]}>
              {nextGoalProgress}/{nextGoalTotal}
            </Text>
            <View style={[styles.profileProgressTrack, { backgroundColor: theme.divider }]}>
              <View style={[styles.profileProgressFill, { width: `${nextGoalPercent * 100}%`, backgroundColor: theme.primary }]} />
            </View>
          </View>
        </View>
      </View>

      {/* Território conquistado (jogo de conquista) */}
      {territory && territory.cells > 0 && (
        <TouchableOpacity
          style={[styles.territoryChip, { backgroundColor: theme.warningSoft, borderColor: theme.warning + '45' }]}
          activeOpacity={0.85}
          onPress={() => navigation.getParent()?.navigate('MapTab', { screen: 'Territory' })}
          accessibilityRole="button"
          accessibilityLabel={`Você conquistou ${territory.cells} áreas de território${territory.position ? `, posição ${territory.position} no ranking` : ''}. Toque para ver o mapa.`}
        >
          <View style={[styles.territoryDot, { backgroundColor: territory.color }]} />
          <Ionicons name="flag" size={16} color="#FCD34D" />
          <Text style={[styles.territoryText, { color: theme.textPrimary }]}>
            <Text style={styles.territoryStrong}>{territory.cells}</Text> áreas conquistadas
            {territory.position ? `  ·  ${territory.position}º no ranking` : ''}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      )}

      {/* KOMs / segmentos */}
      {komCount > 0 && (
        <TouchableOpacity
          style={[styles.territoryChip, { backgroundColor: theme.warningSoft, borderColor: theme.warning + '45' }]}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('SegmentsList' as any)}
        >
          <Ionicons name="trophy" size={16} color="#FFD700" />
          <Text style={[styles.territoryText, { color: theme.textPrimary }]}>
            <Text style={styles.territoryStrong}>{komCount}</Text> {komCount === 1 ? 'KOM/QOM' : 'KOMs/QOMs'} — você é o mais rápido!
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      )}

      {/* Stats cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="flash" size={18} color={theme.primary} />
          <Text style={[styles.statValue, { color: theme.textPrimary }]}>{stats.totalActivities}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Atividades</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="navigate" size={18} color={theme.blue} />
          <Text style={[styles.statValue, { color: theme.textPrimary }]}>{stats.totalDistanceKm.toFixed(1)}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>km total</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="time" size={18} color={theme.cyan} />
          <Text style={[styles.statValue, { color: theme.textPrimary }]}>{formatDuration(stats.totalDuration)}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Tempo</Text>
        </View>
      </View>

      {/* Stats row 2: Pace + Speed + Matches */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="speedometer" size={18} color="#4ADE80" />
          <Text style={[styles.statValue, { color: theme.textPrimary }]}>
            {stats.averagePace > 0 ? `${Math.floor(stats.averagePace)}:${String(Math.round((stats.averagePace % 1) * 60)).padStart(2, '0')}` : '--'}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>min/km</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="people" size={18} color="#8B5CFF" />
          <Text style={[styles.statValue, { color: theme.textPrimary }]}>{stats.totalMatches}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Matches</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="calendar" size={18} color="#2E7BFF" />
          <Text style={[styles.statValue, { color: theme.textPrimary }]}>{stats.totalEvents}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Eventos</Text>
        </View>
      </View>

      {/* Bio */}
      {user.bio && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre</Text>
          <Text style={styles.bio}>{user.bio}</Text>
        </View>
      )}

      {/* Sports */}
      {user.sports && user.sports.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Esportes</Text>
          <View style={styles.tags}>
            {user.sports.map((s) => (
              <View key={s} style={styles.tag}>
                <Text style={styles.tagText}>
                  {SPORTS.find((sp) => sp.id === s)?.label || s}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Daily Challenges */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Desafios do dia</Text>
        <View style={styles.challengesCard}>
          {[
            {
              icon: 'walk-outline' as const,
              label: 'Registre 1 treino hoje',
              progress: stats.totalActivities > 0 ? 1 : 0,
              total: 1,
              color: '#FF6B35',
            },
            {
              icon: 'navigate-outline' as const,
              label: 'Corra 5km esta semana',
              progress: Math.min(stats.weeklyDistanceKm, 5),
              total: 5,
              unit: 'km',
              color: '#2E7BFF',
            },
            {
              icon: 'calendar-outline' as const,
              label: 'Participe de 1 evento',
              progress: 0,
              total: 1,
              color: '#8B5CFF',
            },
          ].map((c, i) => {
            const pct = Math.min(1, c.progress / c.total);
            const done = pct >= 1;
            return (
              <View key={i} style={[styles.challengeItem, i < 2 && styles.challengeDivider]}>
                <View style={[styles.challengeIcon, { backgroundColor: c.color + '18' }]}>
                  <Ionicons name={done ? 'checkmark-circle' : c.icon} size={18} color={done ? colors.success : c.color} />
                </View>
                <View style={styles.challengeContent}>
                  <Text style={[styles.challengeLabel, done && styles.challengeLabelDone]}>{c.label}</Text>
                  <View style={styles.challengeBarWrap}>
                    <View style={styles.challengeBar}>
                      <View style={[styles.challengeBarFill, { width: `${pct * 100}%`, backgroundColor: done ? colors.success : c.color }]} />
                    </View>
                    <Text style={[styles.challengeProgress, { color: done ? colors.success : c.color }]}>
                      {c.unit ? `${c.progress.toFixed(1)}/${c.total}${c.unit}` : `${Math.round(c.progress)}/${c.total}`}
                    </Text>
                  </View>
                </View>
                {done && <Ionicons name="checkmark-circle" size={20} color={colors.success} />}
              </View>
            );
          })}
        </View>
      </View>

      {/* Menu */}
      <View style={styles.menu}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.menuItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: item.color + '12' }]}>
              <Ionicons name={item.icon} size={20} color={item.color} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={[styles.menuLabel, { color: theme.textPrimary }]}>{item.label}</Text>
              <Text style={[styles.menuSubtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.profileFooterPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.themeQuickTitleRow}>
          <View style={[styles.themeQuickIcon, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name={theme.mode === 'dark' ? 'moon' : 'sunny'} size={18} color={theme.primary} />
          </View>
          <View style={styles.themeQuickText}>
            <Text style={[styles.themeQuickTitle, { color: theme.textPrimary }]}>Aparência</Text>
            <Text style={[styles.themeQuickSub, { color: theme.textSecondary }]}>Modo claro ou escuro</Text>
          </View>
        </View>
        <View style={[styles.themeSegment, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
          {(['dark', 'light'] as const).map((mode) => {
            const active = themeMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.themeSegmentButton,
                  { backgroundColor: active ? theme.primary : 'transparent' },
                ]}
                onPress={() => setThemeMode(mode)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={mode === 'dark' ? 'moon-outline' : 'sunny-outline'}
                  size={16}
                  color={active ? theme.primaryText : theme.textSecondary}
                />
                <Text style={[styles.themeSegmentText, { color: active ? theme.primaryText : theme.textSecondary }]}>
                  {mode === 'dark' ? 'Escuro' : 'Claro'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, { borderColor: theme.danger + '55', backgroundColor: theme.dangerSoft }]}
          onPress={handleLogout}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
        >
          <Ionicons name="log-out-outline" size={18} color={theme.danger} />
          <Text style={[styles.logoutButtonText, { color: theme.danger }]}>Sair da conta</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: TAB_BAR_HEIGHT + insets.bottom + spacing.md }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerGradient: {
    minHeight: 280,
    paddingBottom: spacing.xl + 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerActionBtn: {
    position: 'absolute',
    top: 56, // overridden dynamically with insets.top
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 18,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  headerBackBtn: {
    left: spacing.lg,
  },
  bannerEditBtn: {
    right: spacing.lg,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  avatarContainer: {
    position: 'relative',
    width: 112,
    height: 112,
    // borderRadius no container faz a sombra (glow) ficar CIRCULAR no web —
    // sem isso o box-shadow vira um quadrado em volta da foto redonda.
    borderRadius: 56,
    // Glow fica no container (overflow visível) — o recorte circular vai no ring
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    overflow: 'hidden', // recorta a foto dentro do círculo (corrige foto quadrada no web)
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  name: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.white,
  },
  verifiedBadge: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#3B82F6',
    justifyContent: 'center', alignItems: 'center',
  },
  tierBadge: {
    width: 18, height: 18, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  city: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  levelText: {
    fontSize: fontSize.xs,
    color: colors.white,
    fontWeight: '600',
  },
  profileGoalCard: {
    minHeight: 102,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 4,
  },
  profileGoalSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  profileGoalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileGoalValue: {
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 34,
  },
  profileGoalLabel: {
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  profileGoalHint: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  profileGoalDivider: {
    width: 1,
    height: 62,
    marginHorizontal: spacing.md,
  },
  profileGoalMeta: {
    flex: 0.82,
  },
  profileProgressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  profileProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  profileFooterPanel: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  themeQuickTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  themeQuickIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeQuickText: {
    flex: 1,
  },
  themeQuickTitle: {
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  themeQuickSub: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  themeSegment: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  themeSegmentButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  themeSegmentText: {
    fontSize: 12,
    fontWeight: '800',
  },
  logoutButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.xs,
  },
  logoutButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.065)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(20px)' } as any) : {}),
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: colors.secondaryText,
  },
  // Weather card
  weatherCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  weatherCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  weatherCardInfo: {
    flex: 1,
  },
  weatherCardTemp: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
  },
  weatherCardRec: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginTop: 1,
  },
  weatherScore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weatherScoreText: {
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  // Quote card
  quoteCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.primary + '12',
    borderWidth: 1,
    borderColor: colors.primary + '25',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  quoteContent: {
    flex: 1,
  },
  quoteText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  quoteAuthor: {
    fontSize: fontSize.xs,
    color: colors.secondaryText,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.secondaryText,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  bio: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 24,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: colors.primary + '12',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  tagText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '500',
  },
  territoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(252,211,77,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.25)',
    borderRadius: borderRadius.md,
  },
  territoryDot: { width: 12, height: 12, borderRadius: 6 },
  territoryText: { flex: 1, color: colors.text, fontSize: fontSize.sm, fontWeight: '600' },
  territoryStrong: { color: '#FCD34D', fontWeight: '800' },
  menu: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  challengesCard: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  challengeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  challengeDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  challengeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeContent: {
    flex: 1,
  },
  challengeLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  challengeLabelDone: {
    textDecorationLine: 'line-through',
    color: colors.secondaryText,
  },
  challengeBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  challengeBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  challengeBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  challengeProgress: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 48,
    textAlign: 'right',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTextWrap: {
    flex: 1,
    marginLeft: spacing.md,
  },
  menuLabel: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '600',
  },
  menuSubtitle: {
    fontSize: fontSize.xs,
    color: colors.secondaryText,
    marginTop: 2,
  },
});
