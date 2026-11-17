// Copia arquivos estáticos da pasta public/ para dist/ após o build do Expo.
// Também corrige o index.html gerado pelo Expo para incluir as tags PWA
// (manifest, meta theme-color, Apple Web App, favicon e title correto).
// Cross-platform (não usa cp/shell), funciona em Vercel (Linux) e Windows local.
const fs = require('fs');
const path = require('path');
const { createHash } = require('node:crypto');

const src = path.resolve(__dirname, '..', 'public');
const dst = path.resolve(__dirname, '..', 'dist');

function copyRecursive(from, to) {
  if (!fs.existsSync(from)) return;
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
      copyRecursive(path.join(from, entry), path.join(to, entry));
    }
  } else {
    fs.copyFileSync(from, to);
    console.log('[postbuild] copied', path.relative(process.cwd(), to));
  }
}

// ─── Inject PWA meta tags into index.html ───────────────────────────────────
function patchIndexHtml() {
  const indexPath = path.join(dst, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error('index.html not found; refusing an unpatched deployment');
  }

  let html = fs.readFileSync(indexPath, 'utf8');

  // Tags to inject (only if not already present)
  const pwaTags = `
    <!-- PWA: manifest & icons injected by postbuild.js -->
    <link rel="manifest" href="/manifest.json?v=20260914" />
    <meta name="theme-color" content="#030914" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Sync" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=20260906" />
    <link rel="icon" type="image/png" sizes="512x512" href="/favicon.png?v=20260906" />
    <link rel="shortcut icon" href="/favicon.png?v=20260906" />`;

  // Only inject once
  if (!html.includes('rel="manifest"')) {
    html = html.replace('</head>', pwaTags + '\n  </head>');
    console.log('[postbuild] injected PWA meta tags into index.html');
  }

  // O Expo também pode gerar essa tag; mantenha uma única cor inicial.
  html = html.replace(/<meta\b(?=[^>]*\bname=["']theme-color["'])[^>]*>/gi, '');
  html = html.replace('</head>', '<meta name="theme-color" content="#030914" />\n  </head>');

  // Fix the title — always "Sync", never screen-level names like "Welcome"
  html = html.replace(/<title>[^<]*<\/title>/, '<title>Sync</title>');
  console.log('[postbuild] set <title>Sync</title>');

  // Static Expo deployment: external files avoid a shared/fixed CSP nonce.
  const assetDir = path.join(dst, 'assets', 'csp');
  const externalize = (text, extension) => {
    fs.mkdirSync(assetDir, { recursive: true });
    const digest = createHash('sha256').update(text).digest('hex');
    const name = `${digest}.${extension}`;
    fs.writeFileSync(path.join(assetDir, name), text, 'utf8');
    return `/assets/csp/${name}`;
  };
  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (tag, attributes, text) => {
    if (/\bsrc\s*=/i.test(attributes)) return tag;
    // Inert data blocks must retain their text for JSON consumers.
    if (/\btype\s*=\s*["']application\/(?:ld\+)?json["']/i.test(attributes)) return tag;
    if (!text.trim()) return tag;
    return `<script${attributes} src="${externalize(text, 'js')}"></script>`;
  });
  html = html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi,
    (_, attributes, text) => `<link${attributes} rel="stylesheet" href="${externalize(text, 'css')}" />`);
  if (/\son\w+\s*=|\sstyle\s*=|(?:href|src)\s*=\s*["']\s*javascript:/i.test(html)) {
    throw new Error('Inline handlers/styles or javascript: URLs are incompatible with the CSP');
  }
  fs.writeFileSync(indexPath, html, 'utf8');
}

// ── main ─────────────────────────────────────────────────────────────────────
try {
  copyRecursive(src, dst);
  patchIndexHtml();
  console.log('[postbuild] done');
} catch (e) {
  console.error('[postbuild] error:', e.message);
  process.exitCode = 1;
}
