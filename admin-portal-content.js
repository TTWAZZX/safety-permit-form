'use strict';

(() => {
    const config = window.ADMIN_PORTAL_CONFIG || {};
    const CATEGORY_LABELS = Object.freeze({
        safety: 'งานความปลอดภัย',
        inspection: 'ตรวจสอบและตรวจประเมิน',
        incident: 'แจ้งเหตุและติดตามเคส',
        access: 'สิทธิ์ บุคคล และผู้รับเหมา',
        training: 'อบรมและองค์ความรู้',
        resource: 'ทรัพยากรและอุปกรณ์',
        analytics: 'รายงานและแดชบอร์ด',
        administration: 'บริหารระบบ',
    });
    const MODULE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const MAX_DYNAMIC_MODULES = 50;
    const cardStyles = new Map();
    const fallbackIcons = new Map();
    const fallbackBrands = [];

    function captureFallbackVisuals() {
        document.querySelectorAll('[data-module-card]').forEach((card) => {
            const key = String(card.dataset.moduleId || '');
            const svg = card.querySelector('[data-module-icon-slot] svg');
            const style = [...card.classList].find((name) => name.startsWith('card-')) || '';
            if (key && svg) fallbackIcons.set(key, svg.cloneNode(true));
            if (key && style) cardStyles.set(key, style);
        });
        document.querySelectorAll('.brand-mark').forEach((slot) => fallbackBrands.push({ slot, nodes: [...slot.childNodes].map((node) => node.cloneNode(true)) }));
    }

    function safeAssetUrl(asset) {
        try {
            const url = new URL(String(asset?.public_url || ''));
            const base = new URL(String(config.assetBaseUrl || ''));
            return url.protocol === 'https:'
                && url.origin === base.origin
                && url.pathname.startsWith(base.pathname)
                && !url.username
                && !url.password
                ? url.href
                : '';
        } catch (_error) { return ''; }
    }

    function safeTargetUrl(value, linkType) {
        try {
            const raw = String(value || '').trim();
            if (!raw || raw.length > 800) return '';
            if (linkType === 'internal' && !/^[A-Za-z0-9][A-Za-z0-9._/-]*\.html(?:[?#][^\s]*)?$/.test(raw)) return '';
            const url = new URL(raw, window.location.href);
            if (url.protocol !== 'https:') return '';
            if (url.username || url.password) return '';
            if (linkType === 'internal' && url.origin !== window.location.origin) return '';
            return url.href;
        } catch (_error) { return ''; }
    }

    function setRuntimeStatus(mode, title, detail) {
        const status = document.getElementById('portalRuntimeStatus');
        status?.classList.toggle('is-loading', mode === 'loading');
        status?.classList.toggle('is-fallback', mode === 'fallback');
        const titleNode = document.getElementById('portalRuntimeStatusTitle');
        const detailNode = document.getElementById('portalRuntimeStatusDetail');
        if (titleNode) titleNode.textContent = title;
        if (detailNode) detailNode.textContent = detail;
    }

    function restoreBrand(slot) {
        const fallback = fallbackBrands.find((item) => item.slot === slot);
        if (fallback) slot.replaceChildren(...fallback.nodes.map((node) => node.cloneNode(true)));
    }

    function setBrandAsset(url) {
        if (!url) return;
        document.querySelectorAll('.brand-mark').forEach((slot) => {
            const image = document.createElement('img');
            image.className = 'portal-brand-image';
            image.alt = '';
            image.decoding = 'async';
            image.referrerPolicy = 'no-referrer';
            image.onload = () => slot.replaceChildren(image);
            image.onerror = () => restoreBrand(slot);
            image.src = url;
        });
    }

    function setFavicon(url, mimeType) {
        const favicon = document.getElementById('portalFavicon');
        if (!favicon) return;
        const restoreFallback = () => {
            favicon.href = favicon.dataset.fallbackHref || 'favicon.svg';
            favicon.type = favicon.dataset.fallbackType || 'image/svg+xml';
        };
        if (!url) {
            restoreFallback();
            return;
        }
        const image = new Image();
        image.referrerPolicy = 'no-referrer';
        image.onload = () => {
            if (/^(?:image\/png|image\/jpeg|image\/webp)$/i.test(String(mimeType || ''))) favicon.type = String(mimeType).toLowerCase();
            else favicon.removeAttribute('type');
            favicon.href = url;
        };
        image.onerror = restoreFallback;
        image.src = url;
    }

    function applySettings(settings) {
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
        document.title = `${settings.brand_name || 'TSH Safety'} ${settings.brand_subtitle || 'Admin Portal'}`;
        const logoUrl = safeAssetUrl(settings.logo_asset);
        setBrandAsset(logoUrl);
        setFavicon(logoUrl, settings.logo_asset?.mime_type);
        const heroUrl = safeAssetUrl(settings.hero_asset);
        if (heroUrl) {
            const image = document.createElement('img');
            image.className = 'portal-hero-image';
            image.alt = '';
            image.decoding = 'async';
            image.referrerPolicy = 'no-referrer';
            image.onerror = () => image.remove();
            image.src = heroUrl;
            document.querySelector('#portalHome > .portal-hero-image')?.remove();
            document.getElementById('portalHome')?.prepend(image);
        }
    }

    function appendIconVisual(slot, module) {
        const iconUrl = safeAssetUrl(module.icon_asset);
        const fallback = fallbackIcons.get(module.module_key)?.cloneNode(true);
        if (!iconUrl) {
            if (fallback) slot.append(fallback);
            else slot.textContent = String(module.display_name || module.module_key).slice(0, 2).toUpperCase();
            return;
        }
        const image = document.createElement('img');
        image.className = 'portal-module-icon-image';
        image.alt = module.icon_alt || '';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.referrerPolicy = 'no-referrer';
        image.onerror = () => {
            image.remove();
            if (fallback) slot.append(fallback);
            else slot.textContent = String(module.display_name || module.module_key).slice(0, 2).toUpperCase();
        };
        image.src = iconUrl;
        slot.append(image);
    }

    function createIcon(module, featured = false) {
        const icon = document.createElement('div');
        icon.className = featured ? 'featured-icon module-icon' : 'module-icon';
        icon.dataset.moduleIconSlot = module.module_key;
        appendIconVisual(icon, module);
        return icon;
    }

    function createFavorite(module) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'favorite-button';
        button.dataset.favorite = module.module_key;
        button.setAttribute('aria-label', `เพิ่ม ${module.display_name} ในรายการโปรด`);
        button.setAttribute('aria-pressed', 'false');
        const star = document.createElement('span');
        star.setAttribute('aria-hidden', 'true');
        star.textContent = '☆';
        button.append(star);
        return button;
    }

    function createLink(module, featured = false) {
        const link = document.createElement('a');
        link.className = featured ? 'primary-link' : 'module-link';
        link.dataset.moduleLink = module.module_key;
        const href = safeTargetUrl(module.target_url, module.link_type);
        link.href = href || '#systemDirectory';
        if (!href) link.setAttribute('aria-disabled', 'true');
        const external = module.link_type === 'external';
        if (external) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
        link.append(document.createTextNode(featured ? 'เปิดระบบ ' : 'เข้าสู่ระบบ '));
        const arrow = document.createElement('span');
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = external ? '↗' : '→';
        link.append(arrow);
        if (external) {
            const hint = document.createElement('span');
            hint.className = 'sr-only';
            hint.textContent = ' เปิดในแท็บใหม่';
            link.append(hint);
        }
        return link;
    }

    function moduleSearchText(module) {
        return [module.display_name, module.description, module.category, module.search_terms].filter(Boolean).join(' ');
    }

    function createFeaturedCard(module) {
        const article = document.createElement('article');
        article.className = 'featured-card is-dynamic';
        article.dataset.moduleCard = '';
        article.dataset.moduleId = module.module_key;
        article.dataset.category = module.category || '';
        article.dataset.search = moduleSearchText(module);
        article.append(createIcon(module, true));
        const copy = document.createElement('div');
        copy.className = 'featured-copy';
        const kicker = document.createElement('span');
        kicker.className = 'module-kicker';
        kicker.textContent = 'FEATURED WORKSPACE';
        const title = document.createElement('h3');
        title.textContent = module.display_name;
        const description = document.createElement('p');
        description.textContent = module.description;
        const capabilities = document.createElement('ul');
        capabilities.className = 'capability-list';
        capabilities.setAttribute('aria-label', 'ข้อมูลระบบเด่น');
        [CATEGORY_LABELS[module.category] || module.category || 'ระบบงาน', module.link_type === 'external' ? 'External / LIFF' : 'Portal Page', 'Admin Workspace'].forEach((label) => {
            const item = document.createElement('li');
            item.textContent = label;
            capabilities.append(item);
        });
        copy.append(kicker, title, description, capabilities);
        const actions = document.createElement('div');
        actions.className = 'featured-actions';
        actions.append(createFavorite(module), createLink(module, true));
        article.append(copy, actions);
        return article;
    }

    function createModuleCard(module) {
        const article = document.createElement('article');
        article.className = ['module-card', cardStyles.get(module.module_key), 'is-dynamic'].filter(Boolean).join(' ');
        article.dataset.moduleCard = '';
        article.dataset.moduleId = module.module_key;
        article.dataset.category = module.category || '';
        article.dataset.search = moduleSearchText(module);
        const top = document.createElement('div');
        top.className = 'card-top';
        top.append(createIcon(module), createFavorite(module));
        const category = document.createElement('span');
        category.className = 'module-category';
        category.textContent = CATEGORY_LABELS[module.category] || String(module.category || 'SYSTEM').toUpperCase();
        const title = document.createElement('h3');
        title.textContent = module.display_name;
        const description = document.createElement('p');
        description.textContent = module.description;
        article.append(top, category, title, description, createLink(module));
        return article;
    }

    function renderCategoryFilters(modules) {
        const container = document.getElementById('portalCategoryFilters');
        if (!container) return;
        const categories = [...new Set(modules.map((module) => String(module.category || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
        const buildButton = (value, label, active = false) => {
            const button = document.createElement('button');
            button.className = `filter-button${active ? ' is-active' : ''}`;
            button.type = 'button';
            button.dataset.categoryFilter = value;
            button.setAttribute('aria-pressed', String(active));
            button.textContent = label;
            return button;
        };
        container.replaceChildren(buildButton('all', 'ทั้งหมด', true), ...categories.map((category) => buildButton(category, CATEGORY_LABELS[category] || category)));
    }

    function renderModules(rawModules) {
        const seen = new Set();
        const modules = rawModules.filter((module) => {
            const key = String(module?.module_key || '');
            if (!module || typeof module !== 'object' || !module.is_enabled || !MODULE_KEY_PATTERN.test(key) || !module.display_name || seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, MAX_DYNAMIC_MODULES)
            .sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || String(a.module_key).localeCompare(String(b.module_key)));
        const featured = modules.find((module) => module.is_featured) || modules[0] || null;
        const featuredSection = document.getElementById('primaryWorkspace');
        const oldFeatured = featuredSection?.querySelector('[data-module-card]');
        if (featured && oldFeatured) oldFeatured.replaceWith(createFeaturedCard(featured));
        if (featuredSection) featuredSection.hidden = !featured;
        const featuredName = document.getElementById('featuredModuleName');
        if (featuredName) featuredName.textContent = featured?.display_name || 'ไม่มีระบบเด่น';
        const grid = document.getElementById('portalModuleGrid');
        if (grid) grid.replaceChildren(...modules.filter((module) => module.module_key !== featured?.module_key).map(createModuleCard));
        renderCategoryFilters(modules);
        const count = document.getElementById('portalModuleCountPill');
        if (count) count.textContent = `${modules.length} Systems`;
        return modules;
    }

    function warn(message) {
        const warning = document.createElement('div');
        warning.className = 'portal-content-warning';
        warning.setAttribute('role', 'status');
        warning.textContent = message;
        document.body.append(warning);
        window.setTimeout(() => warning.remove(), 7000);
    }

    function validContent(content) {
        return content && typeof content.settings === 'object' && Array.isArray(content.modules) && Number(content.settings.revision) >= 1;
    }

    async function loadPortalContent() {
        if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/admin-portal-content$/.test(config.contentApiUrl || '')) {
            setRuntimeStatus('fallback', 'ใช้ข้อมูลสำรอง', 'ยังไม่ได้ตั้งค่า Content API');
            return;
        }
        setRuntimeStatus('loading', 'กำลังโหลด Portal', 'กำลังตรวจสอบข้อมูลล่าสุด');
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), Number(config.requestTimeoutMs) || 8000);
        try {
            const response = await fetch(config.contentApiUrl, {
                headers: { Accept: 'application/json' }, signal: controller.signal,
                cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
            });
            if (!response.ok) throw new Error(`Content API ${response.status}`);
            const content = await response.json();
            if (!validContent(content)) throw new Error('Invalid Portal content payload');
            applySettings(content.settings);
            const modules = renderModules(content.modules);
            const updatedAt = new Date(content.settings.updated_at || Date.now());
            const updatedText = Number.isNaN(updatedAt.getTime()) ? `Revision ${content.settings.revision}` : `อัปเดต ${updatedAt.toLocaleString('th-TH')}`;
            setRuntimeStatus('ready', 'Portal พร้อมใช้งาน', `${modules.length} ระบบ · ${updatedText}`);
            window.dispatchEvent(new CustomEvent('portal-content:updated', { detail: { revision: content.settings.revision, modules: modules.length } }));
        } catch (error) {
            console.warn('Admin Portal dynamic content is unavailable', error);
            setRuntimeStatus('fallback', 'ใช้ข้อมูลสำรอง', 'โหลดการตั้งค่าล่าสุดไม่สำเร็จ');
            warn('ใช้ข้อมูลสำรองชั่วคราว เนื่องจากโหลดการตั้งค่า Portal ล่าสุดไม่สำเร็จ');
        } finally {
            window.clearTimeout(timer);
        }
    }

    captureFallbackVisuals();
    window.addEventListener('DOMContentLoaded', loadPortalContent);
})();
