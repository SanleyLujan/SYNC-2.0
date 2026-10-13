import LoadingState from '../../components/ui/LoadingState';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Share,
  Platform,
  Animated,
  Pressable,
  Easing,
  Modal,
  TextInput,
} from 'react-native';
import MapView, { Polyline, Marker } from '../../components/map/SyncMap';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { uploadMedia } from '../../services/media.service';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { TrackingStackParamList } from '../../navigation/types';
import { Activity } from '../../types';
import { colors, fontSize, spacing, borderRadius } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { feedApi } from '../../services/feed.service';
import { segmentsApi } from '../../services/segments.service';
import { generateWorkoutSummary } from '../../utils/workout-summary';
import { showToast } from '../../components/ui/Toast';
import ErrorBoundary from '../../components/ErrorBoundary';
import { computeSplits, formatPace, type Split } from '../../utils/splits';
import { useHaptic } from '../../hooks/useHaptic';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import PostWorkoutRatingModal from '../../components/PostWorkoutRatingModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WorkoutImageModal from '../../components/WorkoutImageModal';
import { useThemeStore } from '../../store/themeStore';
import { isDistanceActivity } from '../../utils/activity-metrics';

type Props = {
  navigation: NativeStackNavigationProp<TrackingStackParamList, 'ActivitySummary'>;
  route: RouteProp<TrackingStackParamList, 'ActivitySummary'>;
};

const ACCENT = '#FF6B35';

const SPORT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  running: 'walk',
  cycling: 'bicycle',
  swimming: 'water',
  hiking: 'trail-sign',
  gym: 'barbell',
};

const SPORT_LABELS: Record<string, string> = {
  running: 'Corrida',
  cycling: 'Ciclismo',
  swimming: 'Natação',
  hiking: 'Trilha',
  gym: 'Academia',
};

interface PRResult {
  type: 'distance' | 'duration' | 'pace';
  label: string;
  value: string;
}

