import { routeGuidance } from '../../utils/route-guidance';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Dimensions,
  AppState,
} from 'react-native';
import MapView, { Polyline, Marker } from '../../components/map/SyncMap';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TrackingStackParamList } from '../../navigation/types';
import { colors, fontSize, spacing, borderRadius } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoLocation from 'expo-location';
import api, { WEB_APP_URL } from '../../services/api';
import { territoryApi } from '../../services/territory.service';
import { trackingSocket } from '../../services/tracking-socket.service';
import { Share } from 'react-native';
import { AutoPauseDetector, supportsAutoPause } from '../../utils/auto-pause';
import { calculateActiveDurationSeconds } from '../../utils/tracking-timing';
import { calculateLiveCalories, isDistanceActivity } from '../../utils/activity-metrics';
import { showToast } from '../../components/ui/Toast';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import {
  drainBackgroundPoints,
  acknowledgeBackgroundPoints,
  getBackgroundTrackingContext,
  setBackgroundAppForeground,
  setBackgroundTrackingManualPause,
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../../services/background-tracking.service';
// HoldToFinishButton and ConfirmModal replaced by simple tap + Alert

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
  navigation: NativeStackNavigationProp<TrackingStackParamList, 'ActiveTracking'>;
  route: RouteProp<TrackingStackParamList, 'ActiveTracking'>;
};

type TrackingPoint = {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
  timestamp: number;
  segmentStart: boolean;
};

type PauseSource = 'manual' | 'auto' | 'confirmation';

