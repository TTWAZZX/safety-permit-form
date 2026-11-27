'use strict';

const guardHomeScrollKey = 'guard-home-return-scroll';

function rememberGuardHomePosition() {
    try {
        sessionStorage.setItem(guardHomeScrollKey, JSON.stringify({ top: window.scrollY, returning: false }));
    } catch { /* Navigation is still available when storage is blocked. */ }
}

function restoreGuardHomePosition() {
    try {
        const position = JSON.parse(sessionStorage.getItem(guardHomeScrollKey));
        sessionStorage.removeItem(guardHomeScrollKey);
        if (position?.returning && Number.isFinite(position.top)) {
            window.scrollTo(0, position.top);
            return position.top;
        }
    } catch { /* The browser can use its default scroll position. */ }
    return null;
}

function tshGoHome() {
    const home = new URL('./guard-home.html', location.href);
    const referrer = document.referrer ? new URL(document.referrer) : null;
    try {
        const position = JSON.parse(sessionStorage.getItem(guardHomeScrollKey));
        if (history.length > 1 && position && referrer?.origin === home.origin && referrer.pathname === home.pathname) {
            history.back();
            return;
        }
        if (position) {
            position.returning = true;
            sessionStorage.setItem(guardHomeScrollKey, JSON.stringify(position));
        }
    } catch { /* Fall back to the home URL. */ }
    location.replace(home);
}