// Wrapper com ErrorBoundary: garante que a tela NUNCA fique branca por um erro
// de render (ex.: mapa no web). Mostra um fallback com botão de voltar.
export default function ActivitySummaryScreen(props: Props) {
  return (
    <ErrorBoundary
      fallback={
        <View style={styles.loadingScreen}>
          <Ionicons name="checkmark-circle-outline" size={52} color="#22C55E" />
          <Text style={[styles.loadingText, { color: colors.dark.text, marginTop: spacing.md, fontWeight: '700' }]}>
            Treino salvo com sucesso!
          </Text>
          <Text style={[styles.loadingText, { fontSize: fontSize.sm, marginTop: 4 }]}>
            Não foi possível exibir o resumo completo aqui.
          </Text>
          <TouchableOpacity style={styles.backFallback} onPress={() => props.navigation.popToTop()}>
            <Text style={{ color: ACCENT, fontWeight: '700' }}>Voltar ao início</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <ActivitySummaryInner {...props} />
    </ErrorBoundary>
  );
}

function ActivitySummaryInner({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const haptic = useHaptic();
  const reduceMotion = useReduceMotion();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [caption, setCaption] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);
  // Criar segmento a partir desta rota
  const [showSegModal, setShowSegModal] = useState(false);
  const [segName, setSegName] = useState('');
  const [creatingSeg, setCreatingSeg] = useState(false);
  // Foto opcional pra anexar na publicação do feed
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [newPRs, setNewPRs] = useState<PRResult[]>([]);
  // Start hidden — show only after the user has seen the summary (2.5s delay)
  const [ratingModal, setRatingModal] = useState(false);
  const ratingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prBannerAnim = useRef(new Animated.Value(0)).current;

  // Celebration animation
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const headerFade = useRef(new Animated.Value(0)).current;
  const statsSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadActivity();
    return () => {
      // Clean up timer on unmount
      if (ratingTimerRef.current) clearTimeout(ratingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!loading && activity) {
      haptic.success(); // celebração tátil ao concluir o treino
      if (reduceMotion) {
        // Sem animações: mostra tudo no estado final e agenda o rating
        checkScale.setValue(1);
        checkOpacity.setValue(1);
        headerFade.setValue(1);
        statsSlide.setValue(0);
        ratingTimerRef.current = setTimeout(() => setRatingModal(true), 2500);
        return;
      }
      Animated.sequence([
        Animated.parallel([
          Animated.spring(checkScale, { toValue: 1, tension: 70, friction: 7, useNativeDriver: true }),
          Animated.timing(checkOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(headerFade, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(statsSlide, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]).start(() => {
        // Show the rating modal only after the user has had time to see the summary
        ratingTimerRef.current = setTimeout(() => setRatingModal(true), 2500);
      });
    }
  }, [loading, activity]);

  const loadActivity = async () => {
    let loaded: Activity | null = null;
    try {
      const { data } = await api.get(`/activities/${route.params.activityId}`);
      loaded = data;
      setActivity(data);
      setLoading(false);
    } catch (error) {
      console.log('Error loading activity (attempt 1):', error);
      // Retry once after 1.5s — the finish endpoint may still be writing to DB
      try {
        await new Promise<void>((res) => setTimeout(res, 1500));
        const { data } = await api.get(`/activities/${route.params.activityId}`);
        loaded = data;
        setActivity(data);
      } catch (retryErr) {
        console.log('Error loading activity (attempt 2):', retryErr);
      } finally {
        setLoading(false);
      }
    }
    // PR detection — compare against history
    if (loaded) {
      detectPRs(loaded).catch(() => {});
    }
  };

  const detectPRs = async (current: Activity) => {
    try {
      const { data } = await api.get('/activities/records', {
        params: { sport: current.sport, excludeId: current.id },
      });
      const previous = data?.bySport?.[current.sport] || {
        longestDistance: 0,
        longestDuration: 0,
        bestPace: null,
      };
      const prs: PRResult[] = [];
      if (isDistanceActivity(current.sport) && (current.distance ?? 0) > previous.longestDistance) {
        prs.push({
          type: 'distance',
          label: previous.longestDistance > 0 ? '🏅 Novo recorde de distância!' : '🏅 Primeiro recorde de distância!',
          value: `${((current.distance ?? 0) / 1000).toFixed(2)} km`,
        });
      }
      if (!isDistanceActivity(current.sport) && (current.duration ?? 0) > previous.longestDuration) {
        prs.push({
          type: 'duration',
          label: previous.longestDuration > 0 ? '🏅 Novo recorde de duração!' : '🏅 Primeiro recorde de duração!',
          value: formatDuration(current.duration ?? 0),
        });
      }
      if (current.avgPace && (previous.bestPace == null || current.avgPace < previous.bestPace)) {
        prs.push({
          type: 'pace',
          label: previous.bestPace != null ? '⚡ Novo recorde de pace!' : '⚡ Primeiro recorde de pace!',
          value: `${current.avgPace.toFixed(1)} min/km`,
        });
      }

      if (prs.length > 0) {
        setNewPRs(prs);
        if (reduceMotion) {
          prBannerAnim.setValue(1); // sem animação, mas visível
        } else {
          Animated.spring(prBannerAnim, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }).start();
        }
      }
    } catch { /* non-critical */ }
  };

  const handleShare = async () => {
    if (!activity) return;
    try {
      const result = isDistanceActivity(activity.sport)
        ? `${((activity.distance ?? 0) / 1000).toFixed(2)} km em ${formatDuration(activity.duration ?? 0)}`
        : `${formatDuration(activity.duration ?? 0)} de atividade`;
      await Share.share({
        message: `Completei ${result} no Sync! 🔥 #Sync #${activity.sport}`,
      });
    } catch {}
  };

  // Escolhe uma foto pra anexar no post e já faz upload (URL pública)
  const pickPostPhoto = async () => {
    if (uploadingPhoto || posting) return;
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          showToast('Libere o acesso à galeria', 'error');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.6,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setUploadingPhoto(true);
      try {
        // base64 primeiro → vai pro banco e sempre exibe (disco do Render é
        // efêmero e o /media/upload dava 404). Só usa upload se não houver base64.
        if (asset.base64) {
          setPhotoUrl(`data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`);
        } else {
          const { url } = await uploadMedia(asset.uri, {
            name: `post-${Date.now()}.jpg`,
            mimeType: asset.mimeType || 'image/jpeg',
          });
          setPhotoUrl(url);
        }
      } catch {
        {
          showToast('Não foi possível enviar a foto', 'error');
          setPhotoUri(null);
        }
      } finally {
        setUploadingPhoto(false);
      }
    } catch {
      setUploadingPhoto(false);
      showToast('Erro ao escolher foto', 'error');
    }
  };

  const handlePostToFeed = async () => {
    if (!activity || posting) return;
    if (uploadingPhoto) {
      showToast('Aguarde a foto terminar de enviar…', 'info');
      return;
    }
    setPosting(true);
    try {
      await feedApi.publish({
        activityId: activity.id,
        caption: caption.trim() || undefined,
        photoUrl: photoUrl || undefined,
        distanceKm: activity.distance / 1000,
        durationSeconds: activity.duration,
        avgPace: activity.avgPace ?? undefined,
        calories: activity.calories ?? 0,
        sport: activity.sport,
      });
      setPosted(true);
      showToast('Publicado no feed! 🎉', 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Erro ao publicar', 'error');
    } finally {
      setPosting(false);
    }
  };

  // Cria um segmento usando o início e o fim da rota deste treino
  const createSegment = async () => {
    if (!activity?.points || activity.points.length < 2) return;
    const name = segName.trim();
    if (name.length < 3) {
      showToast('Dê um nome com pelo menos 3 letras ao segmento.', 'error');
      return;
    }
    const pts = activity.points;
    const start = pts[0];
    const end = pts[pts.length - 1];
    setCreatingSeg(true);
    try {
      await segmentsApi.create({ name, activityId: activity.id });
      setShowSegModal(false);
      setSegName('');
      showToast('Segmento criado! 🚩 Veja em Perfil → Segmentos.', 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Não foi possível criar o segmento.', 'error');
    } finally {
      setCreatingSeg(false);
    }
  };

  if (loading) {
    return (
      <LoadingState message="Salvando atividade…" />
    );
  }

  if (!activity) {
    return (
      <View style={styles.loadingScreen}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={[styles.loadingText, { color: '#EF4444', marginTop: spacing.md }]}>
          Atividade não encontrada
        </Text>
        <TouchableOpacity style={styles.backFallback} onPress={() => navigation.popToTop()}>
          <Text style={{ color: ACCENT, fontWeight: '700' }}>Voltar ao início</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coordinates = activity.points?.map((p) => ({ latitude: p.latitude, longitude: p.longitude })) || [];
  const calories = activity.calories ?? 0;
  const elevGain = Math.round(activity.elevationGain ?? 0);
  const distanceBased = isDistanceActivity(activity.sport);
  const sportIcon = SPORT_ICONS[activity.sport] || 'fitness';
  const sportLabel = SPORT_LABELS[activity.sport] || activity.sport;
  const accent = theme.primary;
  const accentEnd = theme.mode === 'dark' ? theme.cyan : theme.warning;
  // Splits por km (estilo Strava/Adidas) — calculados dos pontos GPS
  const splits = computeSplits(activity.points as any);
  const maxSplitPace = splits.length ? Math.max(...splits.map((s) => s.paceMinPerKm)) : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} bounces keyboardShouldPersistTaps="handled">

        {/* ── Celebration Header ── */}
        <LinearGradient
          colors={[theme.primarySoft, theme.mode === 'dark' ? 'rgba(3,9,20,0)' : 'rgba(247,248,251,0)']}
          locations={[0, 1]}
          style={[styles.heroGradient, { paddingTop: Math.max(insets.top + 12, 48) }]}
        >
          <View style={styles.topBar}>
            <TouchableOpacity style={[styles.topBtn, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => navigation.popToTop()}>
              <Ionicons name="close" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.topTitle, { color: theme.textSecondary }]}>Atividade Salva</Text>
            <TouchableOpacity style={[styles.topBtn, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={20} color={accent} />
            </TouchableOpacity>
          </View>

          {/* Checkmark + sport badge */}
          <Animated.View style={[styles.celebrationCenter, { opacity: checkOpacity, transform: [{ scale: checkScale }] }]}>
            <View style={[styles.checkCircle, { shadowColor: accent }]}>
              <LinearGradient colors={[accent, accentEnd]} style={styles.checkGradient}>
                <Ionicons name="checkmark" size={40} color="#fff" />
              </LinearGradient>
            </View>
            <View style={[styles.sportBadge, { backgroundColor: theme.primarySoft, borderColor: accent + '35' }]}>
              <Ionicons name={sportIcon} size={14} color={accent} />
              <Text style={[styles.sportBadgeText, { color: accent }]}>{sportLabel.toUpperCase()}</Text>
            </View>
          </Animated.View>

          {/* Date */}
          <Animated.Text style={[styles.dateText, { opacity: headerFade, color: theme.textSecondary }]}>
            {new Date(activity.startTime).toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
            })}
          </Animated.Text>
        </LinearGradient>

        {/* ── Métrica principal conforme o esporte ── */}
        <Animated.View style={[styles.heroStat, { opacity: headerFade, transform: [{ translateY: statsSlide }] }]}>
          <Text style={[styles.heroValue, { color: theme.textPrimary }]}>
            {distanceBased ? ((activity.distance ?? 0) / 1000).toFixed(2) : formatDuration(activity.duration ?? 0)}
          </Text>
          <Text style={[styles.heroUnit, { color: theme.textSecondary }]}>{distanceBased ? 'km' : 'tempo'}</Text>
        </Animated.View>

        {/* ── Map (envolto em ErrorBoundary: no web o Leaflet pode falhar e
              não pode derrubar a tela inteira) ── */}
        {coordinates.length > 1 && (
          <Animated.View style={[styles.mapContainer, { opacity: headerFade, borderColor: theme.border }]}>
            <ErrorBoundary
              fallback={
                <View style={[styles.map, styles.mapFallback]}>
                  <Ionicons name="map-outline" size={28} color={theme.textMuted} />
                  <Text style={[styles.mapFallbackText, { color: theme.textSecondary }]}>Rota gravada · {coordinates.length} pontos</Text>
                </View>
              }
            >
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: coordinates[0].latitude,
                  longitude: coordinates[0].longitude,
                  latitudeDelta: 0.018,
                  longitudeDelta: 0.018,
                }}
                scrollEnabled={false}
                userInterfaceStyle="dark"
                customMapStyle={darkMapStyle}
              >
                <Polyline coordinates={coordinates} strokeColor={accent} strokeWidth={4} />
                <Marker coordinate={coordinates[0]}>
                  <View style={[styles.mapDot, { backgroundColor: '#22C55E' }]}>
                    <Ionicons name="flag" size={9} color="#fff" />
                  </View>
                </Marker>
                <Marker coordinate={coordinates[coordinates.length - 1]}>
                  <View style={[styles.mapDot, { backgroundColor: accent }]}>
                    <Ionicons name="checkmark" size={9} color="#fff" />
                  </View>
                </Marker>
              </MapView>
            </ErrorBoundary>
          </Animated.View>
        )}

        {/* ── Stats Grid ── */}
        <Animated.View style={[styles.statsSection, { opacity: headerFade, transform: [{ translateY: statsSlide }] }]}>
          <View style={styles.statsGrid}>
            <StatCard icon="time-outline" value={formatDuration(activity.duration ?? 0)} label="Tempo" />
            {distanceBased && <StatCard
              icon="speedometer-outline"
              value={activity.avgPace ? `${activity.avgPace.toFixed(1)}'` : '--'}
              label="Ritmo /km"
            />}
            {distanceBased && <StatCard
              icon="flash-outline"
              value={activity.avgSpeed ? `${activity.avgSpeed.toFixed(1)}` : '--'}
              label="km/h"
            />}
            <StatCard icon="flame-outline" value={`${calories}`} label="kcal" accent />
            {(activity.laps?.length ?? 0) > 0 && (
              <StatCard icon="flag-outline" value={`${activity.laps?.length ?? 0}`} label="Voltas" />
            )}
            {elevGain > 0 && (
              <StatCard icon="trending-up-outline" value={`+${elevGain}m`} label="Ganho alt." />
            )}
            {(activity.points?.length ?? 0) > 0 && (
              <StatCard icon="location-outline" value={`${activity.points?.length ?? 0}`} label="Pontos GPS" />
            )}
          </View>
        </Animated.View>

        {/* ── Splits por km (estilo Strava/Adidas) ── */}
        {splits.length > 0 && (
          <Animated.View style={[styles.splitsCard, { opacity: headerFade, backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.splitsHeader}>
              <Ionicons name="stats-chart" size={16} color={accent} />
              <Text style={[styles.splitsTitle, { color: theme.textPrimary }]}>Splits por km</Text>
            </View>
            {splits.map((s) => {
              const widthPct = maxSplitPace > 0 ? Math.max(18, (s.paceMinPerKm / maxSplitPace) * 100) : 100;
              return (
                <View key={s.km} style={styles.splitRow}>
                  <Text style={[styles.splitKm, { color: theme.textSecondary }]}>
                    {s.distanceKm >= 0.999 ? `${s.km}` : `${s.km}·${(s.distanceKm).toFixed(2)}`}
                  </Text>
                  <View style={[styles.splitBarTrack, { backgroundColor: theme.surfaceSecondary }]}>
                    <View
                      style={[
                        styles.splitBarFill,
                        { width: `${widthPct}%`, backgroundColor: s.isFastest ? theme.warning : accent },
                      ]}
                    />
                  </View>
                  <Text style={[styles.splitPace, { color: theme.textPrimary }, s.isFastest && { color: theme.warning, fontWeight: '800' }]}>
                    {formatPace(s.paceMinPerKm)}
                    {s.isFastest ? '  🏆' : ''}
                  </Text>
                </View>
              );
            })}
            <Text style={[styles.splitsHint, { color: theme.textMuted }]}>min/km · 🏆 = km mais rápido</Text>
          </Animated.View>
        )}

        {/* ── AI Summary ── */}
        <Animated.View style={[styles.summaryCard, { opacity: headerFade, backgroundColor: theme.primarySoft, borderColor: accent + '25' }]}>
          <View style={styles.summaryHeader}>
            <Ionicons name="sparkles" size={16} color={accent} />
            <Text style={[styles.summaryTitle, { color: accent }]}>Resumo do treino</Text>
          </View>
          <Text style={[styles.summaryText, { color: theme.textPrimary }]}>
            {generateWorkoutSummary({
              distanceKm: (activity.distance ?? 0) / 1000,
              durationMinutes: (activity.duration ?? 0) / 60,
              avgPaceMinPerKm: activity.avgPace || 0,
              calories,
              sport: activity.sport,
            })}
          </Text>
        </Animated.View>

        {/* ── PR Banner ── */}
        {newPRs.length > 0 && (
          <Animated.View style={[
            styles.prBanner,
            { opacity: prBannerAnim, transform: [{ scale: prBannerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] },
          ]}>
            <LinearGradient
              colors={['rgba(252,211,77,0.15)', 'rgba(252,211,77,0.05)']}
              style={styles.prBannerInner}
            >
              <View style={styles.prBannerTop}>
                <Ionicons name="trophy" size={24} color="#FCD34D" />
                <Text style={styles.prBannerTitle}>Novos Recordes Pessoais!</Text>
              </View>
              {newPRs.map((pr, i) => (
                <View key={i} style={styles.prRow}>
                  <Text style={styles.prLabel}>{pr.label}</Text>
                  <Text style={styles.prValue}>{pr.value}</Text>
                </View>
              ))}
            </LinearGradient>
          </Animated.View>
        )}

        {/* ── Actions ── */}
        <Animated.View style={[styles.actions, { opacity: headerFade }]}>
          {!posted && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>Sua legenda (opcional)</Text>
              <TextInput
                accessibilityLabel="Legenda da publicação no feed"
                value={caption}
                onChangeText={setCaption}
                editable={!posting}
                multiline
                maxLength={500}
                placeholder="Como foi seu treino? Escreva sua mensagem…"
                placeholderTextColor={theme.placeholder}
                style={[styles.captionInput, { borderColor: theme.border, backgroundColor: theme.input, color: theme.textPrimary }]}
              />
              <Text style={{ color: theme.textSecondary, fontSize: 12, textAlign: 'right' }}>{caption.length}/500</Text>
            </View>
          )}
          {/* Foto opcional pra publicação */}
          {!posted && (
            photoUri ? (
              <View style={styles.photoPreviewWrap}>
                <ExpoImage source={{ uri: photoUri }} style={styles.photoPreview} contentFit="cover" />
                {uploadingPhoto && (
                  <View style={styles.photoUploading}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.photoRemove}
                  disabled={posting || uploadingPhoto}
                  onPress={() => { setPhotoUri(null); setPhotoUrl(null); }}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addPhotoBtn} onPress={pickPostPhoto} disabled={posting} activeOpacity={0.8}>
                <Ionicons name="camera-outline" size={20} color={accent} />
                <Text style={[styles.addPhotoText, { color: accent }]}>Adicionar foto à publicação</Text>
              </TouchableOpacity>
            )
          )}

          {/* Primary: Post to feed */}
          {!posted ? (
            <Pressable
              onPress={handlePostToFeed}
              disabled={posting || uploadingPhoto}
              style={({ pressed }) => [styles.postBtn, { shadowColor: accent }, pressed && { opacity: 0.85 }]}
            >
              <LinearGradient colors={[accent, accentEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.postBtnInner}>
                {posting ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.postBtnText}>Publicando…</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="megaphone-outline" size={20} color="#fff" />
                    <Text style={styles.postBtnText}>Publicar no Feed</Text>
                    <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.7)" />
                  </>
                )}
              </LinearGradient>
            </Pressable>
          ) : (
            <View style={styles.postedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
              <Text style={styles.postedText}>Publicado no feed!</Text>
            </View>
          )}

          {/* Exportação de imagem disponível também para treinos sem GPS. */}
          <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: theme.primarySoft, borderColor: accent + '28' }]} onPress={() => setShowImageModal(true)}>
            <Ionicons name="download-outline" size={18} color={accent} />
            <Text style={[styles.secondaryBtnText, { color: accent }]}>Exportar imagem do treino</Text>
          </TouchableOpacity>

          {/* Secondary: Criar segmento a partir desta rota */}
          {activity.points && activity.points.length > 1 && (
            <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: theme.primarySoft, borderColor: accent + '28' }]} onPress={() => setShowSegModal(true)}>
              <Ionicons name="flag-outline" size={18} color={accent} />
              <Text style={[styles.secondaryBtnText, { color: accent }]}>Criar segmento desta rota</Text>
            </TouchableOpacity>
          )}

          {/* Tertiary: Go home */}
          <TouchableOpacity style={[styles.homeBtn, { borderColor: theme.border }]} onPress={() => navigation.popToTop()}>
            <Text style={[styles.homeBtnText, { color: theme.textSecondary }]}>Pronto</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 60 }} />

        {/* Modal: nomear e criar segmento desta rota */}
        <Modal visible={showSegModal} transparent animationType="fade" onRequestClose={() => setShowSegModal(false)}>
          <View style={styles.segModalOverlay}>
            <View style={[styles.segModalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="flag" size={28} color={accent} style={{ alignSelf: 'center' }} />
              <Text style={[styles.segModalTitle, { color: theme.textPrimary }]}>Criar segmento</Text>
              <Text style={[styles.segModalSub, { color: theme.textSecondary }]}>
                O percurso inteiro deste treino ficará público, junto ao seu nome. Evite rotas perto de casa. Use um trajeto contínuo de 100 m a 5 km, sem pausas ou falhas de GPS. O nome e os tempos deste treino também entram nos segmentos compatíveis. Participar é opcional e não dá XP extra.
              </Text>
              <TextInput
                style={[styles.segInput, { backgroundColor: theme.input, borderColor: theme.border, color: theme.textPrimary }]}
                value={segName}
                onChangeText={setSegName}
                placeholder="Ex: Subida do Parque"
                placeholderTextColor={theme.placeholder}
                maxLength={100}
              />
              <View style={styles.segModalActions}>
                <TouchableOpacity style={[styles.segCancel, { borderColor: theme.border }]} onPress={() => setShowSegModal(false)}>
                  <Text style={[styles.segCancelText, { color: theme.textSecondary }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.segSave, { backgroundColor: accent }]} onPress={createSegment} disabled={creatingSeg}>
                  {creatingSeg ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.segSaveText}>Criar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>

      <WorkoutImageModal visible={showImageModal} activity={activity} onClose={() => setShowImageModal(false)} />
      {/* Post-workout rating modal */}
      <PostWorkoutRatingModal
        visible={ratingModal && !!activity?.id}
        activityId={activity?.id || null}
        onClose={() => setRatingModal(false)}
        onSaved={() => setRatingModal(false)}
      />
    </View>
  );
}

