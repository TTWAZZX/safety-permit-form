import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [dashboardHtml, dashboardScript, managerScript, managerCss, dashboardConfig, portalHtml, portalLoader, portalConfig] = await Promise.all([
    readFile(new URL('safety-dashboard.html', root), 'utf8'),
    readFile(new URL('safety-dashboard.js', root), 'utf8'),
    readFile(new URL('portal-content-manager.js', root), 'utf8'),
    readFile(new URL('portal-content-manager.css', root), 'utf8'),
    readFile(new URL('safety-dashboard-config.js', root), 'utf8'),
    readFile(new URL('admin-portal.html', root), 'utf8'),
    readFile(new URL('admin-portal-content.js', root), 'utf8'),
    readFile(new URL('admin-portal-config.js', root), 'utf8'),
]);

for (const id of [
    'workspaceTabPortal', 'workspacePortal', 'portalSettingsForm', 'portalLivePreview',
    'portalLogoFile', 'portalHeroFile', 'portalModuleList', 'portalModuleForm',
    'portalModuleIconFile', 'portalManagerNotice',
]) {
    if (!dashboardHtml.includes(`id="${id}"`)) throw new Error(`Content Manager HTML is missing #${id}`);
}
for (const marker of [
    "data-dashboard-tab=\"portal\"", "data-dashboard-panel=\"portal\"",
    'portal-content-manager.css', 'portal-content-manager.js',
    'accept="image/jpeg,image/png,image/webp"',
]) {
    if (!dashboardHtml.includes(marker)) throw new Error(`Content Manager HTML is missing ${marker}`);
}
for (const marker of [
    "'GET_ADMIN_CONTENT'", "'UPDATE_SETTINGS'", "'UPDATE_MODULE'", '?action=UPLOAD_ASSET',
    'FormData', 'MAX_IMAGE_BYTES = 5 * 1024 * 1024', 'crypto.randomUUID()',
    'expected_revision', 'AbortController', 'window.liff?.getAccessToken',
    "response.status === 409", "URL.createObjectURL", "URL.revokeObjectURL",
]) {
    if (!managerScript.includes(marker)) throw new Error(`Content Manager logic is missing ${marker}`);
}
if (/\.innerHTML\s*=/.test(managerScript + portalLoader)) throw new Error('Portal content must not render API data with innerHTML');
for (const marker of ["'portal'", 'requestedDashboardView', "new CustomEvent('portal-manager:open')", "new CustomEvent('safety-dashboard:authenticated')"]) {
    if (!dashboardScript.includes(marker)) throw new Error(`Dashboard integration is missing ${marker}`);
}
for (const marker of ['@media(max-width:640px)', '@media(max-width:900px)', ':focus', 'min-height:44px']) {
    if (!managerCss.includes(marker)) throw new Error(`Content Manager responsive/accessibility CSS is missing ${marker}`);
}
for (const config of [dashboardConfig, portalConfig]) {
    if (!config.includes('/functions/v1/admin-portal-content')) throw new Error('Portal content API endpoint is missing');
    if (/service[_-]?role|db[_-]?password|channel[_-]?secret/i.test(config)) throw new Error('Public config contains a privileged field');
}
for (const marker of ['applySettings', 'renderModules', 'safeTargetUrl', 'portal-content:updated', 'AbortController']) {
    if (!portalLoader.includes(marker)) throw new Error(`Public Portal loader is missing ${marker}`);
}
if (!portalHtml.includes('https://liff.line.me/2007053300-FmMHHcD7?view=portal')) throw new Error('Admin Portal Content Manager link is missing');
if (!portalHtml.includes('connect-src \'self\' https://dqsfioiqwxuxpucwwhsv.supabase.co')) throw new Error('Admin Portal CSP does not allow its content API');

console.log('PASS Phase 16D authenticated Content Manager, uploads, live preview, responsive UI, deep link, and public Portal content contract');
