// Mapa web com Leaflet vanilla para manter controle direto da instância.
// complexidades de bundle CSS no Metro/Expo Web.
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { View } from 'react-native';
import ReactDOMServer from 'react-dom/server';
import L from 'leaflet';
import { getCartoTileUrl } from '../../utils/carto';
import { useThemeStore } from '../../store/themeStore';
import { showToast } from '../ui/Toast';

// CSS do Leaflet + overrides do Sync (injetado uma vez)
function ensureLeafletCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('sync-leaflet-css')) return;

  // Carrega o CSS oficial do leaflet via <link> (cacheado pelo SW se houver)
  const link = document.createElement('link');
  link.id = 'sync-leaflet-css';
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
  link.crossOrigin = 'anonymous';
  link.integrity = 'sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H';
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.id = 'sync-leaflet-style';
  style.innerHTML = `
    .sync-map { background: #f2f4f5; outline: none; }
    .sync-map[data-theme="dark"] { background: #17212b; }
    .sync-map[data-theme="dark"] .leaflet-tile-pane {
      filter: brightness(1.75) contrast(1.08);
    }
    .sync-map .leaflet-control-attribution {
      background: rgba(255,255,255,0.94) !important;
      color: #334155 !important;
      font-size: 11px !important;
    }
    .sync-map .leaflet-control-attribution a { color: #1d4ed8 !important; }
    .sync-map[data-theme="dark"] .leaflet-control-attribution {
      background: rgba(15,23,42,0.94) !important;
      color: #e2e8f0 !important;
    }
    .sync-map[data-theme="dark"] .leaflet-control-attribution a { color: #93c5fd !important; }
    .sync-marker { background: transparent !important; border: 0 !important; }
  `;
  document.head.appendChild(style);
}

// Ícones default do leaflet servidos via CDN (evita asset resolution do Metro)
const CDN_BASE = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images';
(L.Icon.Default.prototype as any)._getIconUrl = undefined;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: `${CDN_BASE}/marker-icon-2x.png`,
  iconUrl: `${CDN_BASE}/marker-icon.png`,
  shadowUrl: `${CDN_BASE}/marker-shadow.png`,
});

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
};

const deltaToZoom = (delta?: number) => {
  const d = delta ?? 0.03;
  if (d >= 1) return 8;
  if (d >= 0.3) return 10;
  if (d >= 0.1) return 12;
  if (d >= 0.05) return 13;
  if (d >= 0.02) return 14;
  if (d >= 0.01) return 15;
  return 16;
};

export const PROVIDER_DEFAULT = 'leaflet';

// Contexto para que filhos (Marker/Circle/Polyline) acessem a instância do map.
const MapContext = React.createContext<L.Map | null>(null);

type MapViewProps = {
  region?: Region;
  initialRegion?: Region;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  followsUserLocation?: boolean;
  userInterfaceStyle?: string;
  customMapStyle?: any;
  onPress?: () => void;
  style?: any;
  children?: React.ReactNode;
  // catch-all pra ignorar props nativas sem crashar
  [key: string]: any;
};

