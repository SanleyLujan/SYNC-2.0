// Run against an Expo web export: node scripts/social-lists.regression.cjs <export-dir>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(process.argv[2]);
const server = http.createServer((req, res) => {
  const file = path.join(root, new URL(req.url, 'http://localhost').pathname);
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root, 'index.html');
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.ttf': 'font/ttf', '.png': 'image/png' })[path.extname(target)] || 'application/octet-stream');
  fs.createReadStream(target).pipe(res);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    for (const isAdmin of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      const user = { id: 'self', name: 'Teste', isAdmin, emailVerified: true, onboardingCompleted: true, latitude: -22.47, longitude: -44.45, sports: ['running'], objectives: [], availability: [] };
      const peer = { ...user, id: 'peer', name: 'Pessoa válida', distance: 1 };
      const errors = [];
      await context.addInitScript(user => {
        localStorage.setItem('@sync:token', 'local-test-token');
        localStorage.setItem('@sync:user', JSON.stringify(user));
      }, user);
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
        let data = [];
        if (url.pathname.endsWith('/users/me')) data = user;
        if (url.pathname.endsWith('/matching/discover')) data = [peer];
        if (url.pathname.endsWith('/matching/new-count') || url.pathname.endsWith('/matching/likes-received/count')) data = { count: 2 };
        if (url.pathname.endsWith('/chat/conversations')) data = [
          { matchId: 'orphan', user: null, unreadCount: 1 },
          { matchId: 'valid', user: peer, unreadCount: 1, lastMessage: { content: 'Mensagem válida', createdAt: '2026-09-22T12:00:00Z' } },
        ];
        if (url.pathname.endsWith('/matching/likes-received')) data = [
          { likeId: 'orphan', user: null },
          { likeId: 'valid', user: { ...peer, sports: 'running' }, createdAt: '2026-09-22T12:00:00Z' },
        ];
        return route.fulfill({ json: data });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.text().includes('[ErrorBoundary]')) errors.push(message.text()); });
      await page.goto(origin);
      await page.getByRole('tab', { name: 'Chat', exact: true }).click();
      try {
        await page.getByText('Mensagem válida', { exact: true }).waitFor({ timeout: 15000 });
      } catch (error) {
        console.error('Render errors:', errors);
        console.error('Global crash fallback:', await page.getByText('Algo deu errado por aqui', { exact: true }).isVisible());
        throw error;
      }
      await page.getByRole('button', { name: 'Buscar conversas', exact: true }).click();
      await page.getByRole('textbox', { name: 'Buscar conversas por nome' }).fill('Pessoa');
      await page.getByText('Mensagem válida', { exact: true }).waitFor();
      await page.getByRole('tab', { name: 'Descobrir', exact: true }).click();
      await page.getByRole('button', { name: 'Ver novos matches' }).click();
      await page.getByText('Mensagem válida', { exact: true }).waitFor();
      await page.getByRole('tab', { name: 'Descobrir', exact: true }).click();
      await page.getByRole('button', { name: 'Ver curtidas recebidas' }).click();
      await page.getByText('1 curtida pendente', { exact: true }).waitFor();
      assert.deepEqual(errors, []);
      console.log(`PASS: chat and likes with incomplete data, isAdmin=${isAdmin}`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
