// Local-only regression with two accounts; no requests reach production.
// PLAYWRIGHT_MODULE=/path/to/playwright node scripts/qa-event-attendance.cjs <web-export>
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(process.argv[2]);
const output = process.env.EVENT_QA_OUTPUT || 'C:/SYNC/events-attendance-qa-20261026';
fs.mkdirSync(output, { recursive: true });
const baseUrl = 'http://127.0.0.1:8097';
const members = new Set();
let joinCalls = 0;
const users = ['host', 'guest'].map(id => ({ id, name: `Pessoa ${id}`, email: `${id}@events.test.invalid`, onboardingCompleted: true, emailVerified: true, latitude: -23.55, longitude: -46.64, themeMode: 'dark', sports: ['running'], objectives: [], availability: [], hobbies: [] }));
const event = { id: 'fixture-event', title: 'Corrida de teste', sport: 'running', description: 'Evento fictício para validar participantes', date: new Date(Date.now() + 3_600_000).toISOString(), latitude: -23.5497, longitude: -46.64, address: 'Local de teste', maxParticipants: 3, creator_id: 'host', creator: { id: 'host', name: 'Pessoa host' } };
const snapshot = user => ({ ...event, participantCount: members.size, isJoined: members.has(user.id), participants: [...members].map(id => ({ id: `member-${id}`, user: { id, name: `Pessoa ${id}` } })) });
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, baseUrl).pathname));
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root, 'index.html');
  response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' })[path.extname(target)] || 'application/octet-stream');
  fs.createReadStream(target).pipe(response);
});

async function account(browser, user) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', permissions: ['geolocation'], geolocation: { latitude: user.latitude, longitude: user.longitude } });
  await context.addInitScript(user => {
    localStorage.setItem('@sync:token', `test-token-${user.id}`);
    localStorage.setItem('@sync:user', JSON.stringify(user));
    localStorage.setItem('@sync:theme-mode', 'dark');
    localStorage.setItem('@sync:accessibility', JSON.stringify({ reduceMotion: true, hapticsEnabled: false }));
  }, user);
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) {
      if (url.origin === baseUrl) return route.continue();
      if (url.pathname.endsWith('/leaflet.css')) return route.fulfill({ contentType: 'text/css', body: fs.readFileSync(path.join(__dirname, '../node_modules/leaflet/dist/leaflet.css')) });
      if (url.pathname.endsWith('.png')) return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1cAAAAASUVORK5CYII=', 'base64') });
      return route.fulfill({ json: {} });
    }
    const endpoint = url.pathname.slice(4);
    let data = [];
    if (endpoint === '/users/me') data = user;
    if (endpoint.endsWith('/count') || endpoint.endsWith('/new-count')) data = { count: 0 };
    if (endpoint === '/events/nearby') {
      assert.ok(url.searchParams.has('latitude') && url.searchParams.has('longitude') && url.searchParams.has('radiusKm'));
      data = [snapshot(user)];
    }
    if (endpoint === '/events/fixture-event') data = snapshot(user);
    if (endpoint === '/events/fixture-event/comments') data = { comments: [] };
    if (endpoint === '/events/fixture-event/join') {
      joinCalls++;
      if (members.has(user.id)) return route.fulfill({ status: 400, json: { message: 'Já participa' } });
      members.add(user.id); data = snapshot(user);
    }
    if (endpoint === '/events/fixture-event/leave') { members.delete(user.id); data = snapshot(user); }
    if (endpoint === '/events/my') data = { created: user.id === 'host' ? [snapshot(user)] : [], participating: members.has(user.id) ? [snapshot(user)] : [] };
    return route.fulfill({ json: data });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.clock.install();
  const map = async () => {
    await page.getByRole('tab', { name: 'Mapa', exact: true }).click();
    await page.locator('.leaflet-marker-icon.sync-marker').first().click();
    await page.getByText(event.title, { exact: true }).waitFor();
  };
  await page.goto(baseUrl);
  await map();
  return { context, page, errors, map };
}

(async () => {
  await new Promise(resolve => server.listen(8097, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  try {
    const host = await account(browser, users[0]);
    const guest = await account(browser, users[1]);
    await host.page.getByText('0/3 participantes', { exact: true }).waitFor();
    await guest.page.getByText('Participar', { exact: true }).click();
    await guest.page.getByText('1/3 participantes', { exact: true }).waitFor();
    await guest.page.getByText('Participando', { exact: true }).waitFor();
    assert.equal(joinCalls, 1);
    await host.page.clock.fastForward(15_100);
    await host.page.getByText('1/3 participantes', { exact: true }).waitFor();
    await host.page.screenshot({ path: path.join(output, 'host-count-updated.png') });

    // A contagem e o estado não dependem de incrementar um número na tela.
    await guest.page.reload(); await guest.map();
    await guest.page.getByText('1/3 participantes', { exact: true }).waitFor();
    await guest.page.getByText('Participando', { exact: true }).waitFor();
    assert.equal(joinCalls, 1);
    await guest.page.getByText('Ver detalhes', { exact: true }).click();
    await guest.page.getByText('Voce esta participando!', { exact: true }).waitFor();
    await guest.page.getByText(/^1\s*\/\s*3\s*\(2 vagas\)$/i).waitFor();
    // O rodapé existente fica sob a barra inferior em telas pequenas. Testa
    // o handler por evento DOM sem alterar o layout fora do escopo da contagem.
    await guest.page.getByText('Sair do evento', { exact: true }).dispatchEvent('click');
    await guest.page.getByText(/^0\s*\/\s*3\s*\(3 vagas\)$/i).waitFor();
    await guest.page.getByText('Participar do evento', { exact: true }).waitFor();
    await host.page.clock.fastForward(15_100);
    await host.page.getByText('0/3 participantes', { exact: true }).waitFor();

    // O marcador usa os dados atuais mesmo sem recriar seu callback no Leaflet.
    await host.page.locator('.leaflet-marker-icon.sync-marker').first().click();
    await host.page.getByText('0/3 participantes', { exact: true }).waitFor();
    await host.page.getByText('Ver detalhes', { exact: true }).click();
    await host.page.getByText(/^0\s*\/\s*3\s*\(3 vagas\)$/i).waitFor();
    await guest.page.getByText('Participar do evento', { exact: true }).dispatchEvent('click');
    await guest.page.getByText('Voce esta participando!', { exact: true }).waitFor();
    await guest.page.getByText(/^1\s*\/\s*3\s*\(2 vagas\)$/i).waitFor();
    await host.page.clock.fastForward(15_100);
    await host.page.getByText(/^1\s*\/\s*3\s*\(2 vagas\)$/i).waitFor();
    await host.page.screenshot({ path: path.join(output, 'host-detail-count-updated.png') });
    assert.equal(joinCalls, 2);
    assert.deepEqual(host.errors, []); assert.deepEqual(guest.errors, []);
    console.log('PASS event attendance: join, reload, leave, rejoin, map/detail refresh across two accounts, no duplicate join');
    await host.context.close(); await guest.context.close();
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