const MapView = forwardRef<any, MapViewProps>(function MapView(
  { region, initialRegion, onPress, style, children, showsUserLocation = false },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const mode = useThemeStore(s => s.theme.mode);
  const [, force] = React.useReducer((x) => x + 1, 0);

  // Aceita region OU initialRegion; fallback pra coords seguras
  const effectiveRegion: Region =
    region ||
    initialRegion ||
    { latitude: -23.5505, longitude: -46.6333, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  useEffect(() => {
    ensureLeafletCss();
    if (!containerRef.current || mapRef.current) return;

    let map: L.Map;
    try {
      map = L.map(containerRef.current, {
        center: [effectiveRegion.latitude, effectiveRegion.longitude],
        zoom: deltaToZoom(effectiveRegion.latitudeDelta),
        zoomControl: false,
        attributionControl: true,
      });
    } catch (e) {
      console.warn('[SyncMap] init failed:', e);
      return;
    }

    tileRef.current = L.tileLayer(getCartoTileUrl(mode === 'dark'), {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    if (onPress) map.on('click', onPress);
    mapRef.current = map;
    force(); // re-render para filhos receberem o context
    return () => {
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only replace basemap tiles; preserve GPS, zoom, markers and route layers.
  useEffect(() => {
    tileRef.current?.setUrl(getCartoTileUrl(mode === 'dark'));
  }, [mode]);

  // The web adapter must implement this native prop explicitly.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showsUserLocation) return;
    if (!navigator.geolocation) {
      showToast('Este navegador não disponibiliza localização.', 'info');
      return;
    }
    let active = true;
    let warned = false;
    let dot: L.CircleMarker | undefined;
    let accuracy: L.Circle | undefined;
    const watch = navigator.geolocation.watchPosition(position => {
      if (!active) return;
      const { latitude, longitude, accuracy: meters } = position.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      const point: L.LatLngExpression = [latitude, longitude];
      if (!dot) {
        accuracy = L.circle(point, { radius: 0, color: '#2563eb', weight: 1, fillOpacity: 0.08, interactive: false }).addTo(map);
        dot = L.circleMarker(point, { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(map);
        dot.bindTooltip('Sua localização', { direction: 'top' });
      }
      dot.setLatLng(point);
      accuracy?.setLatLng(point).setRadius(Number.isFinite(meters) && meters >= 0 ? meters : 0);
      warned = false;
    }, error => {
      if (!active) return;
      // Do not leave an old fix looking like a current position.
      dot?.remove(); accuracy?.remove(); dot = undefined; accuracy = undefined;
      if (!warned) showToast(error.code === 1
        ? 'Permita a localização nas configurações do navegador para ver sua posição.'
        : 'Localização indisponível. Confira a localização do celular e tente recentralizar.', 'info');
      warned = true;
    }, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 });
    return () => {
      active = false;
      navigator.geolocation.clearWatch(watch);
      dot?.remove(); accuracy?.remove();
    };
  }, [showsUserLocation]);

  // Atualiza centro quando region muda externamente (sem re-criar o map)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !region) return;
    const current = map.getCenter();
    if (
      Math.abs(current.lat - region.latitude) > 0.0001 ||
      Math.abs(current.lng - region.longitude) > 0.0001
    ) {
      map.setView([region.latitude, region.longitude], deltaToZoom(region.latitudeDelta), {
        animate: true,
        duration: 0.5,
      });
    }
  }, [region?.latitude, region?.longitude, region?.latitudeDelta]);

  useImperativeHandle(
    ref,
    () => ({
      animateToRegion: (r: Region, _duration = 500) => {
        const m = mapRef.current;
        if (!m) return;
        m.flyTo([r.latitude, r.longitude], deltaToZoom(r.latitudeDelta), {
          duration: 0.6,
        });
      },
    }),
    [],
  );

  return (
    <View style={[{ flex: 1, position: 'relative', overflow: 'hidden' }, style]}>
      <div
        className="sync-map"
        data-theme={mode}
        ref={containerRef as any}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      {mapRef.current && (
        <MapContext.Provider value={mapRef.current}>
          {/* Filhos invisíveis no DOM — usam a API do leaflet */}
          <div style={{ display: 'none' }}>{children}</div>
        </MapContext.Provider>
      )}
    </View>
  );
});

export { MapView };
export default MapView;

// ---------------- Marker ----------------
export const Marker = ({
  coordinate,
  onPress,
  children,
}: {
  coordinate: { latitude: number; longitude: number };
  onPress?: () => void;
  children?: React.ReactNode;
}) => {
  const map = React.useContext(MapContext);
  const markerRef = useRef<L.Marker | null>(null);

  const html = useMemo(() => {
    if (!children) return '';
    try {
      return ReactDOMServer.renderToStaticMarkup(<>{children}</> as any);
    } catch {
      return '';
    }
  }, [children]);

  useEffect(() => {
    if (!map) return;
    const icon = html
      ? L.divIcon({
          html,
          className: 'sync-marker',
          iconSize: [44, 52],
          iconAnchor: [22, 52],
        })
      : new L.Icon.Default();

    const marker = L.marker([coordinate.latitude, coordinate.longitude], { icon }).addTo(map);
    if (onPress) marker.on('click', onPress);
    markerRef.current = marker;
    return () => {
      marker.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, coordinate.latitude, coordinate.longitude, html]);

  return null;
};

// ---------------- Circle ----------------
export const Circle = ({
  center,
  radius,
  strokeColor,
  fillColor,
  strokeWidth = 1,
  fillOpacity = 0.08,
}: {
  center: { latitude: number; longitude: number };
  radius: number;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  fillOpacity?: number;
}) => {
  const map = React.useContext(MapContext);
  useEffect(() => {
    if (!map) return;
    const circle = L.circle([center.latitude, center.longitude], {
      radius,
      color: strokeColor || '#FF6B35',
      weight: strokeWidth,
      fillColor: fillColor || '#FF6B35',
      fillOpacity,
    }).addTo(map);
    return () => {
      circle.remove();
    };
  }, [map, center.latitude, center.longitude, radius, strokeColor, fillColor, strokeWidth, fillOpacity]);
  return null;
};

// ---------------- HeatLayer ----------------
// Heatmap simples — desenha circles em cada ponto com baixa opacidade.
// (Leaflet.heat exigiria CDN extra; este approach é leve e funciona offline.)
export const HeatLayer = ({
  points,
  intensity = 0.15,
  radiusM = 60,
  color = '#FF6B35',
}: {
  points: Array<[number, number]>;
  intensity?: number;
  radiusM?: number;
  color?: string;
}) => {
  const map = React.useContext(MapContext);
  useEffect(() => {
    if (!map || !points?.length) return;
    const layer = L.layerGroup().addTo(map);
    for (const [lat, lng] of points) {
      L.circle([lat, lng], {
        radius: radiusM,
        color,
        weight: 0,
        fillColor: color,
        fillOpacity: intensity,
      }).addTo(layer);
    }
    return () => { layer.remove(); };
  }, [map, JSON.stringify(points), intensity, radiusM, color]);
  return null;
};

// ---------------- Polyline ----------------
export const Polyline = ({
  coordinates,
  strokeColor = '#FF6B35',
  strokeWidth = 4,
}: {
  coordinates: { latitude: number; longitude: number }[];
  strokeColor?: string;
  strokeWidth?: number;
}) => {
  const map = React.useContext(MapContext);
  useEffect(() => {
    if (!map) return;
    const poly = L.polyline(
      coordinates.map((c) => [c.latitude, c.longitude]) as any,
      { color: strokeColor, weight: strokeWidth, opacity: 0.9 },
    ).addTo(map);
    return () => {
      poly.remove();
    };
  }, [map, coordinates, strokeColor, strokeWidth]);
  return null;
};
