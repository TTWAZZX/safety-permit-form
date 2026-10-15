const baseUrl = (process.env.PORTAL_BASE_URL || 'https://ttwazzx.github.io/safety-permit-form').replace(/\/$/, '');
const contentApiUrl = process.env.PORTAL_CONTENT_API_URL || 'https://dqsfioiqwxuxpucwwhsv.supabase.co/functions/v1/admin-portal-content';
const allowedOrigin = new URL(baseUrl).origin;
const stamp = Date.now();

async function request(url, options = {}) {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
    return response;
}

async function fetchText(path) {
    const response = await request(`${baseUrl}/${path}?production_smoke=${stamp}`, { headers: { 'cache-control': 'no-cache' } });
    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
    return response.text();
}

const [html, dashboardHtml, css, portalScript, contentScript, managerScript, portalConfig, dashboardConfig] = await Promise.all([
    fetchText('admin-portal.html'), fetchText('safety-dashboard.html'),
    fetchText('admin-portal.css'), fetchText('admin-portal.js'),
    fetchText('admin-portal-content.js'), fetchText('portal-content-manager.js'),
    fetchText('admin-portal-config.js'), fetchText('safety-dashboard-config.js'),
]);

for (const marker of ['PRIMARY WORKSPACE', 'id="moduleSearch"', 'id="portalRuntimeStatus"', 'id="portalFavicon"', 'Content-Security-Policy', 'class="portal-app"']) {
    if (!html.includes(marker)) throw new Error(`Production Admin Portal HTML is missing ${marker}`);
}
if (html.includes('static.line-scdn.net')) throw new Error('Production Admin Portal initializes an unrelated LIFF app');
for (const marker of ['id="portalModuleCreate"', 'id="portalModuleKey"', 'id="portalModuleTargetHint"']) {
    if (!dashboardHtml.includes(marker)) throw new Error(`Production Content Manager HTML is missing ${marker}`);
}
if (!css.includes('env(safe-area-inset-bottom)') || !css.includes('.sidebar-note.is-fallback')) throw new Error('Production CSS hardening is incomplete');
if (!portalScript.includes('MAX_STORED_ITEMS = 8')) throw new Error('Production JavaScript is missing bounded storage hardening');
for (const marker of ['MAX_DYNAMIC_MODULES = 50', 'MODULE_KEY_PATTERN', 'setFavicon', 'restoreFallback', 'createFeaturedCard', 'renderCategoryFilters', "credentials: 'omit'", "referrerPolicy: 'no-referrer'"]) {
    if (!contentScript.includes(marker)) throw new Error(`Production dynamic renderer is missing ${marker}`);
}
for (const marker of ['MAX_IMAGE_BYTES = 5 * 1024 * 1024', 'expected_revision', 'AbortController', 'URL.revokeObjectURL', "action: 'CREATE_MODULE'", 'normalizedTargetUrl']) {
    if (!managerScript.includes(marker)) throw new Error(`Production Content Manager is missing ${marker}`);
}
for (const config of [portalConfig, dashboardConfig]) {
    if (!config.includes('/functions/v1/admin-portal-content') || !config.includes('/storage/v1/object/public/admin-portal-assets/')) {
        throw new Error('Production Portal endpoint or managed asset base is missing');
    }
    if (/service[_-]?role|db[_-]?password|channel[_-]?secret/i.test(config)) throw new Error('Production public config contains a privileged field');
}

const publicResponse = await request(contentApiUrl, { headers: { Origin: allowedOrigin, Accept: 'application/json' } });
if (publicResponse.status !== 200) throw new Error(`Portal Content API returned HTTP ${publicResponse.status}`);
if (publicResponse.headers.get('access-control-allow-origin') !== allowedOrigin) throw new Error('Portal Content API CORS origin is incorrect');
if (!/public/.test(publicResponse.headers.get('cache-control') || '')) throw new Error('Public Portal content is missing bounded public caching');
const content = await publicResponse.json();
if (!content.settings || Number(content.settings.revision) < 1 || !Array.isArray(content.modules)) throw new Error('Portal Content API payload is invalid');
const keys = content.modules.map((module) => module.module_key);
if (keys.length < 1 || new Set(keys).size !== keys.length) throw new Error('Portal Content API module keys are missing or duplicated');

const denied = await request(contentApiUrl, { headers: { Origin: 'https://invalid.example' } });
if (denied.status !== 403) throw new Error(`Disallowed production origin returned HTTP ${denied.status}, expected 403`);
const unauthenticated = await request(contentApiUrl, {
    method: 'POST', headers: { Origin: allowedOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'GET_ADMIN_CONTENT' }),
});
if (unauthenticated.status !== 401) throw new Error(`Unauthenticated admin request returned HTTP ${unauthenticated.status}, expected 401`);

console.log(`PASS Phase 16F Production smoke: ${baseUrl}/admin-portal.html`);
console.log(`PASS Portal Content API revision ${content.settings.revision}, ${content.modules.length} modules, strict CORS, and admin authentication boundary`);
