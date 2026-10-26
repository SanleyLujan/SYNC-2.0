import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { clearWebTrackingRecovery } from './web-tracking-recovery.service';

const BACKGROUND_LOCATION_TASK = 'sync-background-location';
const TRACKING_CONTEXT_KEY = '@sync:active-tracking';
const TRACKING_QUEUE_KEY = '@sync:background-points';
const MAX_QUEUED_POINTS = 20_000;

export type BackgroundTrackingContext = {
  activityId: string;
  sport: string;
  startedAt: string;
  manuallyPaused: boolean;
};

export type BackgroundTrackingPoint = {
  activityId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
  timestamp: number;
};

type LocationTaskData = { locations?: Location.LocationObject[] };

let appIsForeground = false;
let queueMutation: Promise<unknown> = Promise.resolve();
let lifecycleGeneration = 0;

function parseArray(value: string | null): BackgroundTrackingPoint[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mutateQueue<T>(mutation: (queue: BackgroundTrackingPoint[]) => Promise<T>): Promise<T> {
  const operation = queueMutation.then(async () => {
    const queue = parseArray(await AsyncStorage.getItem(TRACKING_QUEUE_KEY));
    return mutation(queue);
  });
  queueMutation = operation.then(() => undefined, () => undefined);
  return operation;
}

async function appendBackgroundLocations(locations: Location.LocationObject[]) {
  if (appIsForeground || locations.length === 0) return;
  const context = await getBackgroundTrackingContext();
  if (!context || context.manuallyPaused) return;

  const validPoints = locations
    .filter(({ coords, timestamp }) => (
      Number.isFinite(coords.latitude) && coords.latitude >= -90 && coords.latitude <= 90 &&
      Number.isFinite(coords.longitude) && coords.longitude >= -180 && coords.longitude <= 180 &&
      Number.isFinite(timestamp) && timestamp >= Date.parse(context.startedAt) && timestamp <= Date.now() + 5000 &&
      (coords.accuracy == null || (Number.isFinite(coords.accuracy) && coords.accuracy >= 0 && coords.accuracy <= 35))
    ))
    .map(({ coords, timestamp }) => ({
      activityId: context.activityId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude: coords.altitude ?? undefined,
      accuracy: coords.accuracy ?? undefined,
      speed: coords.speed ?? undefined,
      timestamp,
    }));

  if (!validPoints.length) return;
  await mutateQueue(async (queue) => {
    const current = await getBackgroundTrackingContext();
    if (!current || current.activityId !== context.activityId || current.manuallyPaused) return;
    const unique = new Map([...queue, ...validPoints].map(p => [`${p.activityId}:${p.timestamp}`, p]));
    const merged = [...unique.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-MAX_QUEUED_POINTS);
    await AsyncStorage.setItem(TRACKING_QUEUE_KEY, JSON.stringify(merged));
  });
}

// O executor precisa existir no escopo global para o sistema operacional poder
// reabrir somente o módulo da task, sem montar qualquer tela React.
if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask<LocationTaskData>(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations) return;
    await appendBackgroundLocations(data.locations);
  });
}

export function setBackgroundAppForeground(value: boolean) {
  appIsForeground = value;
}

export async function getBackgroundTrackingContext(): Promise<BackgroundTrackingContext | null> {
  const raw = await AsyncStorage.getItem(TRACKING_CONTEXT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BackgroundTrackingContext>;
    if (!parsed.activityId || !parsed.sport || !parsed.startedAt) return null;
    return {
      activityId: parsed.activityId,
      sport: parsed.sport,
      startedAt: parsed.startedAt,
      manuallyPaused: Boolean(parsed.manuallyPaused),
    };
  } catch {
    return null;
  }
}

export async function startBackgroundTracking(
  context: Omit<BackgroundTrackingContext, 'manuallyPaused'> & { manuallyPaused?: boolean },
): Promise<boolean> {
  const generation = ++lifecycleGeneration;
  const stored: BackgroundTrackingContext = {
    ...context,
    manuallyPaused: Boolean(context.manuallyPaused),
  };
  await mutateQueue(async () => {
    if (generation === lifecycleGeneration) await AsyncStorage.setItem(TRACKING_CONTEXT_KEY, JSON.stringify(stored));
  });
  // Web não tem task, mas preserva o identificador para restaurar o treino.
  if (Platform.OS === 'web') return false;

  try {
    if (!(await TaskManager.isAvailableAsync())) return false;
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== 'granted') return false;
    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== 'granted') return false;
    if (generation !== lifecycleGeneration) return false;

    if (!(await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK))) {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 0,
        timeInterval: 2_000,
        deferredUpdatesDistance: 10,
        deferredUpdatesInterval: 5_000,
        activityType: Location.ActivityType.Fitness,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Sync está registrando seu treino',
          notificationBody: 'A rota continua sendo salva com o app em segundo plano.',
          notificationColor: '#FF6B35',
          killServiceOnDestroy: false,
        },
      });
    }
    if (generation !== lifecycleGeneration) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[tracking] background location unavailable:', error);
    return false;
  }
}

export async function setBackgroundTrackingManualPause(manuallyPaused: boolean): Promise<void> {
  await mutateQueue(async () => {
    const context = await getBackgroundTrackingContext();
    if (!context) return;
    await AsyncStorage.setItem(
      TRACKING_CONTEXT_KEY,
      JSON.stringify({ ...context, manuallyPaused }),
    );
  });
}

export function drainBackgroundPoints(activityId: string): Promise<BackgroundTrackingPoint[]> {
  return mutateQueue(async (queue) => {
    const matching: BackgroundTrackingPoint[] = [];
    for (const point of queue) {
      if (point.activityId === activityId) matching.push(point);
    }
    return matching.sort((a, b) => a.timestamp - b.timestamp).slice(0, 500);
  });
}

export function acknowledgeBackgroundPoints(activityId: string, timestamps: number[]): Promise<void> {
  const acknowledged = new Set(timestamps);
  return mutateQueue(async queue => {
    const remaining = queue.filter(p => p.activityId !== activityId || !acknowledged.has(p.timestamp));
    await AsyncStorage.setItem(TRACKING_QUEUE_KEY, JSON.stringify(remaining));
  });
}

export async function stopBackgroundTracking(options: { clearQueue?: boolean; preserveContext?: boolean } = {}): Promise<void> {
  lifecycleGeneration++;
  if (Platform.OS === 'web' && !options.preserveContext) clearWebTrackingRecovery();
  if (Platform.OS !== 'web') {
    try {
      if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
    } catch {}
  }
  await mutateQueue(async () => {
    if (!options.preserveContext) await AsyncStorage.removeItem(TRACKING_CONTEXT_KEY);
    if (options.clearQueue) {
      await AsyncStorage.removeItem(TRACKING_QUEUE_KEY);
    }
  });
}
