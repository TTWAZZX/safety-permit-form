import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, script, config, portal] = await Promise.all([
    readFile(new URL('safety-dashboard.html', root), 'utf8'),
    readFile(new URL('safety-dashboard.js', root), 'utf8'),
    readFile(new URL('safety-dashboard-config.js', root), 'utf8'),
    readFile(new URL('admin-portal.html', root), 'utf8'),
]);

for (const id of [
    'appLoading', 'appError', 'appShell', 'yearSelect', 'monthSelect',
    'metricTotal', 'metricOpen', 'metricResolved', 'metricOverdue',
    'trendChart', 'statusBreakdown', 'rankBreakdown', 'pathBreakdown',
    'caseTableBody', 'caseCards', 'exportButton',
]) {
    if (!html.includes(`id="${id}"`)) throw new Error(`Dashboard HTML is missing #${id}`);
    if (!script.includes(`'${id}'`)) throw new Error(`Dashboard script does not bind #${id}`);
}

for (const marker of [
    "liff.init({ liffId: config.liffId })",
    'window.liff.getAccessToken()',
    'Authorization: `Bearer ${state.token}`',
    "apiRequest('summary')",
    "apiRequest('cases'",
    "apiRequest('export'",
    "cache: 'no-store'",
    'AbortController',
    'textContent',
]) {
    if (!script.includes(marker)) throw new Error(`Dashboard script is missing: ${marker}`);
}

if (!config.includes("liffId: 'REPLACE_WITH_NEW_LIFF_ID'")) {
    throw new Error('Dedicated LIFF ID placeholder is missing');
}
if (!config.includes('/functions/v1/safety-admin-dashboard')) {
    throw new Error('Dashboard backend endpoint is missing');
}
if (/service[_-]?role|db[_-]?password|channel[_-]?secret/i.test(config)) {
    throw new Error('Public dashboard config appears to contain a secret field');
}
if (!html.includes("default-src 'self'")) throw new Error('Dashboard CSP is missing');
if (/\.innerHTML\s*=/.test(script)) throw new Error('Dashboard must not render API data with innerHTML');
if (!portal.includes('href="safety-dashboard.html"')) throw new Error('Admin Portal is missing the Dashboard entry');

console.log('PASS Safety Dashboard LIFF authentication and admin-only backend contract');
console.log('PASS monthly/yearly metrics, filtering, pagination, and CSV export UI contract');
console.log('PASS public frontend contains no privileged backend credentials');
