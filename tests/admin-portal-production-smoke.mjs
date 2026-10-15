const baseUrl = process.env.PORTAL_BASE_URL || 'https://ttwazzx.github.io/safety-permit-form';
const stamp = Date.now();

async function fetchText(path) {
    const response = await fetch(`${baseUrl}/${path}?production_smoke=${stamp}`, { headers: { 'cache-control': 'no-cache' } });
    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
    return response.text();
}

const [html, css, script] = await Promise.all([
    fetchText('admin-portal.html'), fetchText('admin-portal.css'), fetchText('admin-portal.js'),
]);

for (const marker of ['PRIMARY WORKSPACE', 'id="moduleSearch"', 'Content-Security-Policy']) {
    if (!html.includes(marker)) throw new Error(`Production Admin Portal HTML is missing ${marker}`);
}
if (html.includes('static.line-scdn.net')) throw new Error('Production Admin Portal still initializes an unrelated LIFF app');
if (!css.includes('env(safe-area-inset-bottom)')) throw new Error('Production CSS is missing mobile safe-area support');
if (!script.includes('MAX_STORED_ITEMS = 8')) throw new Error('Production JavaScript is missing bounded storage hardening');

console.log(`PASS Phase 16F Production smoke: ${baseUrl}/admin-portal.html`);
