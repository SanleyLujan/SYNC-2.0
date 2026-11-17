// Shared by the Vercel config generator, the build and browser checks.
const EMPTY_STYLE_HASH = "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='";
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
// Expo Image has one fixed transition stylesheet. Authorize its exact text.
// A dependency update must regenerate both committed Vercel configurations.
const imageSource = readFileSync(resolve(__dirname, '../node_modules/expo-image/src/web/imageStyles.tsx'), 'utf8').replace(/\r\n/g, '\n');
const imageCss = imageSource.match(/^const style = `([\s\S]*?)`;/)?.[1];
if (!imageCss || imageCss.includes('${')) throw new Error('Review the Expo Image CSP stylesheet hash');
const imageHash = `'sha256-${createHash('sha256').update(imageCss).digest('base64')}'`;
const csp = [
  "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
  "frame-src 'self'", "form-action 'self'",
  "script-src 'self'",
  "script-src-attr 'none'",
  // RN Web creates an EMPTY sheet, then trusted JS uses CSSOM insertRule.
  // The hash authorizes only empty text, never arbitrary inline CSS.
  `style-src 'self' ${EMPTY_STYLE_HASH} ${imageHash} https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css`,
  "style-src-attr 'none'",
  "img-src 'self' data: blob: https://images.unsplash.com https://lh3.googleusercontent.com https://lh4.googleusercontent.com https://lh5.googleusercontent.com https://lh6.googleusercontent.com https://sync-backend-o2zc.onrender.com https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/",
  "font-src 'self' data:",
  "connect-src 'self' https://sync-backend-o2zc.onrender.com wss://sync-backend-o2zc.onrender.com https://api.open-meteo.com https://air-quality-api.open-meteo.com https://api.sunrise-sunset.org https://nominatim.openstreetmap.org https://routing.openstreetmap.de https://api.quotable.io https://ipapi.co https://exp.host",
  "worker-src 'self' blob:", "upgrade-insecure-requests",
].join('; ');
const headers = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), payment=(), usb=()' },
  { key: 'Content-Security-Policy', value: csp },
  // Override Vercel's public static asset wildcard. Native apps do not use CORS.
  { key: 'Access-Control-Allow-Origin', value: 'https://sync-2-0-blush.vercel.app' },
];
// GIS injects both stylesheet text and style attributes. Keep that exception
// off the Expo document; no app/session data is rendered in the child page.
const googleCsp = [
  "default-src 'none'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'self'",
  "form-action 'none'", "script-src 'self' https://accounts.google.com/gsi/client", "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  'frame-src https://accounts.google.com/gsi/', 'connect-src https://accounts.google.com/gsi/',
  "img-src 'self' data: https://accounts.google.com https://lh3.googleusercontent.com", 'upgrade-insecure-requests',
].join('; ');
const googleHeaders = headers.map(h => h.key === 'Content-Security-Policy' ? { ...h, value: googleCsp } : h.key === 'X-Frame-Options' ? { ...h, value: 'SAMEORIGIN' } : h);
googleHeaders.push({ key: 'Cache-Control', value: 'no-store' });
const APP_HEADER_SOURCE = '/((?!google-signin\\.html$).*)';
const headersForPath = pathname => pathname === '/google-signin.html' ? googleHeaders : headers;
module.exports = { csp, headers, googleHeaders, headersForPath, APP_HEADER_SOURCE, EMPTY_STYLE_HASH };
