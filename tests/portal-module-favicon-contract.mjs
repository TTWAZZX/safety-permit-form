import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [script, styles, violation, slipper, securityPass, safetyCase] = await Promise.all([
    readFile(new URL('portal-module-favicon.js', root), 'utf8'),
    readFile(new URL('portal-module-favicon.css', root), 'utf8'),
    readFile(new URL('admin_guard_violation.html', root), 'utf8'),
    readFile(new URL('admin_slipper_permit.html', root), 'utf8'),
    readFile(new URL('guard-admin.html', root), 'utf8'),
    readFile(new URL('safety-dashboard.html', root), 'utf8'),
]);

for (const marker of [
    '/functions/v1/admin-portal-content',
    '/storage/v1/object/public/admin-portal-assets/',
    "module.link_type !== 'internal'",
    'target.origin === window.location.origin',
    'target.pathname === window.location.pathname',
    'module.icon_asset || payload?.settings?.logo_asset',
    'applyModuleLogos(asset, module.display_name)',
    'document.documentElement.dataset.portalModuleKey',
    'addAdminPortalShortcut()',
    "label.textContent = 'กลับ Admin Portal'",
    "document.querySelectorAll('[data-portal-module-logo]')",
    "document.querySelectorAll('link[rel~=\"icon\"]')",
    'document.head.append(link)',
    "credentials: 'omit'",
    "referrerPolicy: 'no-referrer'",
    "cache: 'no-store'",
    'AbortController',
    'url.origin !== base.origin',
    'url.pathname.startsWith(base.pathname)',
]) {
    if (!script.includes(marker)) throw new Error(`Internal module favicon loader is missing ${marker}`);
}

for (const [name, html] of Object.entries({ violation, slipper, securityPass })) {
    if (!html.includes('src="portal-module-favicon.js"')) throw new Error(`${name} does not load the internal favicon manager`);
    if (!html.includes('rel="icon" href="favicon.svg"')) throw new Error(`${name} does not retain a local favicon fallback`);
    if (!html.includes('href="portal-module-favicon.css"')) throw new Error(`${name} does not load shared favicon and shortcut styles`);
    const logoSlots = html.match(/data-portal-module-logo/g) || [];
    if (logoSlots.length < 2) throw new Error(`${name} must expose login and application logo slots`);
}

if (!safetyCase.includes('data-portal-module-key="safety-case"') || !safetyCase.includes('src="portal-module-favicon.js"') || !safetyCase.includes('data-portal-module-logo')) {
    throw new Error('Safety Case must explicitly bind its LIFF-backed module icon to its local dashboard page');
}
for (const marker of ['.portal-admin-shortcut', 'env(safe-area-inset-bottom)', '@media(max-width:640px)', '@media print']) {
    if (!styles.includes(marker)) throw new Error(`Shared internal navigation styles are missing ${marker}`);
}

for (const externalPage of ['admin-portal.html']) {
    const html = await readFile(new URL(externalPage, root), 'utf8');
    if (html.includes('src="portal-module-favicon.js"')) throw new Error(`${externalPage} must keep its existing global favicon behavior`);
}

console.log('PASS internal Portal modules use their managed icon with Portal logo and local favicon fallbacks');
