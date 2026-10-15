'use strict';

(() => {
    const CONTENT_API_URL = 'https://dqsfioiqwxuxpucwwhsv.supabase.co/functions/v1/admin-portal-content';
    const ASSET_BASE_URL = 'https://dqsfioiqwxuxpucwwhsv.supabase.co/storage/v1/object/public/admin-portal-assets/';
    const REQUEST_TIMEOUT_MS = 6000;

    function safeAssetUrl(asset) {
        try {
            const url = new URL(String(asset?.public_url || ''));
            const base = new URL(ASSET_BASE_URL);
            if (url.protocol !== 'https:' || url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || url.username || url.password) return '';
            if (asset?.id) url.searchParams.set('v', String(asset.id));
            return url.href;
        } catch (_error) {
            return '';
        }
    }

    function isCurrentInternalModule(module) {
        if (!module) return false;
        const declaredKey = document.documentElement.dataset.portalModuleKey;
        if (declaredKey) return module.module_key === declaredKey;
        if (module.link_type !== 'internal' || !module.target_url) return false;
        try {
            const pageDirectory = new URL('.', window.location.href);
            const target = new URL(String(module.target_url), pageDirectory);
            return target.origin === window.location.origin && target.pathname === window.location.pathname;
        } catch (_error) {
            return false;
        }
    }

    function applyFavicon(asset) {
        const href = safeAssetUrl(asset);
        if (!href) return false;
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = ['image/png', 'image/jpeg', 'image/webp'].includes(asset?.mime_type) ? asset.mime_type : 'image/png';
        link.href = href;
        link.dataset.portalModuleFavicon = 'true';
        document.querySelectorAll('link[rel~="icon"]').forEach((current) => current.remove());
        document.head.append(link);
        return true;
    }

    function applyModuleLogos(asset, displayName) {
        const href = safeAssetUrl(asset);
        if (!href) return false;
        const targets = document.querySelectorAll('[data-portal-module-logo]');
        targets.forEach((target) => {
            if (target instanceof HTMLImageElement) {
                target.src = href;
                target.alt = displayName ? `โลโก้ ${displayName}` : 'โลโก้ระบบ';
                target.referrerPolicy = 'no-referrer';
                target.classList.add('portal-managed-module-logo');
                return;
            }
            const image = document.createElement('img');
            image.src = href;
            image.alt = displayName ? `โลโก้ ${displayName}` : 'โลโก้ระบบ';
            image.referrerPolicy = 'no-referrer';
            image.decoding = 'async';
            image.className = 'portal-managed-module-logo';
            target.replaceChildren(image);
        });
        return targets.length > 0;
    }

    function addAdminPortalShortcut() {
        if (document.querySelector('[data-admin-portal-shortcut]')) return;
        const link = document.createElement('a');
        link.className = 'portal-admin-shortcut';
        link.dataset.adminPortalShortcut = 'true';
        link.href = new URL('admin-portal.html', new URL('.', window.location.href)).href;
        link.setAttribute('aria-label', 'กลับหน้า Admin Portal');
        const icon = document.createElement('span');
        icon.className = 'portal-admin-shortcut__icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '⌂';
        const label = document.createElement('span');
        label.textContent = 'กลับ Admin Portal';
        link.append(icon, label);
        document.body.append(link);
    }

    async function syncInternalModuleFavicon() {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(CONTENT_API_URL, {
                headers: { Accept: 'application/json' },
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
                cache: 'no-store',
                signal: controller.signal,
            });
            if (!response.ok) return;
            const payload = await response.json();
            const modules = Array.isArray(payload?.modules) ? payload.modules : [];
            const module = modules.find(isCurrentInternalModule);
            if (!module) return;
            const asset = module.icon_asset || payload?.settings?.logo_asset;
            applyFavicon(asset);
            applyModuleLogos(asset, module.display_name);
        } catch (_error) {
            // Keep the page's original favicon when the optional content service is unavailable.
        } finally {
            window.clearTimeout(timer);
        }
    }

    addAdminPortalShortcut();
    syncInternalModuleFavicon();
})();
