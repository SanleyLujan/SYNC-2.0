// Regression check against Expo Web, with all API traffic replaced by local fixtures.
// Export the app first; set WEB_BUILD_DIR and PLAYWRIGHT_MODULE if needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const baseUrl = process.env.SOCIAL_UI_URL || 'http://127.0.0.1:8096';
const output = process.env.SOCIAL_UI_OUTPUT || path.join(os.tmpdir(), 'sync-profile-layout-qa');
fs.mkdirSync(output, { recursive: true });

const photo = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#29a3b8"/><circle cx="200" cy="130" r="65" fill="#ffd6a5"/><path d="M60 400V320a140 140 0 01280 0v80" fill="#224466"/></svg>');

async function verify(browser, mode, width, height = 844, scenario = {}) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600, serviceWorkers: 'block', permissions: ['geolocation'], geolocation: { latitude: -22.47, longitude: -44.45 } });
  const user = { id: 'test-user', name: 'Pessoa de teste', onboardingCompleted: true, emailVerified: true, latitude: -22.47, longitude: -44.45, themeMode: mode, avatarUrl: photo, profilePhotos: [photo], sports: ['running'], level: 'beginner', objectives: [], availability: [], hobbies: [] };
  const peer = { ...user, avatarUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="green"/></svg>'), id: 'peer', name: 'Atleta de teste', city: 'Resende', level: 'advanced', distance: 1 };
  peer.profilePhotos = [photo, peer.avatarUrl];
  if (scenario.brokenPhoto) peer.profilePhotos[0] = baseUrl + '/broken-photo.jpg';
  let profileFailures = scenario.profileFailures || 0;
  let swipeFailures = scenario.swipeFailures || 0;
  const post = { id: 'test-post', user_id: peer.id, user: peer, caption: 'Publicação para validar comentários', sport: 'running', distanceKm: 5, likesCount: 0, commentsCount: 0, createdAt: new Date().toISOString() };
  const group = { id: 'test-group', name: 'Grupo de teste', description: 'Treinos em conjunto', sport: 'Corrida', memberCount: 2, totalDistanceKm: 10, totalActivities: 2, city: 'Resende' };
  let likes = [
    {likeId:'like-one',createdAt:'2026-09-13T12:00:00Z',isSuperLike:true,user:{...peer,name:'Bianca Azevedo',sports:['walking']}},
    {likeId:'like-two',createdAt:'2026-09-09T12:00:00Z',isSuperLike:false,user:{...peer,id:'peer-two',name:'Vinícius da Silva',avatarUrl:null,sports:['walking','running','cycling'],bio:'Bora combinar o próximo treino?'}}
  ];
  const swipes = [];
  const comments = [];
  const pageErrors = [];
  let rejectComment = false;
  await context.addInitScript(({ user }) => {
    window.__securityViolations = [];
    document.addEventListener('securitypolicyviolation', e => {
      window.__securityViolations.push({ directive: e.effectiveDirective, blocked: e.blockedURI });
    });
    localStorage.setItem('@sync:token', 'local-test-token');
    localStorage.setItem('@sync:user', JSON.stringify(user));
    localStorage.setItem('@sync:theme-mode', user.themeMode);
    localStorage.setItem('@sync:accessibility', JSON.stringify({ reduceMotion: true, hapticsEnabled: false }));
  }, { user });
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (!url.pathname.startsWith('/api/')) {
      if (url.pathname === '/broken-photo.jpg') return route.fulfill({ status: 404, body: '' });
      if (url.hostname === 'api.open-meteo.com') return route.fulfill({json: {current: {temperature_2m: 21, apparent_temperature: 21, relative_humidity_2m: 65, wind_speed_10m: 5, weather_code: 3, is_day: 1, uv_index: 2, precipitation: 0}}});
      if (url.hostname === 'nominatim.openstreetmap.org') return route.fulfill({json: {address: {suburb: 'Nova Liberdade', city: 'Resende'}}});
      if (url.origin === new URL(baseUrl).origin) return route.continue();
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    const endpoint = url.pathname.slice(4);
    let data = [];
    if (endpoint === '/users/me') data = user;
    if (endpoint === '/users/peer') {
      if (profileFailures-- > 0) return route.fulfill({ status: 404, json: { message: 'Perfil indisponível' } });
      data = peer;
    }
    if (endpoint === '/follows/peer/status') data = { isFollowing: false };
    if (endpoint === '/feed') data = [post];
    if (endpoint === '/feed/test-post/comments') {
      if (req.method() === 'POST') {
        if (rejectComment) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Falha simulada"}' });
        const c = { id: 'saved-comment', user_id: user.id, post_id: post.id, user, text: req.postDataJSON().text, reactions: [], createdAt: new Date().toISOString() };
        comments.push(c); post.commentsCount = comments.length; data = c;
      } else data = comments;
    }
    if (endpoint === '/matching/new-count' || endpoint === '/matching/likes-received/count') data = {count: 2};
    if (endpoint === '/matching/discover') data = [peer];
    if (endpoint === '/matching/likes-received') data = likes;
    if (endpoint === '/matching/swipe') {
      const body = req.postDataJSON(); swipes.push(body);
      if (swipeFailures-- > 0) return route.fulfill({ status: 503, json: { message: 'Temporary failure' } });
      likes = likes.filter(l => l.user.id !== body.targetUserId); data = {matched:false};
    }
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


  await tab('Descobrir').click();
  await page.getByText('Atleta de teste', {exact:true}).last().waitFor();
  assert.equal(await page.getByRole('button',{name:/Super like/}).count(), 0);
  const verifyBounds = async () => {
    await page.waitForTimeout(350);
    const bounds = await page.getByText('Atleta de teste',{exact:true}).last().boundingBox();
    assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= (await page.viewportSize()).width);
    if (!scenario.brokenPhoto) {
      const matchingPhotos = await page.locator('img').evaluateAll((nodes, src) => nodes.filter(n=>n.src===src).map(n=>({width:n.getBoundingClientRect().width,x:n.getBoundingClientRect().x})), photo);
      assert(matchingPhotos.some(p=>p.width>200 && p.width<=440));
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  };
  await verifyBounds();
  await page.screenshot({path:path.join(output, mode+'-'+width+'x'+height+'-discovery.png')});
  if(width>1000){
    await page.setViewportSize({width:390,height:844});
    await verifyBounds();
    await page.setViewportSize({width,height});
    await verifyBounds();
  }
  await page.getByRole('button',{name:'Ver perfil completo de Atleta de teste',exact:true}).click();
  const hero=page.getByRole('img',{name:'Foto de Atleta de teste',exact:true}).last();
  if (scenario.profileFailures) {
    await page.getByText('Não foi possível carregar o perfil.', { exact: true }).waitFor();
    assert.equal(await hero.count(), 0, 'An unavailable profile must not show a stale hero');
    profileFailures = 0;
    await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  }
  await page.getByText('Fotos do perfil',{exact:true}).waitFor();
  await hero.waitFor();
  const expectedHero = scenario.brokenPhoto ? peer.avatarUrl : photo;
  let heroSource = '';
  const photoDeadline = Date.now() + 10000;
  while (!heroSource.includes(expectedHero) && Date.now() < photoDeadline) {
    heroSource = await hero.evaluate(el => el.tagName === 'IMG' ? el.src : el.querySelector('img')?.src || el.style.backgroundImage || '');
    if (!heroSource.includes(expectedHero)) await page.waitForTimeout(100);
  }
  assert(heroSource.includes(expectedHero), 'Profile hero must use the first photo or the fallback after an image error');
  await page.getByRole('button', { name: 'Abrir foto 2 de 2', exact: true }).click();
  await page.getByText('Foto 2 de 2', { exact: true }).waitFor();
  await page.getByText('Anterior', { exact: true }).click();
  await page.getByText('Foto 1 de 2', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.screenshot({path:path.join(output, mode+'-'+width+'x'+height+'-profile.png')});
  await tab('Descobrir').click();
  await page.getByRole('button',{name:(scenario.pass ? 'Passar' : 'Curtir') + ' Atleta de teste',exact:true}).click();
  const expectedAttempts = 1 + (scenario.swipeFailures || 0);
  const deadline = Date.now() + 10000;
  while (swipes.length < expectedAttempts && Date.now() < deadline) await page.waitForTimeout(100);
  assert.equal(swipes.length, expectedAttempts, 'A failed decision should be retried');
  for (const swipe of swipes) {
    assert.equal(swipe.isLike, !scenario.pass);
    assert.equal(swipe.targetUserId, peer.id);
    assert.equal('isSuperLike' in swipe,false);
  }
  assert.deepEqual(pageErrors,[]);
  if (process.env.SECURITY_CSP === '1') {
    assert.deepEqual(await page.evaluate(() => window.__securityViolations), [],
      JSON.stringify(await page.locator('style').evaluateAll(nodes => nodes.map(n => ({ id: n.id, text: n.textContent.slice(0, 200) })))));
  }
  console.log(mode,width,height,JSON.stringify(scenario),'gallery navigation, hero, layout, resize, no super like and decision PASS');
  await context.close();
}
const http = require('node:http');
const root = process.env.WEB_BUILD_DIR || path.resolve(__dirname, '../dist');
const server = http.createServer((req,res) => {
 if (process.env.SECURITY_CSP === '1') {
   for (const {key,value} of require('./security-policy.cjs').headersForPath(new URL(req.url,'http://localhost').pathname)) res.setHeader(key,value);
 }
 const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
 const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root,'index.html');
 const types = {'.html':'text/html','.js':'application/javascript','.png':'image/png','.ttf':'font/ttf','.css':'text/css'};
 res.setHeader('Content-Type',types[path.extname(target)] || 'application/octet-stream'); fs.createReadStream(target).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(8096,'127.0.0.1',r));
 const browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || undefined});
 try {
   for (const mode of ['light','dark']) for (const [width,height] of [[1440,900],[1366,650],[390,844],[320,568]]) await verify(browser,mode,width,height);
   for (const scenario of [{ brokenPhoto: true }, { profileFailures: 10 }, { pass: true, swipeFailures: 2 }]) await verify(browser,'light',1366,650,scenario);
 }
 finally {await browser.close(); server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
