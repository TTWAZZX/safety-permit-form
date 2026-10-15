'use strict';

(() => {
    const config = window.ADMIN_PORTAL_CONFIG || {};

    function safeAssetUrl(asset) {
        try {
            const url = new URL(String(asset?.public_url || ''));
            return url.protocol === 'https:' ? url.href : '';
        } catch (_error) { return ''; }
    }

    function safeTargetUrl(value) {
        try {
            const url = new URL(String(value || ''), window.location.href);
            if (url.protocol !== 'https:' || (url.origin === window.location.origin && !url.pathname.endsWith('.html'))) return '';
            return url.href;
        } catch (_error) { return ''; }
    }

    function setBrandAsset(url) {
        if (!url) return;
        document.querySelectorAll('.brand-mark').forEach((slot) => {
            const image = document.createElement('img');
            image.className = 'portal-brand-image';
            image.alt = '';
            image.src = url;
            slot.replaceChildren(image);
        });
    }

    function applySettings(settings) {
        if (!settings) return;
        document.querySelectorAll('.sidebar-brand strong, .mobile-brand strong').forEach((node) => { node.textContent = settings.brand_name || 'TSH Safety'; });
        document.querySelectorAll('.sidebar-brand small, .mobile-brand small').forEach((node) => { node.textContent = settings.brand_subtitle || 'Admin Portal'; });
        const eyebrow = document.querySelector('#portalHome .eyebrow');
        const title = document.getElementById('portalTitle');
        const description = document.querySelector('#portalHome .hero-content > p:not(.eyebrow)');
        if (eyebrow) eyebrow.textContent = settings.hero_eyebrow || '';
        if (title) {
            const highlight = document.createElement('span');
            highlight.textContent = settings.hero_highlight || '';
            title.replaceChildren(document.createTextNode(settings.hero_title || ''), document.createElement('br'), highlight);
        }
        if (description) description.textContent = settings.hero_description || '';
        if (/^#[0-9A-F]{6}$/i.test(settings.primary_color || '')) document.documentElement.style.setProperty('--forest', settings.primary_color);
        if (/^#[0-9A-F]{6}$/i.test(settings.accent_color || '')) document.documentElement.style.setProperty('--forest-2', settings.accent_color);
        setBrandAsset(safeAssetUrl(settings.logo_asset));
        const heroUrl = safeAssetUrl(settings.hero_asset);
        if (heroUrl) {
            const image = document.createElement('img');
            image.className = 'portal-hero-image';
            image.alt = '';
            image.src = heroUrl;
            document.getElementById('portalHome')?.prepend(image);
        }
    }

    function applyModule(module) {
        const card = document.querySelector(`[data-module-id="${module.module_key}"]`);
        if (!card) return;
        card.dataset.category = module.category || '';
        card.dataset.search = module.search_terms || '';
        card.dataset.portalEnabled = String(Boolean(module.is_enabled));
        card.hidden = !module.is_enabled;
        const title = card.querySelector('h3');
        const description = card.querySelector(':scope > p, .featured-copy > p');
        const category = card.querySelector('.module-category');
        if (title) title.textContent = module.display_name || module.module_key;
        if (description) description.textContent = module.description || '';
        if (category) category.textContent = module.category || '';
        const link = document.querySelector(`[data-module-link="${module.module_key}"]:not(.shortcut-link)`);
        const href = safeTargetUrl(module.target_url);
        if (link && href) {
            link.href = href;
            const external = module.link_type === 'external' || new URL(href).origin !== window.location.origin;
            if (external) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
            else { link.removeAttribute('target'); link.removeAttribute('rel'); }
        }
        const iconUrl = safeAssetUrl(module.icon_asset);
        const slot = card.querySelector('[data-module-icon-slot]');
        if (slot && iconUrl) {
            const image = document.createElement('img');
            image.className = 'portal-module-icon-image';
            image.alt = module.icon_alt || '';
            image.src = iconUrl;
            slot.replaceChildren(image);
            slot.removeAttribute('aria-hidden');
        }
    }

    function reorderModules(modules) {
        const grid = document.querySelector('.module-grid');
        if (!grid) return;
        modules.filter((module) => module.module_key !== 'safety-case').sort((a, b) => Number(a.sort_order) - Number(b.sort_order)).forEach((module) => {
            const card = grid.querySelector(`[data-module-id="${module.module_key}"]`);
            if (card) grid.append(card);
        });
    }

    function warn(message) {
        const warning = document.createElement('div');
        warning.className = 'portal-content-warning';
        warning.setAttribute('role', 'status');
        warning.textContent = message;
        document.body.append(warning);
        window.setTimeout(() => warning.remove(), 7000);
    }

    async function loadPortalContent() {
        if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/admin-portal-content$/.test(config.contentApiUrl || '')) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), Number(config.requestTimeoutMs) || 8000);
        try {
            const response = await fetch(config.contentApiUrl, { headers: { Accept: 'application/json' }, signal: controller.signal, cache: 'no-store' });
            if (!response.ok) throw new Error(`Content API ${response.status}`);
            const content = await response.json();
            applySettings(content.settings);
            (Array.isArray(content.modules) ? content.modules : []).forEach(applyModule);
            reorderModules(Array.isArray(content.modules) ? content.modules : []);
            window.dispatchEvent(new CustomEvent('portal-content:updated'));
        } catch (error) {
            console.warn('Admin Portal dynamic content is unavailable', error);
            warn('ใช้ข้อมูลสำรองชั่วคราว เนื่องจากโหลดการตั้งค่า Portal ล่าสุดไม่สำเร็จ');
        } finally {
            window.clearTimeout(timer);
        }
    }

    window.addEventListener('DOMContentLoaded', loadPortalContent);
})();
