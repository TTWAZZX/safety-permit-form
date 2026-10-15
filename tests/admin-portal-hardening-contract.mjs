import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, css, script, contentScript, contentConfig, managerScript, dashboardConfig] = await Promise.all([
    readFile(new URL('admin-portal.html', root), 'utf8'),
    readFile(new URL('admin-portal.css', root), 'utf8'),
    readFile(new URL('admin-portal.js', root), 'utf8'),
    readFile(new URL('admin-portal-content.js', root), 'utf8'),
    readFile(new URL('admin-portal-config.js', root), 'utf8'),
    readFile(new URL('portal-content-manager.js', root), 'utf8'),
    readFile(new URL('safety-dashboard-config.js', root), 'utf8'),
]);

const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] || '';
for (const directive of [
    "default-src 'self'", "script-src 'self'", "connect-src 'self'", "object-src 'none'",
    "frame-src 'none'", "worker-src 'none'", "base-uri 'none'", "form-action 'none'",
]) {
    if (!csp.includes(directive)) throw new Error(`Admin Portal CSP is missing: ${directive}`);
}
if (/<script(?![^>]+src=)/i.test(html)) throw new Error('Admin Portal must not contain inline scripts');
if (/\son[a-z]+\s*=/i.test(html)) throw new Error('Admin Portal must not contain inline event handlers');
if (/https?:\/\/[^"]*(?:service_role|apikey|secret)/i.test(html + script)) throw new Error('Possible privileged credential in public frontend');
const publicFrontend = [html, script, contentScript, contentConfig, managerScript, dashboardConfig].join('\n');
if (/service[_-]?role|db[_-]?password|channel[_-]?secret/i.test(publicFrontend)) throw new Error('Possible privileged credential in public frontend');
if (/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/.test(publicFrontend)) throw new Error('Possible JWT embedded in public frontend');
if (/script-src[^;]*(?:'unsafe-inline'|'unsafe-eval')/.test(csp)) throw new Error('Admin Portal script CSP must not allow unsafe inline/eval execution');
if (script.includes('CSS.escape(')) throw new Error('Portal must not depend on CSS.escape for stored module IDs');

const moduleIds = [...html.matchAll(/data-module-id="([^"]+)"/g)].map((match) => match[1]);
if (moduleIds.length !== 8 || new Set(moduleIds).size !== moduleIds.length) throw new Error('Portal requires eight unique module IDs');
for (const href of [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((match) => match[1])) {
    if (!href.startsWith('https://')) throw new Error(`External link must use HTTPS: ${href}`);
}
for (const internalHref of [...html.matchAll(/href="([^"#:]+\.html)"/g)].map((match) => match[1])) {
    try { await readFile(new URL(internalHref, root), 'utf8'); } catch { throw new Error(`Missing internal portal target: ${internalHref}`); }
}
for (const marker of ['overflow-x: clip', 'overflow-wrap: anywhere', 'env(safe-area-inset-bottom)', 'min-height: 44px']) {
    if (!css.includes(marker)) throw new Error(`Responsive hardening is missing: ${marker}`);
}

console.log('PASS Phase 16F Admin Portal CSP, storage bounds, internal targets, HTTPS links, mobile overflow, safe area, and touch-target hardening contract');
