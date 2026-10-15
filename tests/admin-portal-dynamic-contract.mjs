import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, css, portalScript, contentScript, config] = await Promise.all([
    readFile(new URL('admin-portal.html', root), 'utf8'),
    readFile(new URL('admin-portal.css', root), 'utf8'),
    readFile(new URL('admin-portal.js', root), 'utf8'),
    readFile(new URL('admin-portal-content.js', root), 'utf8'),
    readFile(new URL('admin-portal-config.js', root), 'utf8'),
]);

for (const id of [
    'portalRuntimeStatus', 'portalRuntimeStatusTitle', 'portalRuntimeStatusDetail',
    'portalModuleCountPill', 'featuredModuleName', 'portalCategoryFilters', 'portalModuleGrid',
]) {
    if (!html.includes(`id="${id}"`)) throw new Error(`Dynamic Portal HTML is missing #${id}`);
}
for (const marker of [
    'captureFallbackVisuals', 'safeAssetUrl', 'safeTargetUrl', 'setRuntimeStatus',
    'applySettings', 'createFeaturedCard', 'createModuleCard', 'renderCategoryFilters',
    'renderModules', 'module.is_enabled', 'module.is_featured', 'a.sort_order',
    'validContent', "new CustomEvent('portal-content:updated'", 'AbortController',
    'noopener noreferrer', "linkType === 'internal'", "url.protocol !== 'https:'",
]) {
    if (!contentScript.includes(marker)) throw new Error(`Dynamic Portal loader is missing ${marker}`);
}
for (const marker of [
    "event.target.closest('[data-category-filter]')", "setCategory('all')",
    "window.addEventListener('portal-content:updated'",
]) {
    if (!portalScript.includes(marker)) throw new Error(`Portal runtime integration is missing ${marker}`);
}
if (/\.innerHTML\s*=/.test(contentScript)) throw new Error('Dynamic Portal must not render API content with innerHTML');
if (!config.includes('/functions/v1/admin-portal-content')) throw new Error('Dynamic Portal content endpoint is missing');
if (/service[_-]?role|db[_-]?password|channel[_-]?secret/i.test(config + contentScript)) throw new Error('Dynamic Portal public files contain a privileged field');
for (const marker of ['.sidebar-note.is-loading', '.sidebar-note.is-fallback', '@keyframes portal-card-in']) {
    if (!css.includes(marker)) throw new Error(`Dynamic Portal state styling is missing ${marker}`);
}

console.log('PASS Phase 16E API-driven branding, featured module, module directory, category filters, ordering, visibility, safe links, and fallback contract');