// ─────────────────────── helpers ───────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─────────────────────── StatCard ───────────────────────

function StatCard({
  icon,
  value,
  label,
  accent = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  accent?: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);
  const accentColor = theme.primary;

  return (
    <View
      style={[
        cardStyles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        accent && { borderColor: accentColor + '35', backgroundColor: theme.primarySoft },
      ]}
    >
      <Ionicons name={icon} size={18} color={accent ? accentColor : theme.textSecondary} />
      <Text style={[cardStyles.value, { color: accent ? accentColor : theme.textPrimary }]}>{value}</Text>
      <Text style={[cardStyles.label, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  cardAccent: {
    borderColor: ACCENT + '35',
    backgroundColor: ACCENT + '0D',
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.dark.text,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 10,
    color: colors.dark.secondaryText,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
});

// ─────────────────────── map style ───────────────────────

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a28' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b6b88' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a28' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a40' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a0e1a' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#202030' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e1e30' }] },
];

// ─────────────────────── styles ───────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    color: colors.dark.secondaryText,
    fontSize: fontSize.md,
  },
  backFallback: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },

  // Header / hero
  heroGradient: {
    // paddingTop dinâmico via insets no JSX (notch/safe-area)
    paddingBottom: spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  topBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  topTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.dark.secondaryText,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  celebrationCenter: {
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40,
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 14,
  },
  checkGradient: {
    flex: 1, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  sportBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: ACCENT + '18',
    borderWidth: 1, borderColor: ACCENT + '35',
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: 20,
  },
  sportBadgeText: {
    color: ACCENT, fontSize: 11, fontWeight: '800', letterSpacing: 1.5,
  },
  dateText: {
    textAlign: 'center',
    color: colors.dark.secondaryText,
    fontSize: fontSize.sm,
    textTransform: 'capitalize',
  },

  // Big distance stat
  heroStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: 6,
  },
  heroValue: {
    fontSize: 76,
    fontWeight: '200',
    color: colors.dark.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
  },
  heroUnit: {
    fontSize: 26,
    fontWeight: '300',
    color: colors.dark.secondaryText,
    paddingBottom: 8,
  },

  // Map
  mapContainer: {
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    height: 220,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: spacing.lg,
  },
  map: { flex: 1 },
  mapFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  mapFallbackText: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '600' },
  mapDot: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(0,0,0,0.4)',
  },

  // Splits por km
  splitsCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: spacing.md,
  },
  splitsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  splitsTitle: { fontSize: 15, fontWeight: '800', color: colors.dark.text },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 3 },
  splitKm: { width: 38, fontSize: 12, fontWeight: '700', color: colors.dark.secondaryText },
  splitBarTrack: {
    flex: 1, height: 14, borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
    justifyContent: 'center',
  },
  splitBarFill: { height: '100%', borderRadius: 7 },
  splitPace: { width: 64, textAlign: 'right', fontSize: 12, fontWeight: '700', color: colors.dark.text, fontVariant: ['tabular-nums'] },
  splitsHint: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 8, textAlign: 'center' },

  // Stats grid
  statsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  // AI summary
  summaryCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,107,53,0.06)',
    borderWidth: 1,
    borderColor: ACCENT + '25',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  summaryTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryText: {
    color: colors.dark.text,
    fontSize: fontSize.sm,
    lineHeight: 21,
    opacity: 0.9,
  },

  // Actions
  captionInput: { minHeight: 110, padding: 14, borderRadius: 12, borderWidth: 1, fontSize: 15, textAlignVertical: 'top' },
  actions: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  postBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  postBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 17,
    paddingHorizontal: spacing.lg,
  },
  postBtnText: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  postedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: '#22C55E40',
  },
  postedText: {
    color: '#22C55E',
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: ACCENT + '55',
  },
  addPhotoText: { color: ACCENT, fontSize: fontSize.sm, fontWeight: '700' },
  photoPreviewWrap: {
    position: 'relative',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  photoPreview: { width: '100%', aspectRatio: 4 / 3, backgroundColor: 'rgba(255,255,255,0.06)' },
  photoUploading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: ACCENT + '12',
    borderWidth: 1,
    borderColor: ACCENT + '28',
  },
  secondaryBtnText: {
    color: ACCENT,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  segModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  segModalCard: { width: '100%', maxWidth: 360, backgroundColor: '#15151F', borderRadius: 18, padding: 22 },
  segModalTitle: { fontSize: 18, fontWeight: '800', color: '#fff', textAlign: 'center', marginTop: 8 },
  segModalSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 6, lineHeight: 19 },
  segInput: {
    marginTop: 16, backgroundColor: '#0A0A0F', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: '#fff', fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  segModalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  segCancel: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  segCancelText: { color: 'rgba(255,255,255,0.7)', fontWeight: '700' },
  segSave: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: ACCENT, alignItems: 'center' },
  segSaveText: { color: '#fff', fontWeight: '800' },
  homeBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  homeBtnText: {
    color: colors.dark.secondaryText,
    fontSize: fontSize.md,
    fontWeight: '600',
  },

  // ── PR Banner ──────────────────────────────────────────────────────────────
  prBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.30)',
  },
  prBannerInner: { padding: spacing.lg, gap: spacing.sm },
  prBannerTop: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4,
  },
  prBannerTitle: { fontSize: 16, fontWeight: '800', color: '#FCD34D' },
  prRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  prLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  prValue: { fontSize: 13, color: '#FCD34D', fontWeight: '800' },
});