export default function ActiveTrackingScreen({ navigation, route }: Props) {
  const {
    sport,
    enableLiveShare = false,
    existingActivityId,
    existingStartedAt,
    goalType,
    goalValue,
    countLaps = false,
    territoryOptIn = false,
    segmentsOptIn = false,
  } = route.params;
  const theme = useThemeStore((s) => s.theme);
  const profile = useAuthStore((s) => s.user);
  const distanceBased = isDistanceActivity(sport);
  const activityIdRef = useRef<string | null>(existingActivityId || null);
  const [plannedRoute, setPlannedRoute] = useState(route.params.plannedRoute || []);
  const [points, setPoints] = useState<TrackingPoint[]>([]);
  const pointsRef = useRef<TrackingPoint[]>([]);
  const knownPointTimesRef = useRef(new Set<number>());
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const distanceRef = useRef(0);
  const [elevationGain, setElevationGain] = useState(0);
  const [currentAltitude, setCurrentAltitude] = useState<number | null>(null);
  const [region, setRegion] = useState<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }>({
    latitude: -23.5505,
    longitude: -46.6333,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });
  const [isPaused, setIsPaused] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [laps, setLaps] = useState<Array<{ number: number; time: number; distance: number }>>([]);
  const [lapStartTime, setLapStartTime] = useState(0);
  const [lapStartDistance, setLapStartDistance] = useState(0);
  const locationSub = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const backgroundPollRef = useRef<any>(null);
  const mapRef = useRef<any>(null);

  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [autoPauseOn, setAutoPauseOn] = useState(supportsAutoPause(sport));
  const autoPauseOnRef = useRef(autoPauseOn);
  const autoPauseRef = useRef<AutoPauseDetector>(new AutoPauseDetector(sport));
  const drainingRef = useRef<Promise<void> | null>(null);
  const [backgroundAvailable, setBackgroundAvailable] = useState(false);
  const goalAnnouncedRef = useRef(false);
  const [targetGoal, setTargetGoal] = useState<{ type: 'distance' | 'duration'; value: number } | null>(
    goalType && goalValue ? { type: goalType, value: goalValue } : null,
  );
  const appStateRef = useRef(AppState.currentState);
  const isPausedRef = useRef(false);
  const pauseSourceRef = useRef<PauseSource | null>(null);
  const activityStartedAtRef = useRef<number | null>(
    existingStartedAt ? new Date(existingStartedAt).getTime() : null,
  );
  const totalPausedMsRef = useRef(0);
  const pauseStartedAtRef = useRef<number | null>(null);
  const resumeNeedsAnchorRef = useRef(true);
  const pauseSyncRef = useRef<Promise<void>>(Promise.resolve());
  const finishingRef = useRef(false);
  const confirmingFinishRef = useRef(false);

  // ── Contagem regressiva de 10s antes de começar (com voz, pulável) ─────────
  const [countdown, setCountdown] = useState<number | null>(existingActivityId ? null : 10);
  const [initializing, setInitializing] = useState(Boolean(existingActivityId));
  const startedRef = useRef(false);

  useEffect(() => { autoPauseOnRef.current = autoPauseOn; }, [autoPauseOn]);

  function calculateActiveElapsed(at = Date.now()) {
    return calculateActiveDurationSeconds({
      startedAt: activityStartedAtRef.current,
      now: at,
      totalPausedMs: totalPausedMsRef.current,
      pausedAt: pauseStartedAtRef.current,
    });
  }

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    setElapsed(calculateActiveElapsed());
    if (isPausedRef.current) {
      timerRef.current = null;
      return;
    }
    timerRef.current = setInterval(() => {
      setElapsed(calculateActiveElapsed());
    }, 500);
  }

  function queuePauseSync(action: 'pause' | 'resume', occurredAt: number) {
    const id = activityIdRef.current;
    if (!id) return;
    pauseSyncRef.current = pauseSyncRef.current
      .catch(() => undefined)
      .then(() => api.put(`/activities/${id}/${action}`, {
        occurredAt: new Date(occurredAt).toISOString(),
      }).then(() => undefined))
      .catch((error) => {
        console.warn(`[tracking] ${action} sync failed:`, error);
      });
  }

  function enterPause(source: PauseSource, occurredAt = Date.now()) {
    if (isPausedRef.current) return;
    isPausedRef.current = true;
    pauseSourceRef.current = source;
    pauseStartedAtRef.current = occurredAt;
    resumeNeedsAnchorRef.current = true;
    setIsPaused(true);
    setElapsed(calculateActiveElapsed(occurredAt));
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (source !== 'auto') {
      autoPauseRef.current.reset();
      void setBackgroundTrackingManualPause(true);
    }
    queuePauseSync('pause', occurredAt);
  }

  function leavePause(source: PauseSource, occurredAt = Date.now()) {
    if (!isPausedRef.current) return;
    if (pauseSourceRef.current === 'manual' && source === 'auto') return;
    if (pauseStartedAtRef.current != null) {
      totalPausedMsRef.current += Math.max(0, occurredAt - pauseStartedAtRef.current);
    }
    const previousSource = pauseSourceRef.current;
    pauseStartedAtRef.current = null;
    pauseSourceRef.current = null;
    isPausedRef.current = false;
    resumeNeedsAnchorRef.current = true;
    setIsPaused(false);
    if (source !== 'auto' || previousSource !== 'auto') {
      autoPauseRef.current.reset();
    }
    if (previousSource !== 'auto') void setBackgroundTrackingManualPause(false);
    queuePauseSync('resume', occurredAt);
    startTimer();
  }

  async function ensureForegroundLocationPermission(): Promise<boolean> {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.geolocation) return true;
      showToast('Seu navegador não suporta geolocalização.', 'error');
      return false;
    }
    const current = await ExpoLocation.getForegroundPermissionsAsync();
    const permission = current.status === 'granted'
      ? current
      : await ExpoLocation.requestForegroundPermissionsAsync();
    if (permission.status === 'granted') return true;
    Alert.alert(
      'Permissão necessária',
      'O Sync precisa de acesso à sua localização para registrar a atividade.',
    );
    return false;
  }

  async function hydrateExistingActivity(id: string): Promise<boolean> {
    const { data } = await api.get(`/activities/${id}`);
    if (data.isCompleted) {
      await stopBackgroundTracking({ clearQueue: true });
      navigation.replace('ActivitySummary', { activityId: id });
      return false;
    }

    const hydrated: TrackingPoint[] = (Array.isArray(data.points) ? data.points : [])
      .map((point: any, index: number) => ({
        latitude: Number(point.latitude),
        longitude: Number(point.longitude),
        altitude: point.altitude == null ? undefined : Number(point.altitude),
        timestamp: new Date(point.timestamp).getTime(),
        segmentStart: index === 0 || Boolean(point.segmentStart),
      }))
      .filter((point: TrackingPoint) => (
        Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Number.isFinite(point.timestamp)
      ))
      .sort((a: TrackingPoint, b: TrackingPoint) => a.timestamp - b.timestamp);

    pointsRef.current = hydrated;
    knownPointTimesRef.current = new Set(hydrated.map((point) => point.timestamp));
    setPoints(hydrated);
    let restoredDistance = 0;
    let restoredElevation = 0;
    for (let i = 1; i < hydrated.length; i++) {
      if (hydrated[i].segmentStart) continue;
      restoredDistance += haversine(
        hydrated[i - 1].latitude,
        hydrated[i - 1].longitude,
        hydrated[i].latitude,
        hydrated[i].longitude,
      );
      const previousAltitude = hydrated[i - 1].altitude;
      const currentAltitude = hydrated[i].altitude;
      if (previousAltitude != null && currentAltitude != null) {
        const gain = currentAltitude - previousAltitude;
        if (gain > 0.5 && gain < 30) restoredElevation += gain;
      }
    }
    distanceRef.current = restoredDistance;
    setDistance(restoredDistance);
    setElevationGain(restoredElevation);
    const last = hydrated[hydrated.length - 1];
    if (last) {
      setCurrentAltitude(last.altitude ?? null);
      setRegion((current) => ({ ...current, latitude: last.latitude, longitude: last.longitude }));
    }

    setPlannedRoute(Array.isArray(data.plannedRoute) ? data.plannedRoute : []);
    const startedAt = new Date(data.startTime || existingStartedAt || Date.now()).getTime();
    activityStartedAtRef.current = Number.isFinite(startedAt) ? startedAt : Date.now();
    totalPausedMsRef.current = Math.max(0, Number(data.pausedDuration || 0) * 1000);
    if (data.goalType && data.goalValue) {
      setTargetGoal({ type: data.goalType, value: Number(data.goalValue) });
    }
    if (data.liveToken && Date.parse(data.liveTokenExpiresAt) > Date.now()) {
      setLiveUrl(`${WEB_APP_URL}/live/${encodeURIComponent(data.liveToken)}`);
    }
    const storedContext = await getBackgroundTrackingContext();
    if (data.pausedAt) {
      const pausedAt = new Date(data.pausedAt).getTime();
      pauseStartedAtRef.current = Number.isFinite(pausedAt) ? pausedAt : Date.now();
      pauseSourceRef.current = storedContext?.manuallyPaused ? 'manual' : 'auto';
      isPausedRef.current = true;
      setIsPaused(true);
    }
    resumeNeedsAnchorRef.current = hydrated.length === 0 || isPausedRef.current;
    setElapsed(calculateActiveElapsed());
    return true;
  }

  const beginWorkout = async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setInitializing(true);
    try {
      const locationAllowed = distanceBased ? await ensureForegroundLocationPermission() : false;
      if (distanceBased && !locationAllowed && !existingActivityId) {
        startedRef.current = false;
        setInitializing(false);
        navigation.goBack();
        return;
      }

      let id = existingActivityId || null;
      if (!id) {
        // O registro nasce apenas depois do countdown. Isso também evita
        // atividades vazias quando o usuário abandona a contagem regressiva.
        const { data } = await api.post('/activities/start', {
          sport,
          goalType: targetGoal?.type,
          goalValue: targetGoal?.value,
          territoryOptIn,
          segmentsOptIn,
          plannedRoute: plannedRoute.length > 1 ? plannedRoute : undefined,
        });
        id = data.id;
        activityStartedAtRef.current = new Date(data.startTime || Date.now()).getTime();
      } else if (!(await hydrateExistingActivity(id))) {
        return;
      }
      if (!id) throw new Error('A API não retornou o identificador da atividade');

      activityIdRef.current = id;
      if (distanceBased) trackingSocket.startBroadcasting(id);
      startTimer();
      setInitializing(false);
      if (locationAllowed) void startTracking();
      if (distanceBased) {
        void startBackgroundTracking({
          activityId: id,
          sport,
          startedAt: new Date(activityStartedAtRef.current || Date.now()).toISOString(),
          manuallyPaused: pauseSourceRef.current !== null && pauseSourceRef.current !== 'auto',
        }).then(setBackgroundAvailable);
        if (backgroundPollRef.current) clearInterval(backgroundPollRef.current);
        backgroundPollRef.current = setInterval(() => void drainQueuedPoints().catch(() => {}), 5000);
        await drainQueuedPoints().catch(() => {});
      }
      if (distanceBased && enableLiveShare && !existingActivityId) void handleShareLive(id);
    } catch (error: any) {
      startedRef.current = false;
      setInitializing(false);
      const message = error?.response?.data?.message || 'Não foi possível iniciar o treino. Verifique sua conexão.';
      showToast(Array.isArray(message) ? message.join(' • ') : message, 'error');
      if (!existingActivityId) navigation.goBack();
    }
  };

  // Driver da contagem regressiva
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      void beginWorkout();
      return;
    }
    const t = setTimeout(() => {
      setCountdown((c) => (c === null ? null : c - 1));
    }, 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const skipCountdown = () => setCountdown(0);

  useEffect(() => {
    if (existingActivityId) void beginWorkout();
  }, []);

  useEffect(() => {
    setBackgroundAppForeground(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      const foreground = nextState === 'active';
      setBackgroundAppForeground(foreground);
      if (foreground) {
        setElapsed(calculateActiveElapsed());
        void drainQueuedPoints().catch(() => {});
      }
    });
    return () => subscription.remove();
  }, []);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      setBackgroundAppForeground(false);
      locationSub.current?.remove();
      if (timerRef.current) clearInterval(timerRef.current);
      if (backgroundPollRef.current) clearInterval(backgroundPollRef.current);
      trackingSocket.disconnect();
    };
  }, []);

  // A meta fica visível e persistida na atividade; o aviso ocorre uma única vez.
  useEffect(() => {
    if (!targetGoal || goalAnnouncedRef.current) return;
    const reached = targetGoal.type === 'distance' ? distance >= targetGoal.value : elapsed >= targetGoal.value;
    if (!reached) return;
    goalAnnouncedRef.current = true;
    showToast('Meta alcançada! Continue no seu ritmo.', 'success');
  }, [distance, elapsed, targetGoal]);

  const startTracking = async () => {
    try {
      locationSub.current?.remove();
      locationSub.current = null;
      // Web: usa navigator.geolocation com throttle de 2s para evitar re-renders excessivos
      if (Platform.OS === 'web') {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          showToast('Seu navegador não suporta geolocalização.', 'error');
          return;
        }
        // Get current position first to center the map immediately
        navigator.geolocation.getCurrentPosition(
          (pos) => handleNewPoint({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            altitude: pos.coords.altitude ?? undefined,
            accuracy: pos.coords.accuracy ?? undefined,
            speed: pos.coords.speed ?? undefined,
            timestamp: pos.timestamp,
          }),
          () => {},
          { enableHighAccuracy: true, timeout: 10000 },
        );
        let lastWebGPS = 0;
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            const now = Date.now();
            if (now - lastWebGPS < 1500) return; // throttle leve; filtro fino em handleNewPoint
            lastWebGPS = now;
            handleNewPoint({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              altitude: pos.coords.altitude ?? undefined,
              accuracy: pos.coords.accuracy ?? undefined,
              speed: pos.coords.speed ?? undefined,
              timestamp: pos.timestamp,
            });
          },
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              showToast('Libere a localização no cadeado da barra de endereço.', 'error');
            }
          },
          { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 },
        );
        locationSub.current = { remove: () => navigator.geolocation.clearWatch(id) };
        return;
      }

      const { status } = await ExpoLocation.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão necessária',
          'O Sync precisa de acesso à sua localização para registrar a atividade.',
          [{ text: 'Voltar', onPress: () => navigation.goBack() }],
        );
        return;
      }

      locationSub.current = await ExpoLocation.watchPositionAsync(
        {
          accuracy: ExpoLocation.Accuracy.BestForNavigation,
          // Solicita também fixes estacionários para detectar a pausa.
          // A filtragem de precisão/jitter acontece em handleNewPoint.
          distanceInterval: 0,
          timeInterval: 1000,
          mayShowUserSettingsDialog: true,
        },
        (location) => handleNewPoint({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: location.coords.altitude ?? undefined,
          accuracy: location.coords.accuracy ?? undefined,
          speed: location.coords.speed ?? undefined,
          timestamp: location.timestamp,
        }),
      );
    } catch (e) {
      console.warn('[tracking] startTracking error:', e);
    }
  };

  async function drainQueuedPoints() {
    const id = activityIdRef.current;
    if (!id || appStateRef.current !== 'active') return;
    if (drainingRef.current) return drainingRef.current;
    const drain = (async () => {
      while (true) {
        const queued = await drainBackgroundPoints(id);
        if (!queued.length) return;
        for (const point of queued) handleNewPoint(point, true);
        const times = new Set(queued.map(p => p.timestamp));
        const accepted = pointsRef.current.filter(p => times.has(p.timestamp));
        if (accepted.length) await api.post(`/activities/${id}/points/batch`, {
          points: accepted.map(p => ({ latitude: p.latitude, longitude: p.longitude, altitude: p.altitude,
            segmentStart: p.segmentStart, timestamp: new Date(p.timestamp).toISOString() })),
        });
        // Só remove da fila durável depois da confirmação REST. Reenvio é idempotente.
        await acknowledgeBackgroundPoints(id, queued.map(p => p.timestamp));
      }
    })();
    drainingRef.current = drain;
    try { await drain; }
    finally { drainingRef.current = null; }
  }

  const handleNewPoint = (
    newPoint: {
      latitude: number;
      longitude: number;
      altitude?: number;
      accuracy?: number;
      speed?: number;
      timestamp?: number;
    },
    fromBackground = false,
  ) => {
    const id = activityIdRef.current;
    if (!id || (!fromBackground && appStateRef.current !== 'active')) return;
    // ── Filtro de precisão (estilo Strava): descarta fixes ruins do GPS ──
    // accuracy = raio de erro em metros. Acima de ~35m o ponto é lixo e
    // distorce a rota/distância. Descarta ANTES de contar distância ou desenhar.
    if (newPoint.accuracy != null && newPoint.accuracy > 35) {
      return;
    }

    const timestamp = Number.isFinite(newPoint.timestamp) ? Number(newPoint.timestamp) : Date.now();
    if (knownPointTimesRef.current.has(timestamp)) return;
    if (timestamp < (activityStartedAtRef.current || 0) || timestamp > Date.now() + 5000) return;
    const latest = pointsRef.current[pointsRef.current.length - 1];
    if (latest && timestamp <= latest.timestamp) return;

    // O mapa acompanha a posição mesmo quando o treino está pausado.
    setRegion({
      latitude: newPoint.latitude,
      longitude: newPoint.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    });

    // Auto-pause detector
    if (autoPauseOnRef.current && pauseSourceRef.current !== 'manual' && pauseSourceRef.current !== 'confirmation') {
      const action = autoPauseRef.current.push({ ...newPoint, timestamp });
      if (action === 'pause' && !isPausedRef.current) enterPause('auto', timestamp);
      else if (action === 'resume' && pauseSourceRef.current === 'auto') leavePause('auto', timestamp);
    }
    if (isPausedRef.current) return;

    const previousPoints = pointsRef.current;
    const segmentStart = resumeNeedsAnchorRef.current || previousPoints.length === 0 ||
      timestamp - previousPoints[previousPoints.length - 1].timestamp > 15_000;
    const stampedPoint: TrackingPoint = {
      latitude: newPoint.latitude,
      longitude: newPoint.longitude,
      altitude: newPoint.altitude,
      accuracy: newPoint.accuracy,
      speed: newPoint.speed,
      timestamp,
      segmentStart,
    };
    if (previousPoints.length > 0 && !segmentStart) {
      const last = previousPoints[previousPoints.length - 1];
      const d = haversine(last.latitude, last.longitude, newPoint.latitude, newPoint.longitude);
      // Anti-jitter: ignora micro-movimentos (<2.5m) — GPS oscila parado e
      // isso inflava a distância. Anti-salto: ignora teleportes (>60m/tick).
      if (d < 2.5 || d > 60) {
        return; // não adiciona nem transmite o ponto (evita serrilhado na rota)
      }
      distanceRef.current += d;
      setDistance(distanceRef.current);
      // Ganho de elevação acumulado (suavizado)
      if (last.altitude != null && newPoint.altitude != null) {
        const diff = newPoint.altitude - last.altitude;
        if (diff > 0.5 && diff < 30) {
          setElevationGain((prevGain) => prevGain + diff);
        }
      }
    }
    resumeNeedsAnchorRef.current = false;
    knownPointTimesRef.current.add(timestamp);
    pointsRef.current = [...previousPoints, stampedPoint];
    setPoints(pointsRef.current);

    if (newPoint.altitude != null) setCurrentAltitude(newPoint.altitude);

    // Streama via WebSocket (não bloqueia se falhar)
    try {
      trackingSocket.sendPoint({
        activityId: id,
        latitude: newPoint.latitude,
        longitude: newPoint.longitude,
        altitude: newPoint.altitude,
        segmentStart,
        timestamp: new Date(stampedPoint.timestamp).toISOString(),
      });
    } catch {}
  };

  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const togglePause = () => {
    if (isPausedRef.current) leavePause('manual');
    else enterPause('manual');
  };

  const toggleAutoPause = () => {
    const enabled = !autoPauseOnRef.current;
    autoPauseOnRef.current = enabled;
    setAutoPauseOn(enabled);
    autoPauseRef.current.reset();
    if (!enabled && pauseSourceRef.current === 'auto') leavePause('auto');
  };

  const [finishing, setFinishing] = useState(false);

  const doFinish = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    const pauseSourceAtFinish = pauseSourceRef.current;
    locationSub.current?.remove();
    locationSub.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try {
      await stopBackgroundTracking({ preserveContext: true });
      // Pode existir um último lote entregue pelo SO durante a parada da task.
      await drainQueuedPoints();
      const activeDurationSeconds = calculateActiveElapsed();
      setElapsed(activeDurationSeconds);
      await pauseSyncRef.current.catch(() => undefined);
      const id = activityIdRef.current;
      if (!id) throw new Error('Atividade não iniciada');
      // Aguarda o backend persistir o buffer WebSocket antes de calcular métricas.
      // O endpoint REST também força um flush como segunda camada de garantia.
      await trackingSocket.finish(id).catch(() => {});
      // O backend reconcilia esta cópia local com o buffer do socket. Assim,
      // uma queda de conexão no último segundo não elimina o fim da rota.
      await api.put(`/activities/${id}/finish`, {
        activeDurationSeconds,
        points: pointsRef.current.map((point) => ({
          latitude: point.latitude,
          longitude: point.longitude,
          altitude: point.altitude,
          segmentStart: point.segmentStart,
          timestamp: new Date(point.timestamp).toISOString(),
        })),
        laps,
      });
      await stopBackgroundTracking({ clearQueue: true });
      trackingSocket.disconnect();
      // Jogo de territórios: conquista as células da rota percorrida (fire-and-forget)
      if (pointsRef.current.length > 0) {
        territoryApi
          .claim(id)
          .catch(() => {});
      }
      navigation.replace('ActivitySummary', { activityId: id });
    } catch (e: any) {
      finishingRef.current = false;
      confirmingFinishRef.current = false;
      setFinishing(false);
      if (pauseSourceAtFinish === 'confirmation' && pauseSourceRef.current === 'confirmation') {
        leavePause('confirmation');
      }
      const id = activityIdRef.current;
      if (id && distanceBased) {
        void startBackgroundTracking({
          activityId: id,
          sport,
          startedAt: new Date(activityStartedAtRef.current || Date.now()).toISOString(),
          manuallyPaused: isPausedRef.current && pauseSourceRef.current !== 'auto',
        }).then(setBackgroundAvailable);
      }
      if (distanceBased) void startTracking();
      if (!isPausedRef.current) startTimer();
      const msg = e?.response?.data?.message || 'Não foi possível finalizar. Tente novamente.';
      showToast(Array.isArray(msg) ? msg.join(' • ') : msg, 'error');
    }
  };

  const requestFinish = async () => {
    if (confirmingFinishRef.current || finishingRef.current) return;
    confirmingFinishRef.current = true;
    // Incorpora primeiro qualquer lote que o sistema operacional acabou de
    // devolver; assim, abrir a confirmação não elimina os últimos pontos.
    try { await drainQueuedPoints(); }
    catch {
      confirmingFinishRef.current = false;
      showToast('Há pontos GPS aguardando sincronização. Reconecte e tente finalizar novamente.', 'error');
      return;
    }
    // Pause timer while user decides
    const wasRunning = !isPausedRef.current;
    if (wasRunning) enterPause('confirmation');

    const resume = () => {
      confirmingFinishRef.current = false;
      if (wasRunning) leavePause('confirmation');
    };

    const message = distanceBased
      ? `Você percorreu ${(distance / 1000).toFixed(2)} km em ${Math.floor(elapsed / 60)}min. Deseja encerrar?`
      : `Você treinou por ${Math.floor(elapsed / 60)}min. Deseja encerrar?`;

    // No WEB o Alert.alert do RN ignora os botões (vira window.alert), então o
    // callback nunca dispara. Usamos window.confirm, que funciona de verdade.
    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined' && window.confirm(`Finalizar treino?\n\n${message}`);
      if (ok) doFinish();
      else resume();
      return;
    }

    Alert.alert(
      'Finalizar treino?',
      message,
      [
        { text: 'Não, continuar', style: 'cancel', onPress: resume },
        { text: 'Sim, finalizar', style: 'destructive', onPress: doFinish },
      ],
    );
  };

  const handleFinish = requestFinish;

  async function handleShareLive(targetActivityId = activityIdRef.current) {
    if (!targetActivityId) return;
    if (sharing) return;
    setSharing(true);
    try {
      const { data } = await api.post(`/activities/${targetActivityId}/share`);
      // Constrói URL pública baseado no host atual (web) ou domínio fixo (mobile)
      const returnedUrl = typeof data.url === 'string' ? data.url : '';
      const url = returnedUrl.startsWith('http')
        ? returnedUrl
        : `${WEB_APP_URL}/live/${data.liveToken}`;
      setLiveUrl(url);
      try {
        await Share.share({
          message: `Acompanhe meu treino ao vivo no Sync: ${url}`,
          url,
        });
      } catch {
        // Web não suporta Share.share — só guardamos a URL no estado
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Não foi possível gerar o link', 'error');
    } finally {
      setSharing(false);
    }
  }

  async function stopSharingLive() {
    const id = activityIdRef.current;
    if (!id || sharing) return;
    setSharing(true);
    try {
      await api.delete(`/activities/${id}/share`);
      setLiveUrl(null);
      showToast('Compartilhamento interrompido. O link anterior não recebe mais sua localização.', 'success');
    } catch { showToast('Não foi possível interromper o compartilhamento. Tente novamente.', 'error'); }
    finally { setSharing(false); }
  }

  const handleLap = () => {
    const lapTime = elapsed - lapStartTime;
    const lapDist = distance - lapStartDistance;
    const newLap = {
      number: laps.length + 1,
      time: lapTime,
      distance: lapDist,
    };
    setLaps((prev) => [...prev, newLap]);
    setLapStartTime(elapsed);
    setLapStartDistance(distance);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const distanceKm = (distance / 1000).toFixed(2);
  // Pace em min:seg/km (formato real)
  const paceRaw = distance > 0 ? (elapsed / 60) / (distance / 1000) : 0;
  const pace = paceRaw > 0
    ? `${Math.floor(paceRaw)}:${Math.round((paceRaw - Math.floor(paceRaw)) * 60).toString().padStart(2, '0')}`
    : '--:--';
  const speedKmh = elapsed > 0 ? (distance / 1000) / (elapsed / 3600) : 0;
  const speed = speedKmh.toFixed(1);
  const calories = calculateLiveCalories({
    sport,
    elapsedSeconds: elapsed,
    distanceMeters: distance,
    weightKg: profile?.weightKg,
    heightCm: profile?.heightCm,
  });
  const altitudeM = currentAltitude != null ? Math.round(currentAltitude) : '--';
  const elevationGainStr = elevationGain > 0 ? `+${Math.round(elevationGain)}` : '0';
  const accent = theme.primary;
  const routeSegments = points.reduce<TrackingPoint[][]>((segments, point) => {
    if (point.segmentStart || segments.length === 0) segments.push([point]);
    else segments[segments.length - 1].push(point);
    return segments;
  }, []);

  if (initializing) {
    return (
      <View style={[styles.countdownOverlay, { backgroundColor: theme.background }]}>
        <Ionicons name="locate" size={52} color={accent} />
        <Text style={[styles.countdownLabel, { color: theme.textSecondary }]}>Iniciando treino…</Text>
      </View>
    );
  }

  // Overlay de contagem regressiva — cobre tudo até começar
  if (countdown !== null && countdown > 0) {
    return (
      <TouchableOpacity
        style={[styles.countdownOverlay, { backgroundColor: theme.background }]}
        activeOpacity={1}
        onPress={skipCountdown}
        accessibilityRole="button"
        accessibilityLabel="Toque para começar agora"
      >
        <Text style={[styles.countdownLabel, { color: theme.textSecondary }]}>Preparar…</Text>
        <Text style={[styles.countdownNumber, { color: accent, textShadowColor: accent + '66' }]}>{countdown}</Text>
        <View style={[styles.countdownSkip, { borderColor: accent + '55', backgroundColor: theme.primarySoft }]}>
          <Ionicons name="play-skip-forward" size={16} color={accent} />
          <Text style={[styles.countdownSkipText, { color: accent }]}>Toque para começar agora</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* O mapa só aparece em esportes cuja medida principal é distância. */}
      {distanceBased ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          showsUserLocation
          followsUserLocation
          userInterfaceStyle="dark"
          customMapStyle={darkMapStyle}
          region={region}
          initialRegion={region}
        >
          {plannedRoute.length > 1 && <Polyline coordinates={plannedRoute} strokeColor={theme.primary} strokeWidth={3} lineDashPattern={[8, 6]} />}
          {routeSegments.map((segment, index) => segment.length > 1 ? (
            <Polyline
              key={`route-segment-${index}`}
              coordinates={segment}
              strokeColor={colors.dark.accent}
              strokeWidth={5}
            />
          ) : null)}
          {points.length > 0 && (
            <Marker coordinate={points[0]}>
              <View style={styles.startMarker}>
                <Ionicons name="flag" size={12} color={colors.white} />
              </View>
            </Marker>
          )}
        </MapView>
      ) : (
        <View style={[styles.map, { backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="barbell-outline" size={72} color={theme.primarySoft} />
        </View>
      )}

      {/* Top status bar */}
      <View style={styles.topOverlay}>
        {plannedRoute.length > 1 && (() => {
          const last = points[points.length - 1];
          const guide = last && Date.now() - last.timestamp < 30000 ? routeGuidance(plannedRoute, last) : null;
          return <Text style={{ backgroundColor: theme.mapOverlay, color: guide?.offRoute ? theme.danger : theme.textPrimary, padding: 8, borderRadius: 10, marginBottom: 6 }}>
            {!guide ? 'Rota salva · aguardando GPS atual' : guide.arrived ? 'Você está próximo do destino' : guide.offRoute ? 'Fora da rota sugerida · confira o mapa com segurança' : 'Rota sugerida · faltam cerca de ' + (guide.remainingMeters / 1000).toFixed(1) + ' km'}
          </Text>;
        })()}
        <View style={styles.topStatus}>
          {isPaused && (
            <View style={styles.pausedBadge}>
              <Text style={styles.pausedText}>PAUSADO</Text>
            </View>
          )}
          {supportsAutoPause(sport) && <TouchableOpacity
            style={[styles.lockBtn, { backgroundColor: theme.mapOverlay }, autoPauseOn && { backgroundColor: accent }]}
            onPress={toggleAutoPause}
            accessibilityRole="switch"
            accessibilityState={{ checked: autoPauseOn }}
            accessibilityLabel={autoPauseOn ? 'Pausa automática ligada' : 'Pausa automática desligada'}
          >
            <Ionicons name={autoPauseOn ? 'pause-circle' : 'pause-circle-outline'} size={18} color={autoPauseOn ? '#fff' : theme.textPrimary} />
          </TouchableOpacity>}
          {distanceBased && (
            <TouchableOpacity
              style={[styles.lockBtn, { backgroundColor: theme.mapOverlay }, liveUrl && { backgroundColor: accent }]}
              onPress={() => void handleShareLive()}
              disabled={sharing}
              accessibilityRole="button"
              accessibilityLabel={liveUrl ? 'Treino sendo transmitido ao vivo' : 'Transmitir treino ao vivo'}
            >
              <Ionicons
                name={liveUrl ? 'radio' : 'share-social-outline'}
                size={18}
                color={liveUrl ? colors.white : theme.textPrimary}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.lockBtn, { backgroundColor: theme.mapOverlay }]}
            onPress={() => setIsLocked(!isLocked)}
            accessibilityRole="button"
            accessibilityLabel={isLocked ? 'Desbloquear a tela' : 'Bloquear a tela contra toques'}
          >
            <Ionicons
              name={isLocked ? 'lock-closed' : 'lock-open-outline'}
              size={18}
              color={theme.textPrimary}
            />
          </TouchableOpacity>
        </View>
        {liveUrl && (
          <View style={[styles.liveBadge, { backgroundColor: theme.primarySoft, borderColor: accent + '66' }]}>
            <View style={[styles.liveDot, { backgroundColor: accent }]} />
            <Text style={[styles.liveText, { color: accent }]} numberOfLines={1}>
              Link de acompanhamento ativo
            </Text>
            <TouchableOpacity onPress={() => void stopSharingLive()} disabled={sharing} accessibilityRole="button" accessibilityLabel="Parar de compartilhar localização" style={{ padding: 8 }}>
              <Ionicons name="close-circle-outline" size={22} color={accent} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Bottom metrics panel — Strava-style hero stats */}
      <View style={[styles.bottomPanel, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        {/* A métrica principal acompanha o tipo do esporte. */}
        <View
          style={styles.heroBlock}
          accessible
          accessibilityRole="text"
          accessibilityLabel={distanceBased ? `Distância: ${distanceKm} quilômetros` : `Tempo: ${formatTime(elapsed)}`}
        >
          <Text style={[styles.heroValue, { color: theme.textPrimary }]}>{distanceBased ? distanceKm : formatTime(elapsed)}</Text>
          <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>{distanceBased ? 'QUILÔMETROS' : 'TEMPO DE TREINO'}</Text>
        </View>
        {distanceBased && !backgroundAvailable && (
          <Text style={{ color: theme.textPrimary, backgroundColor: theme.mapOverlay, padding: 6, borderRadius: 8, fontSize: 11, marginTop: 8 }}>
            Mantenha esta tela aberta e o celular desbloqueado. GPS em segundo plano não está disponível nesta sessão.
          </Text>
        )}

        {/* Secondary row: Tempo + Pace */}
        <View style={[styles.secondaryRow, { backgroundColor: theme.surfaceSecondary }]}>
          <View
            style={styles.secondaryBox}
            accessible
            accessibilityLabel={`Tempo: ${formatTime(elapsed)}`}
          >
            <Text style={[styles.secondaryValue, { color: theme.textPrimary }]}>{distanceBased ? formatTime(elapsed) : calories}</Text>
            <Text style={[styles.secondaryLabel, { color: theme.textSecondary }]}>{distanceBased ? 'Tempo' : 'kcal estimadas'}</Text>
          </View>
          <View style={[styles.secondaryDivider, { backgroundColor: theme.border }]} />
          <View
            style={styles.secondaryBox}
            accessible
            accessibilityLabel={distanceBased ? `Ritmo: ${pace} por quilômetro` : `${laps.length} voltas`}
          >
            <Text style={[styles.secondaryValue, { color: theme.textPrimary }]}>{distanceBased ? pace : laps.length}</Text>
            <Text style={[styles.secondaryLabel, { color: theme.textSecondary }]}>{distanceBased ? 'Pace /km' : 'Voltas'}</Text>
          </View>
        </View>

        {/* Métricas GPS não são exibidas na academia para evitar zeros enganosos. */}
        {distanceBased && <View style={styles.tertiaryRow}>
          <View style={[styles.tertiaryBox, { backgroundColor: theme.surfaceSecondary }]}>
            <Ionicons name="flame" size={14} color={accent} />
            <Text style={[styles.tertiaryValue, { color: theme.textPrimary }]}>{calories}</Text>
            <Text style={[styles.tertiaryLabel, { color: theme.textSecondary }]}>kcal</Text>
          </View>
          <View style={[styles.tertiaryBox, { backgroundColor: theme.surfaceSecondary }]}>
            <Ionicons name="speedometer-outline" size={14} color="#3B82F6" />
            <Text style={[styles.tertiaryValue, { color: theme.textPrimary }]}>{speed}</Text>
            <Text style={[styles.tertiaryLabel, { color: theme.textSecondary }]}>km/h</Text>
          </View>
          <View style={[styles.tertiaryBox, { backgroundColor: theme.surfaceSecondary }]}>
            <Ionicons name="trending-up" size={14} color="#10B981" />
            <Text style={[styles.tertiaryValue, { color: theme.textPrimary }]}>{elevationGainStr}</Text>
            <Text style={[styles.tertiaryLabel, { color: theme.textSecondary }]}>subida m</Text>
          </View>
          <View style={[styles.tertiaryBox, { backgroundColor: theme.surfaceSecondary }]}>
            <Ionicons name="navigate" size={14} color="#A78BFA" />
            <Text style={[styles.tertiaryValue, { color: theme.textPrimary }]}>{altitudeM}</Text>
            <Text style={[styles.tertiaryLabel, { color: theme.textSecondary }]}>altitude</Text>
          </View>
        </View>}

        {/* Voltas inline (apenas última) */}
        {laps.length > 0 && (
          <View style={styles.lastLap}>
            <Ionicons name="flag" size={14} color={accent} />
            <Text style={[styles.lastLapText, { color: theme.textPrimary }]}>
              Última volta {laps.length}: {formatTime(laps[laps.length - 1].time)} • {(laps[laps.length - 1].distance / 1000).toFixed(2)} km
            </Text>
          </View>
        )}

        {/* Control buttons fixos no rodapé */}
        <View style={styles.controlsBar}>
          {/* ESQUERDA: Lap (running) ou placeholder (paused) */}
          {countLaps ? (
            <TouchableOpacity
              style={[styles.sideBtn, isPaused && { opacity: 0.4 }]}
              onPress={handleLap}
              disabled={isPaused}
              accessibilityRole="button"
              accessibilityLabel={`Marcar volta ${laps.length + 1}`}
            >
              <Ionicons name="flag-outline" size={22} color={theme.textPrimary} />
              <Text style={[styles.sideBtnLabel, { color: theme.textPrimary }]}>{isPaused ? `${laps.length} voltas` : `Volta ${laps.length + 1}`}</Text>
            </TouchableOpacity>
          ) : <View style={styles.sideBtn} />}

          {/* CENTRO: Pause/Resume (sempre principal) */}
          <TouchableOpacity
            style={[styles.mainControlBtn, isPaused ? { backgroundColor: theme.success } : { backgroundColor: accent, shadowColor: accent }]}
            onPress={togglePause}
            accessibilityRole="button"
            accessibilityLabel={isPaused ? 'Retomar treino' : 'Pausar treino'}
          >
            <Ionicons name={isPaused ? 'play' : 'pause'} size={34} color="#fff" />
          </TouchableOpacity>

          {/* DIREITA: Finalizar — toque simples → confirmação por Alert */}
          <TouchableOpacity
            style={styles.sideBtn}
            onPress={requestFinish}
            disabled={finishing}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={finishing ? 'Salvando treino' : 'Finalizar treino'}
          >
            <Ionicons name="stop-circle" size={38} color={finishing ? '#888' : '#F87171'} />
            <Text style={[styles.sideBtnLabel, { color: finishing ? '#888' : '#F87171' }]}>
              {finishing ? 'Salvando…' : 'Finalizar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Confirmação agora é Alert nativo — sem ConfirmModal */}
    </View>
  );
}

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
  // Countdown
  countdownOverlay: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  countdownLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  countdownNumber: {
    fontSize: 140,
    fontWeight: '900',
    color: '#FF6B35',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(255,107,53,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  countdownSkip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.35)',
    backgroundColor: 'rgba(255,107,53,0.08)',
  },
  countdownSkipText: { color: '#FF6B35', fontSize: 14, fontWeight: '700' },
  map: {
    flex: 1,
  },
  startMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.dark.success,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(0,230,118,0.3)',
  },
  topOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: spacing.md,
    right: spacing.md,
  },
  topStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pausedBadge: {
    backgroundColor: colors.dark.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  pausedText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 1,
  },
  lockBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.dark.mapOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  lockBtnActive: {
    backgroundColor: '#FF6B35',
  },
  liveBadge: {
    marginTop: 8,
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,107,53,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    maxWidth: 260,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B35',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF8A5C',
    letterSpacing: 0.5,
  },
  bottomPanel: {
    backgroundColor: '#0A0A0F',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  heroBlock: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroValue: {
    fontSize: 72,
    fontWeight: '900',
    color: '#fff',
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
    lineHeight: 76,
  },
  heroLabel: {
    fontSize: 11,
    color: '#8E8EA0',
    letterSpacing: 2,
    fontWeight: '700',
    marginTop: 2,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  secondaryBox: {
    flex: 1,
    alignItems: 'center',
  },
  secondaryValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  secondaryLabel: {
    fontSize: 11,
    color: '#8E8EA0',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tertiaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: 6,
  },
  tertiaryBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    paddingVertical: 8,
    gap: 2,
  },
  tertiaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  tertiaryLabel: {
    fontSize: 9,
    color: '#8E8EA0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lastLap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,107,53,0.08)',
    borderRadius: 10,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.2)',
  },
  lastLapText: {
    color: colors.dark.text,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  sideBtn: {
    alignItems: 'center',
    gap: 4,
    minWidth: 72,
  },
  sideBtnLabel: {
    fontSize: 11,
    color: colors.dark.text,
    fontWeight: '600',
  },
  // LEGACY (mantido pra compat)
  timer: {
    fontSize: 56,
    fontWeight: '200',
    color: colors.dark.text,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.dark.text,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: 11,
    color: colors.dark.secondaryText,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.dark.border,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
  },
  mainControlBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  pauseBtn: {
    backgroundColor: colors.dark.accent,
    shadowColor: colors.dark.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  resumeBtn: {
    backgroundColor: colors.dark.success,
    shadowColor: colors.dark.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  finishBtn: {
    alignItems: 'center',
    gap: 4,
    width: 60,
  },
  lapBtn: {
    alignItems: 'center',
    gap: 4,
    width: 60,
  },
  controlLabel: {
    fontSize: 11,
    color: colors.dark.secondaryText,
  },
  lapsContainer: {
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: spacing.sm,
  },
  lapsTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.dark.secondaryText,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  lapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  lapNumber: {
    fontSize: fontSize.xs,
    color: colors.dark.secondaryText,
    flex: 1,
  },
  lapTime: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.dark.text,
    fontVariant: ['tabular-nums'],
    flex: 1,
    textAlign: 'center',
  },
  lapDist: {
    fontSize: fontSize.xs,
    color: colors.dark.accent,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
});
