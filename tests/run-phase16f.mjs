import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const checks = [
    ['--check', 'admin-portal.js'],
    ['--check', 'admin-portal-content.js'],
    ['--check', 'portal-content-manager.js'],
    ['--check', 'safety-dashboard.js'],
    ['tests/admin-portal-contract.mjs'],
    ['tests/admin-portal-hardening-contract.mjs'],
    ['tests/admin-portal-fullscreen-contract.mjs'],
    ['tests/admin-portal-dynamic-contract.mjs'],
    ['tests/portal-content-manager-contract.mjs'],
    ['tests/portal-automation-contract.mjs'],
    ['tests/safety-dashboard-contract.mjs'],
];

for (const args of checks) {
    const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`PASS Phase 16F local suite (${checks.length} checks)`);
