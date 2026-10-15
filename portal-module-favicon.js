'use strict';

(() => {
    const CONTENT_API_URL = 'https://dqsfioiqwxuxpucwwhsv.supabase.co/functions/v1/admin-portal-content';
    const ASSET_BASE_URL = 'https://dqsfioiqwxuxpucwwhsv.supabase.co/storage/v1/object/public/admin-portal-assets/';
    const REQUEST_TIMEOUT_MS = 6000;

    function managedFavicon() {
        let link = document.querySelector('link[rel~="icon"]');
        if (link) return link;
        link = document.createElement('link');
        link.rel = 'icon';
        link.href = 'favicon.svg';
        link.type = 'image/svg+xml';
        document.head.append(link);
        return link;
    }

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
        if (!module || module.link_type !== 'internal' || !module.target_url) return false;
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
        const link = managedFavicon();
        link.href = href;
        link.type = ['image/png', 'image/jpeg', 'image/webp'].includes(asset?.mime_type) ? asset.mime_type : 'image/png';
        link.dataset.portalModuleFavicon = 'true';
        return true;
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
            applyFavicon(module.icon_asset || payload?.settings?.logo_asset);
        } catch (_error) {
            // Keep the page's original favicon when the optional content service is unavailable.
        } finally {
            window.clearTimeout(timer);
        }
    }

    syncInternalModuleFavicon();
})();
