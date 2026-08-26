// GPS de produção — alta precisão real do dispositivo.
// Web: navigator.geolocation com enableHighAccuracy=true
// Native: expo-location com Accuracy.BestForNavigation
// Geocoding reverso: OpenStreetMap Nominatim (free, sem API key, atribuição requerida)
import * as ExpoLocation from 'expo-location';
import { Platform } from 'react-native';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
  isReal: true;
}

export class LocationDeniedError extends Error {
  constructor(message = 'Permissão de localização negada') {
    super(message);
    this.name = 'LocationDeniedError';
  }
}

export class LocationUnavailableError extends Error {
  constructor(message = 'Não foi possível obter a localização') {
    super(message);
    this.name = 'LocationUnavailableError';
  }
}

let cachedLocation: LocationCoords | null = null;
let cachedCity: { latitude: number; longitude: number; city: string } | null = null;

/**
 * Pega GPS real do dispositivo — alta precisão.
 */
export async function getCurrentLocation(): Promise<LocationCoords> {
  if (Platform.OS === 'web') {
    return getWebLocation();
  }
  return getNativeLocation();
}

async function getWebLocation(): Promise<LocationCoords> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new LocationUnavailableError('Geolocalização não suportada neste navegador');
  }

  // Tenta high accuracy primeiro (mais lento mas preciso)
  try {
    return await new Promise<LocationCoords>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: LocationCoords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            isReal: true,
          };
          cachedLocation = coords;
          resolve(coords);
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      );
    });
  } catch (err: any) {
    // Se high accuracy falhou (timeout ou erro), tenta baixa precisão
    if (err.code === err.PERMISSION_DENIED) {
      throw new LocationDeniedError(
        'Permissão de localização negada. Clique no cadeado da barra de endereço e libere "Localização".',
      );
    }
    return new Promise<LocationCoords>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: LocationCoords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            isReal: true,
          };
          cachedLocation = coords;
          resolve(coords);
        },
        (e) => {
          if (e.code === e.PERMISSION_DENIED) {
            reject(new LocationDeniedError());
          } else if (e.code === e.TIMEOUT) {
            reject(new LocationUnavailableError('Timeout — saia para uma área aberta e tente novamente'));
          } else {
            reject(new LocationUnavailableError('Não foi possível obter sua posição'));
          }
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 },
      );
    });
  }
}

async function getNativeLocation(): Promise<LocationCoords> {
  const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new LocationDeniedError(
      'Permissão de localização negada. Ative em Ajustes → Sync.',
    );
  }

  // Best for navigation = mais preciso possível
  try {
    const loc = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.BestForNavigation,
    });
    const coords: LocationCoords = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? undefined,
      isReal: true,
    };
    cachedLocation = coords;
    return coords;
  } catch { /* tenta balanceada */ }

  try {
    const loc = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.Balanced,
    });
    const coords: LocationCoords = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? undefined,
      isReal: true,
    };
    cachedLocation = coords;
    return coords;
  } catch { /* tenta last known */ }

  const lastKnown = await ExpoLocation.getLastKnownPositionAsync().catch(() => null);
  if (lastKnown) {
    const coords: LocationCoords = {
      latitude: lastKnown.coords.latitude,
      longitude: lastKnown.coords.longitude,
      accuracy: lastKnown.coords.accuracy ?? undefined,
      isReal: true,
    };
    cachedLocation = coords;
    return coords;
  }

  throw new LocationUnavailableError('GPS não retornou posição.');
}

/**
 * Watch contínuo de posição. Web: navigator.geolocation.watchPosition (high accuracy).
 */
export async function watchLocation(
  callback: (coords: LocationCoords) => void,
  options?: { distanceInterval?: number; timeInterval?: number },
): Promise<{ remove: () => void } | null> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: LocationCoords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          isReal: true,
        };
        cachedLocation = coords;
        callback(coords);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 },
    );
    return { remove: () => navigator.geolocation.clearWatch(id) };
  }

  try {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const sub = await ExpoLocation.watchPositionAsync(
      {
        accuracy: ExpoLocation.Accuracy.BestForNavigation,
        distanceInterval: options?.distanceInterval ?? 3,
        timeInterval: options?.timeInterval ?? 2000,
      },
      (loc) => {
        const coords: LocationCoords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? undefined,
          isReal: true,
        };
        cachedLocation = coords;
        callback(coords);
      },
    );
    return { remove: () => sub.remove() };
  } catch {
    return null;
  }
}

