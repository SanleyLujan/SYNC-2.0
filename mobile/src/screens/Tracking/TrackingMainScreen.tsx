import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Dimensions,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import MapView from '../../components/map/SyncMap';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { TrackingStackParamList } from '../../navigation/types';
import { colors, fontSize, spacing, borderRadius } from '../../theme';
import { useThemeStore } from '../../store/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getCurrentLocation } from '../../services/location.service';
import { fetchCurrentWeather, WeatherData, getExerciseRecommendation, getRandomQuote } from '../../services/external-apis';
import api from '../../services/api';
import BestTimeWidget from '../../components/BestTimeWidget';
import TodayBriefWidget from '../../components/TodayBriefWidget';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '../../navigation/MainTabNavigator';
import { showToast } from '../../components/ui/Toast';
import { confirmAsync } from '../../utils/confirm';
import { getBackgroundTrackingContext } from '../../services/background-tracking.service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
  navigation: NativeStackNavigationProp<TrackingStackParamList, 'TrackingMain'>;
};

const SPORT_OPTIONS = [
  { id: 'running', label: 'Corrida', icon: 'walk-outline' as const, color: '#FF6B35' },
  { id: 'cycling', label: 'Ciclismo', icon: 'bicycle-outline' as const, color: '#2E7BFF' },
  { id: 'swimming', label: 'Natacao', icon: 'water-outline' as const, color: '#00BCD4' },
  { id: 'hiking', label: 'Trilha', icon: 'trail-sign-outline' as const, color: '#795548' },
  { id: 'gym', label: 'Academia', icon: 'barbell-outline' as const, color: '#F44336' },
];

