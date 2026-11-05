import { readFile } from 'node:fs/promises';

const files = await Promise.all([
  readFile(new URL('../system-monitor.html', import.meta.url), 'utf8'),
  readFile(new URL('../system-monitor.js', import.meta.url), 'utf8'),
  readFile(new URL('../system-monitor-config.js', import.meta.url), 'utf8'),
  readFile(new URL('../admin-portal.html', import.meta.url), 'utf8'),
  readFile(new URL('../safety-dashboard.js', import.meta.url), 'utf8'),
]);
const [html, js, config, portal, dashboard] = files;

for (const tab of ['overview', 'storage', 'retention', 'line', 'richmenu', 'health', 'audit']) {
  if (!html.includes(`data-panel="${tab}"`)) throw new Error(`Missing dashboard panel ${tab}`);
}
for (const behavior of ['RUN_STORAGE_DRY_RUN', 'SET_LEGAL_HOLD', 'IMPORT_LEGACY_RICH_MENUS', 'PUBLISH_RICH_MENU', 'ROLLBACK_RICH_MENU']) {
  if (!js.includes(behavior)) throw new Error(`Missing frontend behavior ${behavior}`);
}
if (!portal.includes('href="system-monitor.html"') || !portal.includes('data-module-id="johnny-control-center"')) {
  throw new Error('Admin Portal entry point missing');
}
if (!js.includes("liffEntry.searchParams.set('target', 'system-monitor')") || !js.includes('window.location.replace(liffEntry.href)')) {
  throw new Error('Control Center must enter LINE authentication through the registered LIFF endpoint');
}
if (!dashboard.includes("get('target') === 'system-monitor'") || !dashboard.includes("new URL('system-monitor.html', window.location.href)")) {
  throw new Error('Safety Dashboard is missing the allowlisted Control Center LIFF bridge');
}
if (js.includes('liff.login({ redirectUri: window.location.href')) {
  throw new Error('Control Center must not request an unregistered LIFF callback URL');
}
for (const secret of ['SERVICE_ROLE', 'CHANNEL_ACCESS_TOKEN', 'cleanup_secret']) {
  if (html.includes(secret) || js.includes(secret) || config.includes(secret)) throw new Error(`Frontend contains forbidden secret marker ${secret}`);
}
if (!config.includes('/functions/v1/johnny-control-center')) throw new Error('Control Center API config missing');
console.log('PASS System Monitor frontend integration contract');
