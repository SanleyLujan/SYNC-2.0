// Regression check against Expo Web, with all API traffic replaced by local fixtures.
// Start Expo on 8092, then run with Playwright available (or PLAYWRIGHT_MODULE set).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const baseUrl = process.env.SOCIAL_UI_URL || 'http://localhost:8092';
const output = process.env.SOCIAL_UI_OUTPUT || path.join(os.tmpdir(), 'sync-social-ui');
fs.mkdirSync(output, { recursive: true });

const photo = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#29a3b8"/><circle cx="200" cy="130" r="65" fill="#ffd6a5"/><path d="M60 400V320a140 140 0 01280 0v80" fill="#224466"/></svg>');

async function verify(browser, mode) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', permissions: ['geolocation'], geolocation: { latitude: -22.47, longitude: -44.45 } });
  const user = { id: 'test-user', name: 'Pessoa de teste', onboardingCompleted: true, emailVerified: true, themeMode: mode, avatarUrl: photo, profilePhotos: [photo], sports: ['running'], level: 'beginner', objectives: [], availability: [], hobbies: [] };
  const peer = { ...user, id: 'peer', name: 'Atleta de teste', city: 'Resende', level: 'advanced', distance: 1 };
  const post = { id: 'test-post', user_id: peer.id, user: peer, caption: 'Publicação para validar comentários', sport: 'running', distanceKm: 5, likesCount: 0, commentsCount: 0, createdAt: new Date().toISOString() };
  const group = { id: 'test-group', name: 'Grupo de teste', description: 'Treinos em conjunto', sport: 'Corrida', memberCount: 2, totalDistanceKm: 10, totalActivities: 2, city: 'Resende' };
  const comments = [];
  const pageErrors = [];
  let rejectComment = false;
  await context.addInitScript(({ user }) => {
    localStorage.setItem('@sync:token', 'local-test-token');
    localStorage.setItem('@sync:user', JSON.stringify(user));
    localStorage.setItem('@sync:theme-mode', user.themeMode);
    localStorage.setItem('@sync:accessibility', JSON.stringify({ reduceMotion: true, hapticsEnabled: false }));
  }, { user });
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (!url.pathname.startsWith('/api/')) {
      if (url.origin === new URL(baseUrl).origin) return route.continue();
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    const endpoint = url.pathname.slice(4);
    let data = [];
    if (endpoint === '/users/me') data = user;
    if (endpoint === '/users/peer') data = peer;
    if (endpoint === '/follows/peer/status') data = { following: false };
    if (endpoint === '/feed') data = [post];
    if (endpoint === '/feed/test-post/comments') {
      if (req.method() === 'POST') {
        if (rejectComment) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Falha simulada"}' });
        const c = { id: 'saved-comment', user_id: user.id, post_id: post.id, user, text: req.postDataJSON().text, reactions: [], createdAt: new Date().toISOString() };
        comments.push(c); post.commentsCount = comments.length; data = c;
      } else data = comments;
    }
    if (endpoint === '/matching/discover') data = [peer];
    if (endpoint === '/matching/swipe') data = { matched: true, matchId: 'test-match' };
    if (endpoint === '/groups/me') data = [group];
    if (endpoint === '/groups/test-group') data = group;
    if (endpoint === '/groups/test-group/members') data = [{ id: 'member', role: 'member', contributedKm: 10, contributedActivities: 2, user }];
    if (endpoint === '/chat/conversations') data = [{ matchId: 'test-match', user: peer, unreadCount: 1, lastMessage: { content: 'Olá de teste', createdAt: new Date().toISOString() } }];
    if (endpoint === '/chat/test-match/messages') data = { messages: [{ id: 'msg-1', sender_id: peer.id, content: 'Olá de teste', createdAt: new Date().toISOString(), type: 'text' }] };
    if (endpoint === '/gamification/me') data = { level: 1, totalXP: 0, todayXP: 0, dailyCap: 100, nextLevelXP: 500, currentLevelXP: 0, missions: [] };
    if (endpoint === '/challenges/peers') data = [peer];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });

  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', e => pageErrors.push(e.message));
  const tab = name => page.getByRole('tab', { name, exact: true });
  const screenshot = name => page.screenshot({ path: path.join(output, `${mode}-${name}.png`) });
  await page.goto(baseUrl, { timeout: 180000 });
  await page.getByText(post.caption, { exact: true }).waitFor({ timeout: 180000 });
  assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), mode === 'light' ? '#F7F8FB' : '#030914');

  await page.getByRole('button', { name: 'Comentar post de Atleta de teste' }).click();
  const input = page.getByRole('textbox', { name: 'Adicionar comentário' });
  await input.waitFor();
  const inputBox = await input.boundingBox(), tabBox = await tab('Feed').boundingBox();
  assert(inputBox.y + inputBox.height <= tabBox.y, 'Comment input must be above the tab bar');
  await input.fill('Comentário de teste');
  await page.getByRole('button', { name: 'Enviar comentário', exact: true }).click();
  await page.getByText('Comentário de teste', { exact: true }).waitFor();
  assert.equal(comments.length, 1);
  rejectComment = true;
  await input.fill('Rascunho preservado');
  await page.getByRole('button', { name: 'Enviar comentário', exact: true }).click();
  await page.getByText('Falha simulada', { exact: true }).waitFor();
  assert.equal(await input.inputValue(), 'Rascunho preservado');
  await page.getByText('Falha simulada', { exact: true }).waitFor({ state: 'hidden' });
  await screenshot('comments');
  await tab('Feed').click();
  await page.getByText(post.caption, { exact: true }).waitFor();
  const card = page.getByText(post.caption, { exact: true }).locator('..');
  await card.getByText('1', { exact: true }).waitFor();

  await tab('Grupos').click();
  await page.getByText(group.name, { exact: true }).click();
  await page.getByText('Ranking de membros', { exact: true }).waitFor();
  await screenshot('group');
  await tab('Grupos').click();
  await page.getByText('Meus', { exact: true }).waitFor();

  await tab('Descobrir').click();
  await page.getByRole('button', { name: 'Ver perfil completo de Atleta de teste' }).click();
  await page.getByText('Desafiar Atleta', { exact: true }).waitFor();
  await screenshot('profile-photo');
  await page.getByText('Desafiar Atleta', { exact: true }).click();
  await page.getByText('Desafios', { exact: true }).waitFor();
  await screenshot('challenges');
  await page.getByRole('button', { name: 'Criar novo desafio' }).click();
  await page.getByText('Novo desafio ⚡', { exact: true }).waitFor();
  await screenshot('challenge-form');
  await page.getByRole('button', { name: 'Fechar novo desafio' }).click();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.getByText('Editar perfil', { exact: true }).waitFor();
  assert.equal(await tab('Perfil').getAttribute('aria-selected'), 'true');

  await tab('Descobrir').click();
  await page.getByRole('button', { name: 'Curtir Atleta de teste', exact: true }).click();
  await page.getByText('Deu Match!', { exact: true }).waitFor();
  await screenshot('match');
  const primary = page.getByRole('button', { name: 'Enviar mensagem', exact: true });
  assert(await primary.isVisible());
  await primary.click();
  await page.getByPlaceholder('Mensagem...').waitFor();
  await page.getByText('Olá de teste', { exact: true }).last().waitFor();
  assert.equal(await page.getByLabel('Enviar imagem', { exact: true }).count(), 0);
  assert.equal(await page.getByLabel('Segure para gravar áudio', { exact: true }).count(), 0);
  assert(await page.getByRole('button', { name: 'Enviar localização' }).isVisible());
  await screenshot('chat');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await page.getByText('Mensagens', { exact: true }).waitFor();
  await tab('Chat').click();
  await page.getByText('Mensagens', { exact: true }).waitFor();

  // Switching themes in the UI must update browser chrome without a reload.
  await tab('Perfil').click();
  await page.getByText('Configuracoes', { exact: true }).click();
  await page.getByText(mode === 'light' ? 'Modo escuro' : 'Modo claro', { exact: true }).click();
  await page.waitForFunction(expected => document.querySelector('meta[name="theme-color"]').content === expected, mode === 'light' ? '#030914' : '#F7F8FB');
  await tab('Perfil').click();
  await page.getByText('Editar perfil', { exact: true }).waitFor();
  assert.deepEqual(pageErrors, [], 'No JavaScript errors during the tested flows');
  console.log(`${mode}: comments/send/error/tab reset, groups, profile photo, challenges/back, match/chat, live theme switch PASS`);
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  try {
    for (const mode of ['light', 'dark']) await verify(browser, mode);
    console.log(`Screenshots: ${output}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
