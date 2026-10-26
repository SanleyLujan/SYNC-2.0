// Local-only regression: all APIs and GPS fixes are fixtures, with no production writes.
// node scripts/qa-tracking-recovery.cjs C:/SYNC/tracking-pwa-preview-20261026
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(process.argv[2]);
const output = path.resolve(process.env.TRACKING_QA_OUTPUT || 'C:/SYNC/tracking-pwa-qa-20261026');
fs.mkdirSync(output, { recursive: true });
const baseUrl = 'http://127.0.0.1:8096';
const start = Date.parse('2026-10-26T12:00:00Z');
const user = { id: 'tracking-test-user', name: 'Pessoa de teste', email: 'tracking@example.invalid', onboardingCompleted: true, emailVerified: true, latitude: -23.55, longitude: -46.64, themeMode: 'dark', sports: ['running'], objectives: [], availability: [], hobbies: [] };
const key = '@sync:web-tracking-recovery';
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, baseUrl).pathname));
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root, 'index.html');
  response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' })[path.extname(target)] || 'application/octet-stream');
  fs.createReadStream(target).pipe(response);
});

async function verify(browser, gym = false) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  let offline = false, starts = 0, finishPayload;
  const timing = [];
  let activity = { id: 'tracking-test', user_id: user.id, sport: gym ? 'gym' : 'running', startTime: new Date(gym ? start - 300_000 : start).toISOString(), duration: 0, distance: 0, pausedAt: null, pausedDuration: gym ? 60 : 0, isCompleted: false, points: [] };
  await context.addInitScript(({ user, start, gym, key }) => {
    localStorage.setItem('@sync:token', 'local-test-token');
    localStorage.setItem('@sync:user', JSON.stringify(user));
    localStorage.setItem('@sync:theme-mode', 'dark');
    localStorage.setItem('@sync:accessibility', JSON.stringify({ reduceMotion: true, hapticsEnabled: false }));
    if (gym && !localStorage.getItem('@qa:seeded')) {
      localStorage.setItem('@qa:seeded', 'true');
      localStorage.setItem(key, JSON.stringify({ userId: user.id, activityId: 'tracking-test', sport: 'gym', startedAt: start - 300_000, totalPausedMs: 60_000, pausedAt: null, pauseSource: null, points: [], pendingTimingEvents: [], syncedThrough: 0, autoPauseOn: false, plannedRoute: [], targetGoal: null }));
    }
    window.__now = Number(localStorage.getItem('@qa:clock') || start);
    Date.now = () => window.__now;
    window.__advance = ms => { window.__now += ms; localStorage.setItem('@qa:clock', String(window.__now)); };
    window.__visible = true;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__visible ? 'visible' : 'hidden' });
    window.__visibility = visible => { window.__visible = visible; document.dispatchEvent(new Event('visibilitychange')); };
    window.__watches = new Map();
    let watchId = 0;
    let last = { timestamp: window.__now, coords: { latitude: -23.55, longitude: -46.64, accuracy: 5, speed: 2, altitude: 700 } };
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: callback => callback(last),
      watchPosition: callback => { const id = ++watchId; window.__watches.set(id, callback); return id; },
      clearWatch: id => window.__watches.delete(id),
    } });
    window.__move = (ms, latitude) => {
      window.__advance(ms);
      last = { ...last, timestamp: window.__now, coords: { ...last.coords, latitude } };
      for (const callback of [...window.__watches.values()]) callback(last);
    };
  }, { user, start, gym, key });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) {
      if (url.origin === baseUrl) return route.continue();
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    const endpoint = url.pathname.slice(4);
    if (offline && endpoint.startsWith('/activities/')) return route.fulfill({ status: 503, json: { message: 'Offline simulado' } });
    let data = [];
    if (endpoint === '/users/me') data = user;
    if (endpoint.endsWith('/count') || endpoint.endsWith('/new-count')) data = { count: 0 };
    if (endpoint === '/activities/start') { starts++; activity.sport = request.postDataJSON().sport; data = activity; }
    if (endpoint === '/activities/tracking-test') data = activity;
    if (endpoint === '/activities/tracking-test/points/batch') {
      const points = request.postDataJSON().points;
      activity.points = [...new Map([...activity.points, ...points].map(point => [point.timestamp, point])).values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
      data = { accepted: points.length };
    }
    if (/\/activities\/tracking-test\/(pause|resume)$/.test(endpoint)) {
      const action = endpoint.split('/').pop(), at = request.postDataJSON().occurredAt;
      timing.push(action);
      if (action === 'pause' && !activity.pausedAt) activity.pausedAt = at;
      if (action === 'resume' && activity.pausedAt) { activity.pausedDuration += (Date.parse(at) - Date.parse(activity.pausedAt)) / 1000; activity.pausedAt = null; }
      data = { paused: !!activity.pausedAt, pausedAt: activity.pausedAt, pausedDuration: activity.pausedDuration };
    }
    if (endpoint === '/activities/tracking-test/finish') {
      finishPayload = request.postDataJSON();
      activity = { ...activity, isCompleted: true, points: finishPayload.points, duration: finishPayload.activeDurationSeconds, calories: 20, distance: 16.7 };
      data = activity;
    }
    if (endpoint === '/activities/records') data = { bySport: {} };
    return route.fulfill({ json: data });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  const train = async () => {
    await page.getByRole('tab', { name: 'Treinar', exact: true }).click();
  };
  await page.goto(baseUrl);
  await train();
  if (!gym) {
    await page.getByText('Iniciar', { exact: true }).click();
    await page.getByLabel('Toque para começar agora', { exact: true }).click();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || 'null')?.points.length >= 1, key);
    await page.evaluate(() => window.__move(2_000, -23.54995));
    await page.evaluate(() => window.__visibility(false));
    await page.evaluate(() => window.__move(2_000, -23.54990));
    assert.equal((await saved()).points.length, 3, 'fix recebido com a página oculta deve ser preservado');
    offline = true;
    await page.evaluate(() => window.__move(60_000, -23.54));
    await page.evaluate(() => window.__move(2_000, -23.53995));
    assert.equal((await saved()).points[3].segmentStart, true, 'lacuna deve iniciar novo trecho');
    await page.evaluate(() => window.__visibility(true));
    await page.getByRole('button', { name: 'Pausar treino', exact: true }).click();
    await page.evaluate(() => window.__advance(30_000));
    const beforeReload = await saved();
    await page.reload();
    await train();
    await page.getByRole('button', { name: 'Retomar treino', exact: true }).waitFor();
    const afterReload = await saved();
    assert.equal(afterReload.points.length, beforeReload.points.length);
    assert.equal(afterReload.pausedAt, beforeReload.pausedAt);
    assert.equal(starts, 1, 'recuperação não cria outra atividade');
    await page.getByRole('button', { name: 'Retomar treino', exact: true }).click();
    offline = false;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForFunction(key => {
      const state = JSON.parse(localStorage.getItem(key));
      return state.pendingTimingEvents.length === 0 && state.syncedThrough === state.points.at(-1).timestamp;
    }, key);
    assert.deepEqual(timing.slice(0, 2), ['pause', 'resume']);
    assert.equal(activity.points.length, 5);
    assert.equal(activity.points.filter(point => point.segmentStart).length, 2);
    await page.getByText('Percurso em trechos. Os intervalos entre eles não entram na distância.', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'running-390x844.png') });
    await page.setViewportSize({ width: 320, height: 568 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, 'running-320x568.png') });
  } else {
    await page.getByRole('button', { name: 'Pausar treino', exact: true }).waitFor();
    await page.evaluate(() => { window.__visibility(false); window.__advance(120_000); window.__visibility(true); });
    await page.getByLabel('Tempo: 06:00', { exact: true }).first().waitFor();
    await page.reload();
    await train();
    await page.getByLabel('Tempo: 06:00', { exact: true }).first().waitFor();
    assert.equal((await saved()).sport, 'gym');
    assert.equal(starts, 0);
    // O relógio fixo da fixture também afeta as animações do React Navigation.
    await page.evaluate(() => window.__advance(1_000));
    await page.waitForFunction(() => {
      const button = document.querySelector('[aria-label="Finalizar treino"]');
      const box = button?.getBoundingClientRect();
      return box && box.width > 0 && box.top >= 0 && box.bottom <= innerHeight;
    });
    await page.screenshot({ path: path.join(output, 'gym-recovered.png') });
  }
  await page.getByRole('button', { name: 'Finalizar treino', exact: true }).click();
  await page.waitForFunction(key => localStorage.getItem(key) === null, key);
  assert.equal(finishPayload.activeDurationSeconds, gym ? 361 : 66);
  if (!gym) {
    await page.getByText('Percurso em trechos. A distância considera apenas os trechos registrados.', { exact: true }).waitFor();
    assert.equal(await page.locator('.leaflet-overlay-pane path').count(), 2);
    await page.screenshot({ path: path.join(output, 'summary-with-gaps.png') });
  }
  assert.deepEqual(errors, []);
  console.log(gym ? 'PASS gym: tempo em segundo plano, recarga, finalização' : 'PASS running: fixes ocultos, lacunas, offline, pausa, recarga, sincronização, resumo');
  await context.close();
}

(async () => {
  await new Promise(resolve => server.listen(8096, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  try { await verify(browser); await verify(browser, true); }
  finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
