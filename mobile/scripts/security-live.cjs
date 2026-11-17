// Read-only checks of a deployed frontend/API. Never saves response bodies,
// cookies, credentials or tokens. Authenticated coverage requires a test session.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { headers: expectedHeaders } = require('./security-policy.cjs');
const frontend = new URL(process.env.SECURITY_WEB_URL || 'https://sync-2-0-blush.vercel.app');
const api = new URL(process.env.SECURITY_API_URL || 'https://sync-backend-o2zc.onrender.com');
if (frontend.protocol !== 'https:' || api.protocol !== 'https:') throw new Error('Live checks require HTTPS');
const report = { checkedAt: new Date().toISOString(), frontend: frontend.origin, api: api.origin, checks: [], limitations: [] };
function record(name, ok, evidence) {
  report.checks.push({ name, status: ok ? 'PASS' : 'FAIL', evidence });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
}
async function get(base, route, options = {}) {
  return fetch(new URL(route, base), { redirect: 'error', signal: AbortSignal.timeout(80000), ...options });
}
function inspectHeaders(name, response, cachedHeaders) {
  const actual = {};
  const mismatches = [];
  for (const { key, value } of expectedHeaders) {
    actual[key] = response.headers.get(key);
    // A 304 updates an existing cached representation (RFC 9110, 15.4.5).
    // Omitted fields retain the cached 200 value; absence alone is not a flaw.
    const effective = actual[key] ?? (response.status === 304 ? cachedHeaders?.get(key) : null);
    if (key === 'Access-Control-Allow-Origin' ? effective === '*' || (effective !== null && effective !== value) : effective !== value) mismatches.push(key);
  }
  actual['x-vercel-cache'] = response.headers.get('x-vercel-cache');
  actual['x-vercel-id'] = response.headers.get('x-vercel-id');
  record(name, !mismatches.length, { status: response.status, headers: actual, inheritedFromCached200: response.status === 304 && !!cachedHeaders, mismatches });
}
async function main() {
  const home = await get(frontend, '/');
  record('frontend reachable', home.status === 200, { status: home.status });
  inspectHeaders('frontend HTML headers', home);
  const html = await home.text();
  const assetPath = html.match(/<script[^>]+src=["']([^"']+)["']/i)?.[1];
  if (assetPath && new URL(assetPath, frontend).origin === frontend.origin) {
    const asset = await get(frontend, assetPath);
    inspectHeaders('frontend static asset headers', asset);
    const etag = asset.headers.get('etag');
    await asset.arrayBuffer();
    const repeat = await get(frontend, assetPath);
    inspectHeaders('frontend repeat/cache response headers', repeat);
    const cacheStates = [asset.headers.get('x-vercel-cache'), repeat.headers.get('x-vercel-cache')];
    await repeat.arrayBuffer();
    if (!cacheStates.includes('HIT')) report.limitations.push('No CDN HIT observed; repeat on the deployed version until HIT is observed.');
    if (etag) {
      const conditional = await get(frontend, assetPath, { headers: { 'If-None-Match': etag } });
      record('conditional request returns 304', conditional.status === 304, { status: conditional.status });
      inspectHeaders('frontend conditional response headers', conditional, asset.headers);
      await conditional.arrayBuffer();
    } else report.limitations.push('Asset has no ETag; conditional 304 was not exercised.');
  } else report.limitations.push('Could not identify a same-origin frontend script asset.');
  const missing = await get(frontend, `/_security-not-found-${randomUUID()}.txt`);
  record('missing asset returns 404', missing.status === 404, { status: missing.status });
  inspectHeaders('frontend platform error headers', missing);
  await missing.arrayBuffer();
  const originProbe = await get(frontend, '/manifest.json', { headers: { Origin: 'https://untrusted.example' } });
  const allowed = originProbe.headers.get('access-control-allow-origin');
  record('frontend CORS has no wildcard/untrusted reflection', allowed !== '*' && allowed !== 'https://untrusted.example', { allowOrigin: allowed });
  await originProbe.arrayBuffer();
  const health = await get(api, '/api/health');
  record('Render health', health.status === 200 && (await health.json()).status === 'ok', { status: health.status });
  for (const origin of [frontend.origin, 'https://untrusted.example']) {
    const preflight = await get(api, '/api/users/me', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } });
    const value = preflight.headers.get('access-control-allow-origin');
    record(`API CORS ${origin === frontend.origin ? 'trusted' : 'untrusted'}`, origin === frontend.origin ? value === origin : value === null, { status: preflight.status, allowOrigin: value });
    await preflight.arrayBuffer();
  }
  const routes = ['/api/users/me', '/api/feed', '/api/activities/history', '/api/groups/me', '/api/chat/conversations'];
  for (const route of routes) {
    for (const invalid of [false, true]) {
      const res = await get(api, route, { headers: invalid ? { Authorization: 'Bearer security-probe-invalid-token' } : {} });
      record(`${route} rejects ${invalid ? 'invalid session' : 'anonymous request'}`, res.status === 401, { status: res.status });
      await res.arrayBuffer();
    }
  }
  const token = process.env.SECURITY_TEST_TOKEN;
  if (!token) {
    report.limitations.push('Authenticated Render checks NOT RUN: supply SECURITY_TEST_TOKEN from a dedicated test account. Local fixture tests do not replace this check.');
  } else {
    for (const route of routes) {
      const res = await get(api, route, { headers: { Authorization: `Bearer ${token}`, Origin: frontend.origin } });
      const data = await res.json();
      const shape = route === '/api/users/me' ? !!data?.id : Array.isArray(data) || Array.isArray(data?.data) || Array.isArray(data?.activities);
      record(`${route} authenticated test account`, res.status === 200 && shape && res.headers.get('access-control-allow-origin') === frontend.origin, { status: res.status, expectedJsonShape: shape });
    }
  }
  report.limitations.push('Real Google consent, authenticated browser navigation, cross-account authorization and provider TCP timestamps are outside this HTTP smoke check.');
}
main().catch(error => {
  // Never serialize arbitrary request exceptions containing authorization data.
  record('live execution', false, { error: error.name, message: 'Request failed; inspect connectivity/target manually.' });
}).finally(() => {
  const output = path.resolve(process.env.SECURITY_REPORT || path.join(__dirname, '../test-results/security-live.json'));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(`Report: ${output}`);
  for (const limitation of report.limitations) console.log(`PENDING ${limitation}`);
  if (report.checks.some(check => check.status === 'FAIL') || report.limitations.length > 1) process.exitCode = 1;
});