/**
 * Reverse geocode via OpenStreetMap Nominatim (free, sem API key).
 * Retorna nome da cidade/bairro a partir de lat/lng.
 * Atribuição: © OpenStreetMap contributors (já adicionada no leaflet).
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<{ city: string; neighborhood?: string; country?: string } | null> {
  // Cache local: se já consultou ponto próximo, retorna
  if (cachedCity) {
    const dLat = Math.abs(cachedCity.latitude - latitude);
    const dLng = Math.abs(cachedCity.longitude - longitude);
    if (dLat < 0.01 && dLng < 0.01) {
      return { city: cachedCity.city };
    }
  }

  // Native: expo-location reverseGeocodeAsync funciona melhor
  if (Platform.OS !== 'web') {
    try {
      const [geo] = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
      const city = geo?.city || geo?.subregion || geo?.region || '';
      if (city) {
        cachedCity = { latitude, longitude, city };
        return {
          city,
          neighborhood: geo?.district || undefined,
          country: geo?.country || undefined,
        };
      }
    } catch { /* fallback web */ }
  }

  // Web: Nominatim. Headers exigem User-Agent ou Referer com nome do app.
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 7000);
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=14&accept-language=pt-BR`,
      {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Referer': 'https://sync-h29j2uaaq-rutunarciso-5121s-projects.vercel.app',
        },
      },
    );
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    const a = j.address || {};
    const city = a.city || a.town || a.village || a.municipality || a.suburb || a.county || '';
    const neighborhood = a.suburb || a.neighbourhood || a.quarter || undefined;
    if (city) {
      cachedCity = { latitude, longitude, city };
      return { city, neighborhood, country: a.country };
    }
    return null;
  } catch {
    return null;
  }
}

export interface CitySearchResult {
  name: string;
  lat: number;
  lng: number;
}

/**
 * Busca cidades brasileiras pelo nome para o seletor manual do onboarding.
 * O debounce fica na tela; esta função mantém a consulta pequena e limitada.
 */
export async function searchBrazilianCities(query: string): Promise<CitySearchResult[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const params = new URLSearchParams({
      q: `${term}, Brasil`,
      format: 'jsonv2',
      addressdetails: '1',
      countrycodes: 'br',
      limit: '8',
      dedupe: '1',
      'accept-language': 'pt-BR',
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'pt-BR',
        Referer: 'https://sync-h29j2uaaq-rutunarciso-5121s-projects.vercel.app',
      },
    });
    if (!response.ok) throw new Error(`Geocoding search failed: ${response.status}`);

    const results = await response.json();
    const seen = new Set<string>();
    return (Array.isArray(results) ? results : [])
      .map((item: any): CitySearchResult | null => {
        const address = item?.address || {};
        const city = address.city || address.town || address.village || address.municipality || address.county;
        const lat = Number(item?.lat);
        const lng = Number(item?.lon);
        if (!city || !isFinite(lat) || !isFinite(lng)) return null;

        const stateCode = String(address['ISO3166-2-lvl4'] || '')
          .replace(/^BR-/i, '')
          .toUpperCase();
        const name = stateCode ? `${city}, ${stateCode}` : city;
        const key = name.toLocaleLowerCase('pt-BR');
        if (seen.has(key)) return null;
        seen.add(key);
        return { name, lat, lng };
      })
      .filter((item: CitySearchResult | null): item is CitySearchResult => item !== null);
  } finally {
    clearTimeout(timeout);
  }
}

export function getCachedLocation(): LocationCoords | null {
  return cachedLocation;
}

export function clearLocationCache(): void {
  cachedLocation = null;
  cachedCity = null;
}
