import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, css, script] = await Promise.all([
    readFile(new URL('admin-portal.html', root), 'utf8'),
    readFile(new URL('admin-portal.css', root), 'utf8'),
    readFile(new URL('admin-portal.js', root), 'utf8'),
]);

for (const tag of ['<header', '<main', '<section', '<footer']) {
    if (!html.includes(tag)) throw new Error(`Admin Portal is missing semantic ${tag}>`);
}
for (const id of ['portalContent', 'portalTitle']) {
    if (!html.includes(`id="${id}"`)) throw new Error(`Admin Portal HTML is missing #${id}`);
}
for (const id of [
    'moduleSearch', 'clearModuleSearch', 'moduleResultsStatus', 'personalShortcuts',
    'favoriteBlock', 'favoriteLinks', 'recentBlock', 'recentLinks', 'moduleEmptyState',
]) {
    if (!html.includes(`id="${id}"`)) throw new Error(`Admin Portal HTML is missing #${id}`);
    if (!script.includes(`'${id}'`)) throw new Error(`Admin Portal script does not bind #${id}`);
}
const boundElementIds = [...script.matchAll(/\belement\('([^']+)'\)/g)].map((match) => match[1]);
for (const id of new Set(boundElementIds)) {
    if (!html.includes(`id="${id}"`)) throw new Error(`Admin Portal script binds missing HTML element #${id}`);
}
for (const moduleId of ['safety-case', 'violation', 'safety-spot', 'slipper', 'security-pass', 'gatepass', 'ppe', 'royal-point']) {
    if (!html.includes(`data-module-id="${moduleId}"`)) throw new Error(`Admin Portal is missing module ${moduleId}`);
    if (!html.includes(`data-module-link="${moduleId}"`)) throw new Error(`Admin Portal is missing link for ${moduleId}`);
}
for (const marker of [
    'FAVORITES_KEY', 'RECENTS_KEY', 'MAX_RECENTS = 4', 'applyFilters', 'toggleFavorite',
    'rememberRecent', 'MAX_STORED_ITEMS = 8', 'MAX_MODULE_ID_LENGTH = 64',
    "event.target instanceof Element", "event.key === '/'",
]) {
    if (!script.includes(marker)) throw new Error(`Admin Portal script is missing ${marker}`);
}
for (const marker of [':focus-visible', 'prefers-reduced-motion', '@media (max-width: 640px)', '.featured-card', '.module-grid']) {
    if (!css.includes(marker)) throw new Error(`Admin Portal CSS is missing ${marker}`);
}
if (!html.includes('href="https://liff.line.me/2007053300-FmMHHcD7"')) throw new Error('Safety Case LIFF entry is missing');
if (!html.includes('Content-Security-Policy')) throw new Error('Admin Portal CSP is missing');
if (html.includes('static.line-scdn.net') || html.includes('safety-dashboard-config.js')) throw new Error('Admin Portal must not initialize the Safety Dashboard LIFF app');
if (html.includes('bootstrap@') || html.includes('fonts.googleapis.com')) throw new Error('Admin Portal must not depend on Bootstrap or Google Fonts');

const externalLinks = [...html.matchAll(/<a[^>]+target="_blank"[^>]*>/g)].map((match) => match[0]);
if (!externalLinks.length || externalLinks.some((link) => !link.includes('rel="noopener noreferrer"'))) throw new Error('Every external new-tab link must use noopener noreferrer');

console.log('PASS Phase 16 Admin Portal command center, search, grouping, favorites, recents, responsive, accessibility, and link-security contract');