export default function TrackingMainScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const [selectedSport, setSelectedSport] = useState('running');
  const [showStats, setShowStats] = useState(true);
  const [liveShare, setLiveShare] = useState(false);
  const [countLaps, setCountLaps] = useState(false);
  const [loading, setLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [quote] = useState(getRandomQuote());
  const [region, setRegion] = useState<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const mapRef = useRef<MapView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const startBtnScale = useRef(new Animated.Value(1)).current;
  const startInFlightRef = useRef(false);

  useEffect(() => {
    initLocation();
    // Pulse animation for start button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      startInFlightRef.current = false;
      setLoading(false);
      getBackgroundTrackingContext()
        .then((tracking) => {
          if (!active || !tracking) return;
          navigation.navigate('ActiveTracking', {
            sport: tracking.sport,
            existingActivityId: tracking.activityId,
            existingStartedAt: tracking.startedAt,
          });
        })
        .catch(() => {});
      return () => { active = false; };
    }, [navigation]),
  );

  const initLocation = async () => {
    setLocationError(null);
    setLocationLoading(true);
    try {
      const coords = await getCurrentLocation();
      const newRegion = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 500);
      // Sincroniza com backend
      api.put('/users/location', { latitude: coords.latitude, longitude: coords.longitude }).catch(() => {});

      // Load weather
      try {
        const w = await fetchCurrentWeather(coords.latitude, coords.longitude);
        setWeather(w);
      } catch (e) {
        console.log('Weather error:', e);
      }
    } catch (error: any) {
      console.log('Location error:', error?.message || error);
      setLocationError(error?.message || 'Não foi possível obter sua localização.');
    } finally {
      setLocationLoading(false);
    }
  };

  const startActivity = (goal?: { type: 'distance' | 'duration'; value: number }) => {
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    // Button press animation
    Animated.sequence([
      Animated.timing(startBtnScale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(startBtnScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setLoading(true);
    navigation.navigate('ActiveTracking', {
      sport: selectedSport,
      enableLiveShare: liveShare,
      countLaps,
      goalType: goal?.type,
      goalValue: goal?.value,
    });
  };

  const selectedSportData = SPORT_OPTIONS.find((s) => s.id === selectedSport);
  const selectedSportColor = selectedSport === 'running' ? theme.primary : selectedSportData?.color || theme.primary;
  const recommendation = weather ? getExerciseRecommendation(weather) : null;
  const distanceBased = selectedSport !== 'gym';
  const quickGoals = distanceBased
    ? [
        { label: '1 km', value: 1_000, icon: 'walk-outline' as const },
        { label: '3 km', value: 3_000, icon: 'walk-outline' as const },
        { label: '5 km', value: 5_000, icon: 'fitness-outline' as const },
        { label: '10 km', value: 10_000, icon: 'trophy-outline' as const },
      ]
    : [
        { label: '15 min', value: 900, icon: 'time-outline' as const },
        { label: '30 min', value: 1_800, icon: 'time-outline' as const },
        { label: '45 min', value: 2_700, icon: 'fitness-outline' as const },
        { label: '60 min', value: 3_600, icon: 'trophy-outline' as const },
      ];

  if (!region) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }]}>
        {locationLoading ? (
          <>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Ionicons name="navigate-circle" size={64} color={theme.primary} />
            </Animated.View>
            <Text style={{ color: theme.textPrimary, marginTop: spacing.md, fontSize: fontSize.md, fontWeight: '700' }}>
              Conectando ao seu GPS...
            </Text>
            <Text style={{ color: theme.textSecondary, marginTop: 4, fontSize: fontSize.xs, textAlign: 'center' }}>
              Permita a localização pra começar o treino.
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="location-outline" size={64} color={theme.primary} />
            <Text style={{ color: theme.textPrimary, marginTop: spacing.md, fontSize: fontSize.md, fontWeight: '700', textAlign: 'center' }}>
              {locationError || 'GPS indisponível'}
            </Text>
            <TouchableOpacity
              style={{ marginTop: spacing.lg, backgroundColor: theme.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.md, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              onPress={initLocation}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={18} color={colors.white} />
              <Text style={{ color: colors.white, fontWeight: '700' }}>Tentar novamente</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ marginTop: spacing.sm, borderWidth: 1, borderColor: theme.primary + '55', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.md, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              onPress={() => navigation.navigate('ActiveTracking', { sport: 'gym', countLaps })}
              activeOpacity={0.8}
            >
              <Ionicons name="barbell-outline" size={18} color={theme.primary} />
              <Text style={{ color: theme.primary, fontWeight: '700' }}>Iniciar academia sem GPS</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Full-screen dark map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle="dark"
        customMapStyle={darkMapStyle}
      />

      {/* Top bar overlay */}
      <View style={[styles.topBar, { top: Math.max(insets.top + 6, 50) }]}>
        <TouchableOpacity
          style={[styles.topBtn, { backgroundColor: theme.mapOverlay || theme.overlay }]}
          onPress={() => navigation.navigate('ActivityHistory')}
        >
          <Ionicons name="time-outline" size={22} color={theme.textPrimary} />
        </TouchableOpacity>

        {/* Weather mini badge */}
        {weather && recommendation && (
          <View style={[styles.weatherBadge, { backgroundColor: theme.mapOverlay || theme.overlay, borderColor: recommendation.color + '40' }]}>
            <Ionicons name={weather.weatherIcon as any} size={16} color={recommendation.color} />
            <Text style={[styles.weatherBadgeTemp, { color: theme.textPrimary }]}>{weather.temperature}°</Text>
            <View style={[styles.weatherDot, { backgroundColor: recommendation.color }]} />
          </View>
        )}

        <TouchableOpacity style={[styles.topBtn, { backgroundColor: theme.mapOverlay || theme.overlay }]} onPress={initLocation}>
          <Ionicons name="locate-outline" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Stats panel (collapsible) */}
      {showStats && (
        <View style={[styles.statsPanel, { top: Math.max(insets.top + 56, 100), backgroundColor: theme.mapOverlay || theme.overlay, borderColor: theme.border }]}>
          <TouchableOpacity
            style={styles.statsExpand}
            onPress={() => setShowStats(!showStats)}
          >
            <Ionicons name="chevron-up" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
          <View style={styles.statsSportRow}>
            <Ionicons
              name={selectedSportData?.icon || 'walk-outline'}
              size={18}
              color={selectedSportColor}
            />
            <Text style={[styles.statsTitle, { color: selectedSportColor }]}>
              {selectedSportData?.label || 'Corrida'}
            </Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.textPrimary }]}>00:00</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Tempo</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.textPrimary }]}>--:--</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Ritmo /km</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.textPrimary }]}>0,00</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>km</Text>
            </View>
          </View>
        </View>
      )}

      {/* Bottom controls */}
      <View style={[styles.bottomContainer, { backgroundColor: theme.background }]}>
        {/* Sport selector + Start button row */}
        <View style={styles.sportRow}>
          <TouchableOpacity
            style={styles.sportSelector}
            onPress={() => {
              const currentIdx = SPORT_OPTIONS.findIndex((s) => s.id === selectedSport);
              const prevIdx = (currentIdx - 1 + SPORT_OPTIONS.length) % SPORT_OPTIONS.length;
              setSelectedSport(SPORT_OPTIONS[prevIdx].id);
            }}
          >
            <Ionicons
              name={SPORT_OPTIONS[(SPORT_OPTIONS.findIndex((s) => s.id === selectedSport) - 1 + SPORT_OPTIONS.length) % SPORT_OPTIONS.length].icon}
              size={24}
              color={theme.textSecondary}
            />
            <Text style={[styles.sportLabelInactive, { color: theme.textSecondary }]}>
              {SPORT_OPTIONS[(SPORT_OPTIONS.findIndex((s) => s.id === selectedSport) - 1 + SPORT_OPTIONS.length) % SPORT_OPTIONS.length].label}
            </Text>
          </TouchableOpacity>

          {/* Big start button with pulse */}
          <Animated.View style={{ transform: [{ scale: Animated.multiply(pulseAnim, startBtnScale) }] }}>
            <TouchableOpacity
              style={[styles.startButton, { shadowColor: selectedSportColor }]}
              onPress={() => startActivity()}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[selectedSportColor, theme.mode === 'dark' ? theme.blue : theme.warning]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.startButtonGradient}
              >
                <Ionicons name="play" size={32} color={colors.white} />
                <Text style={styles.startText}>Iniciar</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={styles.sportSelector}
            onPress={() => {
              const currentIdx = SPORT_OPTIONS.findIndex((s) => s.id === selectedSport);
              const nextIdx = (currentIdx + 1) % SPORT_OPTIONS.length;
              setSelectedSport(SPORT_OPTIONS[nextIdx].id);
            }}
          >
            <Ionicons
              name={SPORT_OPTIONS[(SPORT_OPTIONS.findIndex((s) => s.id === selectedSport) + 1) % SPORT_OPTIONS.length].icon}
              size={24}
              color={theme.textSecondary}
            />
            <Text style={[styles.sportLabelInactive, { color: theme.textSecondary }]}>
              {SPORT_OPTIONS[(SPORT_OPTIONS.findIndex((s) => s.id === selectedSport) + 1) % SPORT_OPTIONS.length].label}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Weather recommendation */}
        {recommendation && (
          <View style={[styles.recommendationBar, { backgroundColor: recommendation.color + '15' }]}>
            <Ionicons name={weather?.weatherIcon as any || 'sunny'} size={16} color={recommendation.color} />
            <Text style={[styles.recommendationText, { color: recommendation.color }]}>
              {recommendation.score >= 60
                ? `${recommendation.level.charAt(0).toUpperCase() + recommendation.level.slice(1)} para treinar ao ar livre`
                : 'Considere treinar em ambiente fechado'
              }
            </Text>
          </View>
        )}

        {/* Options list */}
        <ScrollView
          style={[styles.optionsList, { borderTopColor: theme.border }]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom }}
        >
          <TouchableOpacity
            style={[styles.optionItem, { borderBottomColor: theme.border }]}
            onPress={() => {
              setLiveShare(!liveShare);
              if (!liveShare) {
                showToast('Amigos poderão ver sua localização em tempo real durante o treino.', 'info');
              }
            }}
          >
            <View style={styles.optionLeft}>
              <Ionicons name="location-outline" size={22} color={theme.textSecondary} />
              <View style={styles.optionTextWrap}>
                <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>Compartilhar localizacao ao vivo</Text>
              </View>
            </View>
            <Switch
              value={liveShare}
              onValueChange={(v) => {
                setLiveShare(v);
                if (v) showToast('Compartilhamento de localização ativado.', 'success');
              }}
              trackColor={{ false: theme.surfaceSecondary, true: theme.primary }}
              thumbColor={colors.white}
            />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.optionItem, { borderBottomColor: theme.border }]}>
            <View style={styles.optionLeft}>
              <Ionicons name="refresh-outline" size={22} color={theme.textSecondary} />
              <View style={styles.optionTextWrap}>
                <Text style={[styles.optionTitle, { color: theme.textPrimary }]}>Contar voltas</Text>
                <Text style={[styles.optionSubtitle, { color: theme.textSecondary }]}>Conte manualmente suas voltas</Text>
              </View>
            </View>
            <Switch
              value={countLaps}
              onValueChange={setCountLaps}
              trackColor={{ false: theme.surfaceSecondary, true: theme.primary }}
              thumbColor={colors.white}
            />
          </TouchableOpacity>

          {/* Quick goals */}
          <View style={styles.goalsSection}>
            <Text style={[styles.goalsSectionTitle, { color: theme.textSecondary }]}>Metas rapidas</Text>
            <View style={styles.goalsRow}>
              {quickGoals.map((g, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.goalChip, { backgroundColor: theme.primarySoft, borderColor: theme.primary + '35' }]}
                  onPress={async () => {
                    const ok = await confirmAsync(
                      `Meta: ${g.label}`,
                      `Sua meta para esta atividade será ${g.label}. Você receberá um aviso ao atingir o objetivo.`,
                      { confirmText: 'Definir e iniciar' },
                    );
                    if (ok) startActivity({ type: distanceBased ? 'distance' : 'duration', value: g.value });
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name={g.icon} size={14} color={theme.primary} />
                  <Text style={[styles.goalChipText, { color: theme.primary }]}>{g.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={styles.historyLink}
            onPress={() => navigation.navigate('ActivityHistory')}
          >
            <Ionicons name="time-outline" size={20} color={theme.primary} />
            <Text style={[styles.historyText, { color: theme.primary }]}>Ver historico de atividades</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

// Google Maps dark style
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d1d2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8e8ea0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d2e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a40' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#252540' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2e1a' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#252540' }] },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  map: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 50, // overridden dynamically with insets.top
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.dark.mapOverlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weatherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dark.mapOverlay,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  weatherBadgeTemp: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.dark.text,
  },
  weatherDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statsPanel: {
    position: 'absolute',
    top: 100, // overridden dynamically with insets.top
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.dark.mapOverlay,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  statsExpand: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  statsSportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  statsTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.dark.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 11,
    color: colors.dark.secondaryText,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.dark.border,
  },
  quoteRow: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.dark.border,
  },
  quoteText: {
    fontSize: fontSize.xs,
    color: colors.dark.secondaryText,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  bottomContainer: {
    backgroundColor: colors.dark.background,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingTop: spacing.md,
    maxHeight: '52%',
  },
  sportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  sportSelector: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  sportLabelInactive: {
    fontSize: fontSize.xs,
    color: colors.dark.secondaryText,
  },
  startButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  startButtonGradient: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
    marginTop: 2,
  },
  recommendationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  recommendationText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  optionsList: {
    borderTopWidth: 1,
    borderTopColor: colors.dark.border,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dark.border,
  },
  optionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    fontSize: fontSize.md,
    color: colors.dark.text,
  },
  optionSubtitle: {
    fontSize: fontSize.xs,
    color: colors.dark.secondaryText,
    marginTop: 2,
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  historyText: {
    fontSize: fontSize.md,
    color: colors.dark.accent,
    fontWeight: '500',
  },

  // ── Quick goals (estavam sem estilo — bug corrigido) ──────────────────────
  goalsSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  goalsSectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.dark.secondaryText,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  goalsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,107,53,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.25)',
  },
  goalChipText: {
    fontSize: fontSize.sm,
    color: colors.dark.accent,
    fontWeight: '600',
  },
});
