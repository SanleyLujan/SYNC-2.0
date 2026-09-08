// Tela pública de live tracking. Renderizada quando URL = /live/:token.
// Não requer login.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import MapView, { Polyline, Marker } from '../../components/map/SyncMap';
import { colors, fontSize, spacing, borderRadius } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { liveTrackingSocket, LivePoint, LiveTiming } from '../../services/tracking-socket.service';
import { LiveRoutePoint, mergeLivePoints } from '../../utils/live-points';
import { API_URL } from '../../services/api';

const ACCENT = '#FF6B35';
type LiveData = {
  activityId: string;
  sport: string;
  startTime: string;
  isCompleted: boolean;
  distance: number;
  duration: number;
  pausedAt?: string | null;
  pausedDuration?: number;
  points: { latitude: number; longitude: number; timestamp: string; segmentStart?: boolean }[];
  athlete: { name?: string; avatarUrl?: string };
};

export default function LiveViewScreen({ token }: { token: string }) {
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [livePoints, setLivePoints] = useState<LiveRoutePoint[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [connected, setConnected] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [liveDistance, setLiveDistance] = useState(0);
  const [finished, setFinished] = useState(false);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [pausedDuration, setPausedDuration] = useState(0);
  const mapRef = useRef<any>(null);

  // Carga inicial via REST
  useEffect(() => {
    let active = true;
    let fetching = false;
    let controller: AbortController | null = null;
    setData(null); setLivePoints([]); setLoading(true); setError(null); setConnected(false); setLastUpdate(null);
    const reload = async () => {
      if (fetching) return;
      fetching = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 30_000);
      try {
        const r = await fetch(`${API_URL}/activities/live/${encodeURIComponent(token)}`, { signal: controller.signal, cache: 'no-store' });
        if (!active) return;
        if (r.status === 404 || r.status === 403) {
          setError('O compartilhamento foi encerrado ou o link expirou.');
          setData(null); setLivePoints([]); liveTrackingSocket.disconnect();
          return;
        }
        if (!r.ok) throw new Error('network');
        const j: LiveData = await r.json();
        if (!active) return;
        setError(null);
        setData(j);
        setLivePoints(prev => mergeLivePoints(prev, j.points));
        const last = j.points[j.points.length - 1];
        if (last) setLastUpdate(prev => !prev || +prev < Date.parse(last.timestamp) ? new Date(last.timestamp) : prev);
        setLiveDistance(prev => j.isCompleted ? j.distance : Math.max(prev, j.distance));
        setFinished(j.isCompleted);
        if (j.isCompleted) setElapsed(j.duration || 0);
        setPausedAt(j.pausedAt ? new Date(j.pausedAt).getTime() : null);
        setPausedDuration(j.pausedDuration || 0);
      } catch {
        if (active) setConnected(false);
      } finally {
        clearTimeout(timeout);
        fetching = false;
        if (active) setLoading(false);
      }
    };
    void reload();
    const interval = setInterval(() => void reload(), 15_000);
    const tick = setInterval(() => setClock(Date.now()), 1000);
    return () => { active = false; controller?.abort(); clearInterval(interval); clearInterval(tick); };
  }, [token]);

  // Tick do timer
  useEffect(() => {
    if (!data) return;
    if (finished) {
      if (data.isCompleted) setElapsed(data.duration || 0);
      return;
    }
    const start = new Date(data.startTime).getTime();
    const t = setInterval(() => {
      const now = Date.now();
      const openPause = pausedAt == null ? 0 : Math.max(0, now - pausedAt) / 1000;
      setElapsed(Math.max(0, Math.floor((now - start) / 1000 - pausedDuration - openPause)));
    }, 1000);
    const now = Date.now();
    const openPause = pausedAt == null ? 0 : Math.max(0, now - pausedAt) / 1000;
    setElapsed(Math.max(0, Math.floor((now - start) / 1000 - pausedDuration - openPause)));
    return () => clearInterval(t);
  }, [data, finished, pausedAt, pausedDuration]);

  // Socket: assina novos pontos
  useEffect(() => {
    if (!data) return;
    const off = liveTrackingSocket.follow(
      data.activityId,
      token,
      (p: LivePoint) => {
        if (p.activityId !== data.activityId) return;
        setLivePoints((prev) => mergeLivePoints(prev, [{
          latitude: p.latitude,
          longitude: p.longitude,
          segmentStart: p.segmentStart,
          timestamp: p.timestamp,
        }]));
        setLiveDistance(prev => Math.max(prev, p.distance));
        setLastUpdate(new Date(p.timestamp));
        mapRef.current?.animateToRegion?.({
          latitude: p.latitude,
          longitude: p.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
      },
      () => setFinished(true),
      (timing: LiveTiming) => {
        setPausedAt(timing.pausedAt ? new Date(timing.pausedAt).getTime() : null);
        setPausedDuration(timing.pausedDuration || 0);
      },
      setConnected,
    );
    return () => {
      off();
      liveTrackingSocket.disconnect();
    };
  }, [data?.activityId, token]);

  const center = useMemo(() => {
    const last = livePoints[livePoints.length - 1];
    if (last) return { latitude: last.latitude, longitude: last.longitude };
    return { latitude: -23.5505, longitude: -46.6333 };
  }, [livePoints]);

  const routeSegments = useMemo(
    () => livePoints.reduce<Array<typeof livePoints>>((segments, point) => {
      if (point.segmentStart || segments.length === 0) segments.push([point]);
      else segments[segments.length - 1].push(point);
      return segments;
    }, []),
    [livePoints],
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Conectando ao live...</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.secondaryText} />
        <Text style={styles.errorTitle}>Live indisponível</Text>
        <Text style={styles.errorText}>{error || 'Sem conexão com a transmissão. Tentando novamente…'}</Text>
      </View>
    );
  }

  const distKm = (liveDistance / 1000).toFixed(2);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const time = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  const paceMinPerKm = liveDistance > 0 ? ((elapsed / 60) / (liveDistance / 1000)).toFixed(1) : '--';

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={styles.map}
        region={{
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {routeSegments.map((segment, index) => segment.length > 1 ? (
          <Polyline key={`live-segment-${index}`} coordinates={segment} strokeColor={ACCENT} strokeWidth={5} />
        ) : null)}
        {livePoints.length > 0 && (
          <Marker coordinate={livePoints[livePoints.length - 1]}>
            <View style={styles.athleteMarker}>
              <Ionicons name="walk" size={18} color="#fff" />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Header overlay com info do atleta */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View style={styles.avatarRow}>
            {data.athlete.avatarUrl ? (
              <Image source={{ uri: data.athlete.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>
                  {(data.athlete.name || 'A').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.athleteName} numberOfLines={1}>
                {data.athlete.name || 'Atleta'}
              </Text>
              <View style={styles.liveRow}>
                <View style={[styles.liveDot, finished && { backgroundColor: '#888' }]} />
                <Text style={styles.liveLabel}>
                  {finished ? 'TREINO ENCERRADO' : !connected ? 'RECONECTANDO' : !lastUpdate || clock - +lastUpdate > 30_000 ? 'AGUARDANDO GPS' : 'AO VIVO'}
                </Text>
              </View>
            </View>
            <View style={styles.sportBadge}>
              <Text style={styles.sportText}>{data.sport.toUpperCase()}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Painel de métricas */}
      <View style={styles.metricsPanel}>
        <View style={styles.metricsInner}>
          <View style={styles.metricBlock}>
            <Text style={styles.metricValue}>{distKm}</Text>
            <Text style={styles.metricLabel}>km</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.metricBlock}>
            <Text style={styles.metricValue}>{time}</Text>
            <Text style={styles.metricLabel}>tempo</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.metricBlock}>
            <Text style={styles.metricValue}>{paceMinPerKm}</Text>
            <Text style={styles.metricLabel}>min/km</Text>
          </View>
        </View>
        <Text style={styles.poweredBy}>
          {finished ? 'Encerrado' : lastUpdate ? `Último GPS às ${lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Aguardando a primeira localização'}  •  SYNC
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  map: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.secondaryText,
    fontSize: fontSize.sm,
  },
  errorTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.secondaryText,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 50 : 24,
    alignItems: 'center',
  },
  headerInner: {
    width: '100%',
    maxWidth: 480,
    paddingHorizontal: spacing.md,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(10,10,15,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: borderRadius.lg,
    padding: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: ACCENT,
  },
  avatarFallback: {
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontWeight: '800', fontSize: 18 },
  athleteName: {
    color: colors.text,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
  liveLabel: {
    color: ACCENT,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.6,
  },
  sportBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,107,53,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.4)',
  },
  sportText: { color: ACCENT, fontWeight: '800', fontSize: 10 },
  athleteMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  metricsPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  metricsInner: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,15,0.9)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 18,
    paddingHorizontal: spacing.lg,
  },
  metricBlock: { flex: 1, alignItems: 'center' },
  metricValue: { color: colors.text, fontSize: 28, fontWeight: '800' },
  metricLabel: {
    color: colors.secondaryText,
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  divider: {
    width: 1,
    height: 38,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  poweredBy: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    marginTop: 6,
    letterSpacing: 0.5,
  },
});
