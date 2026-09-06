// Public basemap credential, injected by Expo at build time (not an admin secret).
export function getCartoTileUrl(darkMode = true): string {
  const key = process.env.EXPO_PUBLIC_CARTO_API_KEY?.trim();
  const style = darkMode ? 'dark_all' : 'rastertiles/voyager';
  const url = `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`;
  // Also escape quotes because the legacy web shim embeds this URL in a script.
  return key ? `${url}?key=${encodeURIComponent(key).replace(/'/g, '%27')}` : url;
}
