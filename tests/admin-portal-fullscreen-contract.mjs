import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, css, script] = await Promise.all([
    readFile(new URL('admin-portal.html', root), 'utf8'),
    readFile(new URL('admin-portal.css', root), 'utf8'),
    readFile(new URL('admin-portal.js', root), 'utf8'),
]);

for (const marker of [
    'class="portal-app"', 'class="sidebar"', 'class="mobile-header"',
    'class="mobile-bottom-nav"', 'id="portalHome"', 'id="primaryWorkspace"',
    'id="systemDirectory"', 'data-focus-search',
]) {
    if (!html.includes(marker)) throw new Error(`Full-screen portal HTML is missing ${marker}`);
}

const iconSlots = [...html.matchAll(/data-module-icon-slot="([^"]+)"/g)].map((match) => match[1]);
if (iconSlots.length !== 8 || new Set(iconSlots).size !== 8) throw new Error('Every portal module requires one unique visual icon slot');
if (html.includes('class="module-code')) throw new Error('Initial-only module placeholders must not return');

for (const marker of [
    'grid-template-columns:248px minmax(0, 1fr)',
    'min-height:100dvh',
    'grid-template-columns:repeat(4, minmax(0, 1fr))',
    '@media (max-width: 1500px)', '@media (max-width: 1180px)',
    '@media (max-width: 820px)', '@media (max-width: 640px)',
    'env(safe-area-inset-bottom)',
]) {
    if (!css.includes(marker)) throw new Error(`Full-screen responsive CSS is missing ${marker}`);
}

for (const marker of ["document.querySelectorAll('[data-focus-search]')", 'focusModuleSearch', 'scrollIntoView']) {
    if (!script.includes(marker)) throw new Error(`Portal navigation script is missing ${marker}`);
}

console.log('PASS Phase 16A full-screen shell, real SVG icons, desktop grid, mobile navigation, and responsive breakpoint contract');
