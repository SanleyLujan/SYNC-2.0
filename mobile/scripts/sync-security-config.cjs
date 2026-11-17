const fs = require('node:fs');
const path = require('node:path');
const { headers, googleHeaders, APP_HEADER_SOURCE } = require('./security-policy.cjs');
for (const relative of ['../../vercel.json', '../vercel.json']) {
  const file = path.resolve(__dirname, relative);
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rule = config.headers.find(h => h.source === '/(.*)' || h.source === APP_HEADER_SOURCE);
  if (!rule) throw new Error(`Missing global headers in ${file}`);
  if (process.argv.includes('--check')) {
    const child = config.headers.find(h => h.source === '/google-signin.html');
    if (rule.source !== APP_HEADER_SOURCE || JSON.stringify(rule.headers) !== JSON.stringify(headers) || JSON.stringify(child?.headers) !== JSON.stringify(googleHeaders)) throw new Error(`Run node mobile/scripts/sync-security-config.cjs: ${file}`);
  } else {
    rule.headers = headers;
    rule.source = APP_HEADER_SOURCE;
    config.headers = config.headers.filter(h => h.source !== '/google-signin.html');
    config.headers.push({ source: '/google-signin.html', headers: googleHeaders });
    fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
  }
}
console.log('Vercel security headers are synchronized.');
