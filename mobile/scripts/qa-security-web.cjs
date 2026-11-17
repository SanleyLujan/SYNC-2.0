// Enforce the production CSP against the actual exported app, using synthetic
// API responses. The optional Google check loads GIS but never submits consent.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { headersForPath } = require('./security-policy.cjs');
const root = path.resolve(__dirname, '../dist');
const output = path.resolve(process.env.SECURITY_UI_OUTPUT || path.join(__dirname, '../test-results/security-web'));
fs.mkdirSync(output, { recursive: true });
const base = 'http://localhost:8097';
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const user = { id: 'security-test-user', name: 'Pessoa de teste', email: 'test@example.invalid', onboardingCompleted: true, emailVerified: true, isActive: true, latitude: -22.47, longitude: -44.45, themeMode: 'light', sports: ['running'], objectives: [], availability: [], hobbies: [] };
const peer = { ...user, id: 'security-test-peer', name: 'Parceiro fictício', avatarUrl: 'https://lh3.googleusercontent.com/security-avatar.png' };
const post = { id: 'security-test-post', user_id: peer.id, user: peer, caption: 'Publicação de teste da CSP', sport: 'running', distanceKm: 5, likesCount: 0, commentsCount: 0, createdAt: new Date().toISOString() };
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, base).pathname;
  for (const { key, value } of headersForPath(pathname)) res.setHeader(key, value);
  const file = path.resolve(root, '.' + decodeURIComponent(pathname));
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); res.end(); return; }
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root, 'index.html');
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' })[path.extname(target)] || 'application/octet-stream');
  fs.createReadStream(target).pipe(res);
});
const checks = [];
async function verify(browser, width, mode) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', permissions: ['geolocation'], geolocation: { latitude: -22.47, longitude: -44.45 } });
  const errors = [];
  const calls = [];
  await context.addInitScript(({ mode }) => {
    window.__securityViolations = [];
    document.addEventListener('securitypolicyviolation', e => window.__securityViolations.push({ directive: e.effectiveDirective, blocked: e.blockedURI }));
    localStorage.setItem('@sync:theme-mode', mode);
    localStorage.setItem('@sync:accessibility', JSON.stringify({ reduceMotion: true, hapticsEnabled: false, highContrast: true, colorBlindMode: 'protanopia' }));
    // This suite tests CSP/layout, not Windows' GPS provider. Keep GPS synthetic.
    navigator.geolocation.getCurrentPosition = success => queueMicrotask(() => success({
      coords: { latitude: -22.47, longitude: -44.45, accuracy: 5 }, timestamp: Date.now(),
    }));
  }, { mode });
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === base) return route.continue();
    if (process.env.SECURITY_GOOGLE_NETWORK === '1' &&
        (url.hostname === 'accounts.google.com' || req.frame().url().startsWith('https://accounts.google.com/'))) return route.continue();
    if (url.hostname === 'sync-backend-o2zc.onrender.com' && url.pathname.startsWith('/api/')) {
      const endpoint = url.pathname.slice(4);
      calls.push({ endpoint, method: req.method(), authenticated: !!req.headers().authorization });
      let data = [];
      if (endpoint === '/health') data = { status: 'ok' };
      if (endpoint === '/auth/login') {
        assert.deepEqual(req.postDataJSON(), { email: 'test@example.invalid', password: 'FixturePass7!' });
        data = { accessToken: 'synthetic-access-token', refreshToken: 'synthetic-refresh-token', user: { ...user, themeMode: mode } };
      }
      if (endpoint === '/auth/google') {
        assert.deepEqual(req.postDataJSON(), { idToken: 'synthetic-google-credential' });
        data = { accessToken: 'synthetic-access-token', refreshToken: 'synthetic-refresh-token', user: { ...user, themeMode: mode } };
      }
      if (endpoint === '/users/me') data = { ...user, themeMode: mode };
      if (endpoint === '/feed') data = [post];
      if (endpoint === '/users/nearby') data = [peer];
      if (endpoint === '/gamification/me') data = { level: 1, totalXP: 0, todayXP: 0, dailyCap: 100, nextLevelXP: 500, currentLevelXP: 0, missions: [] };
      if (endpoint.endsWith('/count') || endpoint.endsWith('new-count')) data = { count: 0 };
      return route.fulfill({ json: data });
    }
    if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.endsWith('leaflet.css')) return route.fulfill({ path: require.resolve('leaflet/dist/leaflet.css'), contentType: 'text/css' });
    if (req.resourceType() === 'image') return route.fulfill({ contentType: 'image/png', body: pixel });
    if (url.hostname === 'nominatim.openstreetmap.org') return route.fulfill({ json: { address: { city: 'Cidade de teste' } } });
    if (url.hostname === 'api.open-meteo.com') return route.fulfill({ json: { current: { temperature_2m: 21, weather_code: 3 } } });
    // Deterministic local run: Google consent is a separate manual check.
    return route.fulfill({ contentType: 'application/javascript', body: '' });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(base);
    await page.getByText(/^(Entrar|Já tenho conta|Ja tenho conta)$/).first().click();
    await page.getByPlaceholder('seu@email.com').fill('test@example.invalid');
    await page.getByPlaceholder('Sua senha').fill('FixturePass7!');
    let google = 'not requested';
    if (process.env.SECURITY_GOOGLE_NETWORK === '1') {
      await page.frameLocator('iframe[title="Entrar com Google"]').locator('iframe[src^="https://accounts.google.com/gsi/button"]').waitFor({ state: 'attached' });
      const googlePage = page.frames().find(f => f.url() === base + '/google-signin.html');
      assert.deepEqual(await googlePage.evaluate(() => window.__securityViolations), []);
      await page.screenshot({ path: path.join(output, `${mode}-${width}-google-login.png`) });
      google = 'real GIS button loaded; consent not submitted';
    }
    // A same-origin message from the wrong source window must be ignored.
    await page.evaluate(() => window.postMessage({ type: 'sync-google-credential', credential: 'spoofed-credential' }, location.origin));
    await page.waitForTimeout(100);
    assert(!calls.some(c => c.endpoint === '/auth/google'));
    if (width === 1440) {
      const child = page.frames().find(f => f.url() === base + '/google-signin.html');
      assert(child);
      await child.evaluate(() => parent.postMessage({ type: 'sync-google-credential', credential: 'synthetic-google-credential' }, location.origin));
    } else await page.getByText('Entrar', { exact: true }).last().click();
    await page.getByText(post.caption, { exact: true }).waitFor();
    assert(calls.some(c => c.endpoint === (width === 1440 ? '/auth/google' : '/auth/login') && c.method === 'POST'));
    assert(calls.some(c => c.endpoint === '/feed' && c.authenticated));
    await page.getByRole('tab', { name: 'Mapa', exact: true }).click();
    await page.locator('.leaflet-container').waitFor();
    await page.locator('.leaflet-tile-loaded').first().waitFor();
    await page.getByLabel('Mostrar atletas próximos no mapa').click();
    await page.locator('.sync-marker').first().waitFor();
    await page.waitForFunction(() => [...document.fonts].some(f => f.status === 'loaded'));
    const mapStyles = await page.locator('#sync-leaflet-style').evaluate(n => n.sheet.cssRules.length);
    assert(mapStyles >= 8);
    await page.screenshot({ path: path.join(output, `${mode}-${width}-map.png`) });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), []);
    // Inject real DOM elements. DevTools evaluation alone bypasses script CSP.
    await page.evaluate(() => {
      const script = document.createElement('script'); script.textContent = 'window.__inlineExecuted=true'; document.head.appendChild(script);
      const style = document.createElement('style'); style.textContent = 'body{--csp-injected:blocked}'; document.head.appendChild(style);
      const el = document.createElement('button'); el.setAttribute('onclick', 'window.__handlerExecuted=true'); el.setAttribute('style', 'color:red'); document.body.appendChild(el); el.click();
      const image = new Image(); image.src = 'https://untrusted.example/security.png'; document.body.appendChild(image);
    });
    await page.waitForFunction(() => window.__securityViolations.length >= 5);
    const denied = await page.evaluate(() => ({ script: window.__inlineExecuted, handler: window.__handlerExecuted, directives: window.__securityViolations.map(e => e.directive) }));
    assert(!denied.script && !denied.handler);
    for (const directive of ['script-src-elem', 'script-src-attr', 'style-src-elem', 'style-src-attr', 'img-src']) assert(denied.directives.includes(directive));
    checks.push({ mode, width, status: 'PASS', google, login: width === 1440 ? 'Google bridge + synthetic API' : 'email + synthetic API', map: 'real Leaflet with synthetic tiles and React marker', negativeCspChecks: 5, spoofedGoogleMessage: 'rejected' });
    console.log(`PASS ${mode} ${width}: login, feed, fonts, map and 5 CSP blocks`);
  } catch (error) {
    await page.screenshot({ path: path.join(output, `${mode}-${width}-failure.png`) }).catch(() => {});
    console.error('Page text:', (await page.locator('body').innerText()).slice(-1500));
    console.error('CSP:', await page.evaluate(() => window.__securityViolations));
    console.error('Google styles:', await page.evaluate(() => ({ styles: [...document.querySelectorAll('style')].filter(n => n.textContent).map(n => ({ id: n.id, text: n.textContent.slice(0, 200), length: n.textContent.length })), attrs: [...document.querySelectorAll('[style]')].filter(n => n.closest('[id^="gsi_"]') || /gsi|g_id|haAclf/.test(n.className)).map(n => ({ tag: n.tagName, class: n.className, style: n.getAttribute('style') })) })));
    throw error;
  } finally { await context.close(); }
}
(async () => {
  await new Promise(resolve => server.listen(8097, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  try {
    for (const mode of ['light', 'dark']) for (const width of [390, 1440]) await verify(browser, width, mode);
  } finally { await browser.close(); server.close(); fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(checks, null, 2)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
