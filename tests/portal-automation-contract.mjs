import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [quality, production, smoke] = await Promise.all([
    readFile(new URL('.github/workflows/portal-quality.yml', root), 'utf8'),
    readFile(new URL('.github/workflows/portal-production-smoke.yml', root), 'utf8'),
    readFile(new URL('tests/admin-portal-production-smoke.mjs', root), 'utf8'),
]);

for (const [name, workflow] of [['quality', quality], ['production smoke', production]]) {
    const normalized = workflow.replaceAll('\r\n', '\n');
    if (!normalized.includes('permissions:\n  contents: read')) throw new Error(`${name} workflow must use read-only repository permissions`);
    if (!normalized.includes('timeout-minutes: 5')) throw new Error(`${name} workflow must have a bounded timeout`);
    if (!normalized.includes('actions/checkout@v4') || !normalized.includes('actions/setup-node@v4')) throw new Error(`${name} workflow is missing pinned major actions`);
}

if (!quality.includes('node tests/run-phase16f.mjs')) throw new Error('Quality workflow must run the complete Phase 16F suite');
if (!production.includes("cron: '17 */6 * * *'")) throw new Error('Production smoke must run every six hours');
if (!production.includes('node tests/admin-portal-production-smoke.mjs')) throw new Error('Production workflow must run the Portal smoke test');

for (const marker of [
    'AbortSignal.timeout',
    'denied.status !== 403',
    'unauthenticated.status !== 401',
    'access-control-allow-origin',
    'cache-control',
]) {
    if (!smoke.includes(marker)) throw new Error(`Production smoke is missing boundary assertion: ${marker}`);
}

console.log('PASS Phase 16F CI permissions, timeouts, cadence, and production API boundary contract');
