import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';

export type GymPlace = { id: string; name: string; kind: string; latitude: number; longitude: number; address: string; sourceUrl: string; distanceKm: number };
const text = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 160) : '';
export function distanceKm(a: number, b: number, c: number, d: number) {
  const rad = Math.PI / 180;
  const h = Math.sin((c-a)*rad/2)**2 + Math.cos(a*rad)*Math.cos(c*rad)*Math.sin((d-b)*rad/2)**2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function parseGyms(elements: any[], lat: number, lng: number): GymPlace[] {
  const found = new Map<string, GymPlace>();
  for (const e of elements) {
    const t = e?.tags;
    if (!t || t.leisure !== 'fitness_centre' || t.access === 'private' || t.disused === 'yes' || t.abandoned === 'yes') continue;
    if (!['node', 'way', 'relation'].includes(e.type) || !Number.isSafeInteger(e.id) || e.id <= 0) continue;
    const latitude = e.lat ?? e.center?.lat, longitude = e.lon ?? e.center?.lon;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    const distance = distanceKm(lat, lng, latitude, longitude);
    if (distance > 6) continue;
    const id = `${e.type}/${e.id}`;
    found.set(id, { id, name: text(t.name) || 'Academia sem nome cadastrado', kind: 'Academia', latitude, longitude,
      address: [text(t['addr:street']), text(t['addr:housenumber']), text(t['addr:suburb'])].filter(Boolean).join(', '),
      sourceUrl: `https://www.openstreetmap.org/${id}`, distanceKm: distance });
  }
  return [...found.values()].sort((a,b) => a.distanceKm-b.distanceKm).slice(0, 1000);
}

@Injectable()
export class PlacesService {
  private cache = new Map<string, { expires: number; places: GymPlace[] }>();
  private pending = new Map<string, Promise<GymPlace[]>>();
  private nextRequest = 0;

  async nearby(latitude: string, longitude: string) {
    if (typeof latitude !== 'string' || typeof longitude !== 'string' || !latitude.trim() || !longitude.trim()) throw new BadRequestException('Coordenadas obrigatórias.');
    const lat = Number(latitude), lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new BadRequestException('Coordenadas inválidas.');
    // Share cache by ~1 km grid; do not send exact user coordinates or identity upstream.
    const a = Number(lat.toFixed(2)), b = Number(lng.toFixed(2)), key = `${a},${b}`;
    const cached = this.cache.get(key);
    let places: GymPlace[];
    if (cached && cached.expires > Date.now()) places = cached.places;
    else {
      let request = this.pending.get(key);
      if (!request) {
        if (this.pending.size || Date.now() < this.nextRequest) throw new ServiceUnavailableException('Busca de academias ocupada. Tente novamente em instantes.');
        this.nextRequest = Date.now() + 15_000;
        request = this.fetchPlaces(a, b).then(result => {
          if (this.cache.size >= 200) this.cache.delete(this.cache.keys().next().value!);
          this.cache.set(key, { places: result, expires: Date.now() + 6*60*60*1000 });
          return result;
        }).finally(() => this.pending.delete(key));
        this.pending.set(key, request);
      }
      places = await request;
    }
    return { places: places.map(p => ({ ...p, distanceKm: distanceKm(lat,lng,p.latitude,p.longitude) }))
      .filter(p => p.distanceKm <= 5).sort((x,y) => x.distanceKm-y.distanceKm).slice(0, 100), radiusKm: 5, source: 'OpenStreetMap' };
  }

  private async fetchPlaces(lat: number, lng: number): Promise<GymPlace[]> {
    try {
      // Extra 1 km covers grid rounding; filtering happens against the actual location.
      const query = `[out:json][timeout:15];nwr["leisure"="fitness_centre"](around:6000,${lat},${lng});out center tags;`;
      const { data } = await axios.post('https://overpass-api.de/api/interpreter', new URLSearchParams({ data: query }).toString(), {
        timeout: 20_000, maxContentLength: 2_000_000, maxRedirects: 0,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'SYNC/1.0 (https://sync-2-0-blush.vercel.app)' },
      });
      if (!Array.isArray(data?.elements) || data.remark) throw new Error('Incomplete upstream response');
      // Keep full grid coverage in cache; the public response is limited to 5 km.
      return parseGyms(data.elements, lat, lng);
    } catch {
      throw new ServiceUnavailableException('Não foi possível consultar academias no OpenStreetMap. Tente novamente mais tarde.');
    }
  }
}
