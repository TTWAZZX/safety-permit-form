'use strict';

(() => {
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const PORTAL_CATEGORY_MASTER = Object.freeze({
        safety: 'งานความปลอดภัย',
        inspection: 'ตรวจสอบและตรวจประเมิน',
        incident: 'แจ้งเหตุและติดตามเคส',
        access: 'สิทธิ์ บุคคล และผู้รับเหมา',
        training: 'อบรมและองค์ความรู้',
        resource: 'ทรัพยากรและอุปกรณ์',
        analytics: 'รายงานและแดชบอร์ด',
        administration: 'บริหารระบบ',
    });
    const config = window.SAFETY_DASHBOARD_CONFIG || {};
    const managerState = {
        loaded: false,
        loading: false,
        settings: null,
        modules: [],
        selectedModuleKey: '',
        creatingModule: false,
        moduleKeyTouched: false,
        searchTermsTouched: false,
        iconAltTouched: false,
        localUrls: new Map(),
    };
    const byId = (id) => document.getElementById(id);

    function portalIsActive() {
        return byId('workspacePortal') && !byId('workspacePortal').hidden;
    }

    function accessToken() {
        return window.liff?.getAccessToken?.() || '';
    }

    function requestId() {
        return crypto.randomUUID();
    }

    function showNotice(message, isError = false) {
        const notice = byId('portalManagerNotice');
        notice.textContent = message;
        notice.classList.toggle('is-error', isError);
        notice.hidden = !message;
    }

    function setBusy(busy) {
        managerState.loading = busy;
        document.querySelectorAll('#workspacePortal button, #workspacePortal input, #workspacePortal textarea, #workspacePortal select').forEach((control) => {
            if (control.dataset.keepEnabled === 'true') return;
            if (busy) {
                control.dataset.wasDisabled = String(control.disabled);
                control.disabled = true;
            } else if (control.dataset.wasDisabled !== undefined) {
                control.disabled = control.dataset.wasDisabled === 'true';
                delete control.dataset.wasDisabled;
            }
        });
    }

    async function portalRequest({ body, formData, timeoutMs = 12000 } = {}) {
        if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/admin-portal-content$/.test(config.portalApiUrl || '')) {
            throw new Error('ยังไม่ได้ตั้งค่า Portal API');
        }
        const token = accessToken();
        if (!token) throw new Error('ไม่พบ LINE access token กรุณาเปิดหน้านี้ผ่าน LIFF แล้วลองใหม่');
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), timeoutMs);
        try {
            const url = formData ? `${config.portalApiUrl}?action=UPLOAD_ASSET` : config.portalApiUrl;
            const headers = { Authorization: `Bearer ${token}` };
            if (!formData) headers['Content-Type'] = 'application/json';
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: formData || JSON.stringify(body),
                signal: controller.signal,
                cache: 'no-store',
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                const duplicateModule = payload.error === 'Module key already exists' ? 'รหัสระบบนี้ถูกใช้แล้ว กรุณาใช้รหัสอื่น' : '';
                const conflict = response.status === 409 && !duplicateModule ? 'ข้อมูลถูกแก้จากอีกหน้าหนึ่ง กรุณาโหลดข้อมูลใหม่ก่อนบันทึก' : '';
                throw new Error(duplicateModule || conflict || payload.error || `Portal API ตอบกลับ ${response.status}`);
            }
            return payload;
        } catch (error) {
            if (error?.name === 'AbortError') throw new Error('การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่');
            throw error;
        } finally {
            window.clearTimeout(timer);
        }
    }

    function safeAssetUrl(asset) {
        try {
            const url = new URL(String(asset?.public_url || ''));
            const base = new URL(String(config.portalAssetBaseUrl || ''));
            return url.protocol === 'https:'
                && url.origin === base.origin
                && url.pathname.startsWith(base.pathname)
                && !url.username
                && !url.password
                ? url.href
                : '';
        } catch (_error) {
            return '';
        }
    }

    function setImage(imageId, placeholderId, url) {
        const image = byId(imageId);
        const placeholder = byId(placeholderId);
        image.hidden = true;
        placeholder.hidden = false;
        image.removeAttribute('src');
        if (!url) return;
        image.onload = () => { image.hidden = false; placeholder.hidden = true; };
        image.onerror = () => { image.hidden = true; placeholder.hidden = false; image.removeAttribute('src'); };
        image.src = url;
    }

    function inputValue(id, value) {
        byId(id).value = value == null ? '' : String(value);
    }

    function renderSettings() {
        const settings = managerState.settings;
        if (!settings) return;
        inputValue('portalBrandName', settings.brand_name);
        inputValue('portalBrandSubtitle', settings.brand_subtitle);
        inputValue('portalHeroEyebrow', settings.hero_eyebrow);
        inputValue('portalHeroTitle', settings.hero_title);
        inputValue('portalHeroHighlight', settings.hero_highlight);
        inputValue('portalHeroDescription', settings.hero_description);
        inputValue('portalPrimaryColor', settings.primary_color);
        inputValue('portalPrimaryColorPicker', settings.primary_color);
        inputValue('portalAccentColor', settings.accent_color);
        inputValue('portalAccentColorPicker', settings.accent_color);
        byId('portalSettingsRevision').textContent = `Revision ${settings.revision}`;
        setImage('portalLogoPreview', 'portalLogoPlaceholder', safeAssetUrl(settings.logo_asset));
        setImage('portalHeroPreview', 'portalHeroPlaceholder', safeAssetUrl(settings.hero_asset));
        updateLivePreview();
    }

    function updateLivePreview() {
        const value = (id, fallback) => byId(id).value.trim() || fallback;
        byId('portalPreviewBrandName').textContent = value('portalBrandName', 'TSH Safety');
        byId('portalPreviewBrandSubtitle').textContent = value('portalBrandSubtitle', 'Admin Portal');
        byId('portalPreviewEyebrow').textContent = value('portalHeroEyebrow', 'SAFETY OPERATIONS');
        byId('portalPreviewHeroTitle').textContent = value('portalHeroTitle', 'ศูนย์รวมระบบ');
        byId('portalPreviewHighlight').textContent = value('portalHeroHighlight', 'จัดการความปลอดภัย');
        byId('portalPreviewDescription').textContent = value('portalHeroDescription', 'ตัวอย่างข้อความหน้าแรก');
        const primary = /^#[0-9a-f]{6}$/i.test(byId('portalPrimaryColor').value) ? byId('portalPrimaryColor').value : '#063B2D';
        const accent = /^#[0-9a-f]{6}$/i.test(byId('portalAccentColor').value) ? byId('portalAccentColor').value : '#08745A';
        byId('portalLivePreview').style.setProperty('--portal-preview-primary', primary);
        byId('portalLivePreview').style.setProperty('--portal-preview-accent', accent);
        const logoUrl = safeAssetUrl(managerState.settings?.logo_asset);
        const logo = byId('portalPreviewLogo');
        logo.replaceChildren();
        if (logoUrl) {
            const image = document.createElement('img');
            image.alt = '';
            image.src = logoUrl;
            logo.append(image);
        } else {
            logo.textContent = value('portalBrandName', 'TSH').slice(0, 3).toUpperCase();
        }
    }

    function createModuleChoice(module) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'portal-module-choice';
        button.dataset.moduleKey = module.module_key;
        button.setAttribute('role', 'listitem');
        const icon = document.createElement('span');
        icon.className = 'portal-module-choice-icon';
        const iconUrl = safeAssetUrl(module.icon_asset);
        if (iconUrl) {
            const image = document.createElement('img');
            image.alt = '';
            image.src = iconUrl;
            icon.append(image);
        } else {
            icon.textContent = String(module.display_name || module.module_key).slice(0, 2).toUpperCase();
        }
        const copy = document.createElement('span');
        const name = document.createElement('strong');
        name.textContent = module.display_name || module.module_key;
        const category = document.createElement('small');
        category.textContent = module.category || 'ไม่ระบุหมวดหมู่';
        copy.append(name, category);
        const status = document.createElement('span');
        status.className = `portal-module-choice-status${module.is_enabled ? '' : ' is-disabled'}`;
        status.title = module.is_enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน';
        button.append(icon, copy, status);
        button.addEventListener('click', () => selectModule(module.module_key));
        return button;
    }

    function renderModuleList() {
        const list = byId('portalModuleList');
        list.replaceChildren(...managerState.modules.map(createModuleChoice));
        const selectedExists = managerState.modules.some((item) => item.module_key === managerState.selectedModuleKey);
        if (!selectedExists) managerState.selectedModuleKey = managerState.modules[0]?.module_key || '';
        selectModule(managerState.selectedModuleKey);
    }

    function selectedModule() {
        return managerState.modules.find((item) => item.module_key === managerState.selectedModuleKey) || null;
    }

    function clearModuleFile() {
        const input = byId('portalModuleIconFile');
        const localUrl = managerState.localUrls.get(input.id);
        if (localUrl) URL.revokeObjectURL(localUrl);
        managerState.localUrls.delete(input.id);
        input.value = '';
        byId('portalModuleIconUpload').disabled = true;
    }

    function updateTargetHint(message = '', isError = false) {
        const linkType = byId('portalModuleLinkType').value;
        const hint = byId('portalModuleTargetHint');
        hint.textContent = message || (linkType === 'internal'
            ? 'หน้าใน Portal ใช้ชื่อไฟล์ เช่น guard-admin.html (วาง URL ของ Portal เต็มรูปแบบได้ ระบบจะแปลงให้)'
            : 'ลิงก์ภายนอกหรือ LIFF ต้องขึ้นต้นด้วย https://');
        hint.classList.toggle('is-error', isError);
    }

    function uniqueModuleKey(rawName, category) {
        const ascii = String(rawName || '')
            .normalize('NFKD')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 72);
        const fallback = `${category || 'portal'}-system`;
        const base = ascii || fallback;
        const used = new Set(managerState.modules.map((item) => item.module_key));
        if (!used.has(base)) return base;
        for (let suffix = 2; suffix <= 999; suffix += 1) {
            const candidate = `${base.slice(0, Math.max(1, 79 - String(suffix).length))}-${suffix}`;
            if (!used.has(candidate)) return candidate;
        }
        return `${fallback}-${Date.now()}`.slice(0, 80);
    }

    function nextSortOrder() {
        const used = new Set(managerState.modules.map((item) => Number(item.sort_order)).filter(Number.isInteger));
        const highest = Math.max(0, ...used);
        const preferred = Math.ceil(highest / 10) * 10 + 10;
        if (preferred <= 1000 && !used.has(preferred)) return preferred;
        for (let value = 10; value <= 1000; value += 10) if (!used.has(value)) return value;
        for (let value = 1; value <= 1000; value += 1) if (!used.has(value)) return value;
        return 1000;
    }

    function applyAutomaticModuleDefaults() {
        if (!managerState.creatingModule) return;
        const name = byId('portalModuleDisplayName').value.trim();
        const category = byId('portalModuleCategory').value;
        const categoryLabel = PORTAL_CATEGORY_MASTER[category] || category;
        if (!managerState.moduleKeyTouched) inputValue('portalModuleKey', uniqueModuleKey(name, category));
        if (!managerState.searchTermsTouched) inputValue('portalModuleSearchTerms', name ? `${name} ${categoryLabel}` : categoryLabel);
        if (!managerState.iconAltTouched) inputValue('portalModuleIconAlt', name ? `ไอคอน ${name}` : `ไอคอน ${categoryLabel}`);
    }

    function startCreateModule() {
        managerState.creatingModule = true;
        managerState.moduleKeyTouched = false;
        managerState.searchTermsTouched = false;
        managerState.iconAltTouched = false;
        managerState.selectedModuleKey = '';
        document.querySelectorAll('.portal-module-choice').forEach((button) => button.classList.remove('is-active'));
        byId('portalModuleForm').reset();
        clearModuleFile();
        setImage('portalModuleIconPreview', 'portalModuleIconPlaceholder', '');
        byId('portalModuleIconPlaceholder').textContent = 'NEW';
        byId('portalModuleEditorName').textContent = 'สร้างระบบใหม่';
        byId('portalModuleRevision').textContent = 'บันทึกข้อมูลก่อน แล้วจึงอัปโหลดไอคอน';
        byId('portalModuleKey').disabled = false;
        inputValue('portalModuleKey', 'safety-system');
        inputValue('portalModuleCategory', 'safety');
        inputValue('portalModuleLinkType', 'external');
        inputValue('portalModuleSortOrder', nextSortOrder());
        byId('portalModuleEnabled').checked = true;
        byId('portalModuleCancel').hidden = false;
        byId('portalModuleSave').disabled = false;
        byId('portalModuleSave').textContent = 'สร้างระบบ';
        applyAutomaticModuleDefaults();
        updateTargetHint();
        byId('portalModuleDisplayName').focus();
    }

    function selectModule(moduleKey) {
        managerState.creatingModule = false;
        managerState.moduleKeyTouched = true;
        managerState.searchTermsTouched = true;
        managerState.iconAltTouched = true;
        managerState.selectedModuleKey = moduleKey;
        document.querySelectorAll('.portal-module-choice').forEach((button) => {
            button.classList.toggle('is-active', button.dataset.moduleKey === moduleKey);
        });
        const module = selectedModule();
        byId('portalModuleSave').disabled = !module;
        if (!module) return;
        clearModuleFile();
        byId('portalModuleKey').disabled = true;
        inputValue('portalModuleKey', module.module_key);
        inputValue('portalModuleDisplayName', module.display_name);
        inputValue('portalModuleCategory', module.category);
        inputValue('portalModuleDescription', module.description);
        inputValue('portalModuleTargetUrl', module.target_url);
        inputValue('portalModuleLinkType', module.link_type);
        inputValue('portalModuleSortOrder', module.sort_order);
        inputValue('portalModuleSearchTerms', module.search_terms);
        inputValue('portalModuleIconAlt', module.icon_alt);
        byId('portalModuleFeatured').checked = Boolean(module.is_featured);
        byId('portalModuleEnabled').checked = Boolean(module.is_enabled);
        byId('portalModuleEditorName').textContent = module.display_name || module.module_key;
        byId('portalModuleRevision').textContent = `Revision ${module.revision} · ${module.module_key}`;
        setImage('portalModuleIconPreview', 'portalModuleIconPlaceholder', safeAssetUrl(module.icon_asset));
        byId('portalModuleIconPlaceholder').textContent = String(module.display_name || module.module_key).slice(0, 3).toUpperCase();
        byId('portalModuleCancel').hidden = true;
        byId('portalModuleSave').textContent = 'บันทึกข้อมูลระบบ';
        updateTargetHint();
    }

    function applyContent(payload) {
        managerState.settings = payload.settings || null;
        managerState.modules = Array.isArray(payload.modules) ? payload.modules : [];
        managerState.loaded = true;
        renderSettings();
        renderModuleList();
        const updatedAt = managerState.settings?.updated_at ? new Date(managerState.settings.updated_at) : new Date();
        byId('portalManagerUpdated').textContent = `อัปเดต ${updatedAt.toLocaleString('th-TH')}`;
    }

    async function loadManager(force = false) {
        if (!portalIsActive() || managerState.loading || (managerState.loaded && !force)) return;
        setBusy(true);
        showNotice('กำลังโหลดข้อมูล Portal…');
        try {
            const payload = await portalRequest({ body: { action: 'GET_ADMIN_CONTENT' } });
            applyContent(payload);
            showNotice('โหลดข้อมูลล่าสุดเรียบร้อย');
        } catch (error) {
            showNotice(error.message || 'โหลดข้อมูล Portal ไม่สำเร็จ', true);
        } finally {
            setBusy(false);
            selectModule(managerState.selectedModuleKey);
        }
    }

    function settingsPatch() {
        return {
            brand_name: byId('portalBrandName').value.trim(),
            brand_subtitle: byId('portalBrandSubtitle').value.trim(),
            hero_eyebrow: byId('portalHeroEyebrow').value.trim(),
            hero_title: byId('portalHeroTitle').value.trim(),
            hero_highlight: byId('portalHeroHighlight').value.trim(),
            hero_description: byId('portalHeroDescription').value.trim(),
            primary_color: byId('portalPrimaryColor').value.trim().toUpperCase(),
            accent_color: byId('portalAccentColor').value.trim().toUpperCase(),
        };
    }

    async function saveSettings(event) {
        event.preventDefault();
        if (!event.currentTarget.reportValidity() || !managerState.settings) return;
        setBusy(true);
        showNotice('กำลังบันทึกข้อความและสี…');
        try {
            await portalRequest({ body: {
                action: 'UPDATE_SETTINGS', request_id: requestId(),
                expected_revision: managerState.settings.revision, patch: settingsPatch(),
            } });
            managerState.loaded = false;
            showNotice('บันทึกข้อความและสีเรียบร้อย กำลังโหลดข้อมูลล่าสุด…');
        } catch (error) {
            showNotice(error.message || 'บันทึกไม่สำเร็จ', true);
            setBusy(false);
            return;
        }
        setBusy(false);
        await loadManager(true);
    }

    function normalizedTargetUrl(rawValue, linkType) {
        const raw = String(rawValue || '').trim();
        if (linkType === 'internal') {
            if (/^[A-Za-z0-9][A-Za-z0-9._/-]*\.html(?:[?#][^\s]*)?$/.test(raw)) return raw;
            let url;
            try { url = new URL(raw); } catch (_error) { throw new Error('หน้าใน Portal ต้องเป็นชื่อไฟล์ .html หรือ URL ของ Portal นี้'); }
            const portalBase = new URL('.', window.location.href);
            if (url.protocol !== 'https:' || url.origin !== portalBase.origin || !url.pathname.startsWith(portalBase.pathname)) {
                throw new Error('URL นี้อยู่นอก Portal กรุณาเลือกรูปแบบ “ลิงก์ภายนอก / LIFF”');
            }
            const relative = `${url.pathname.slice(portalBase.pathname.length)}${url.search}${url.hash}`;
            if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*\.html(?:[?#][^\s]*)?$/.test(relative)) throw new Error('หน้าใน Portal ต้องลงท้ายด้วย .html');
            return relative;
        }
        let url;
        try { url = new URL(raw); } catch (_error) { throw new Error('ลิงก์ภายนอกต้องเป็น URL ที่สมบูรณ์'); }
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error('ลิงก์ภายนอกต้องเป็น https:// และห้ามมีชื่อผู้ใช้หรือรหัสผ่าน');
        return url.href;
    }

    function modulePatch() {
        const linkType = byId('portalModuleLinkType').value;
        return {
            display_name: byId('portalModuleDisplayName').value.trim(),
            description: byId('portalModuleDescription').value.trim(),
            category: byId('portalModuleCategory').value.trim(),
            target_url: normalizedTargetUrl(byId('portalModuleTargetUrl').value, linkType),
            link_type: linkType,
            search_terms: byId('portalModuleSearchTerms').value.trim(),
            icon_alt: byId('portalModuleIconAlt').value.trim(),
            sort_order: Number(byId('portalModuleSortOrder').value),
            is_featured: byId('portalModuleFeatured').checked,
            is_enabled: byId('portalModuleEnabled').checked,
        };
    }

    async function saveModule(event) {
        event.preventDefault();
        const module = selectedModule();
        const creating = managerState.creatingModule;
        if ((!module && !creating) || !event.currentTarget.reportValidity()) return;
        const moduleKey = creating ? byId('portalModuleKey').value.trim().toLowerCase() : module.module_key;
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(moduleKey)) {
            byId('portalModuleKey').setCustomValidity('ใช้ได้เฉพาะตัวพิมพ์เล็ก ตัวเลข และขีดกลาง');
            byId('portalModuleKey').reportValidity();
            return;
        }
        byId('portalModuleKey').setCustomValidity('');
        let patch;
        try {
            patch = modulePatch();
            byId('portalModuleTargetUrl').setCustomValidity('');
            updateTargetHint();
        } catch (error) {
            byId('portalModuleTargetUrl').setCustomValidity(error.message);
            byId('portalModuleTargetUrl').reportValidity();
            updateTargetHint(error.message, true);
            return;
        }
        setBusy(true);
        showNotice(creating ? 'กำลังสร้างระบบใหม่…' : `กำลังบันทึก ${module.display_name}…`);
        try {
            const body = creating
                ? { action: 'CREATE_MODULE', request_id: requestId(), module_key: moduleKey, module: patch }
                : { action: 'UPDATE_MODULE', request_id: requestId(), module_key: module.module_key, expected_revision: module.revision, patch };
            await portalRequest({ body });
            managerState.selectedModuleKey = moduleKey;
            managerState.creatingModule = false;
            managerState.loaded = false;
            showNotice(creating ? 'สร้างระบบเรียบร้อย หลังโหลดข้อมูลแล้วสามารถอัปโหลดไอคอนได้' : 'บันทึกข้อมูลระบบเรียบร้อย กำลังโหลดข้อมูลล่าสุด…');
        } catch (error) {
            showNotice(error.message || 'บันทึกข้อมูลระบบไม่สำเร็จ', true);
            setBusy(false);
            return;
        }
        setBusy(false);
        await loadManager(true);
    }

    function validateImage(file) {
        if (!file) throw new Error('กรุณาเลือกรูปภาพ');
        if (!IMAGE_TYPES.has(file.type)) throw new Error('รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP');
        if (file.size < 1 || file.size > MAX_IMAGE_BYTES) throw new Error('รูปภาพต้องมีขนาดไม่เกิน 5 MB');
        return file;
    }

    function previewFile(input, imageId, placeholderId, uploadButtonId) {
        try {
            const file = validateImage(input.files?.[0]);
            const oldUrl = managerState.localUrls.get(input.id);
            if (oldUrl) URL.revokeObjectURL(oldUrl);
            const url = URL.createObjectURL(file);
            managerState.localUrls.set(input.id, url);
            setImage(imageId, placeholderId, url);
            byId(uploadButtonId).disabled = false;
            showNotice('ตรวจสอบตัวอย่างแล้วกดอัปโหลดเพื่อบันทึกรูป');
        } catch (error) {
            input.value = '';
            byId(uploadButtonId).disabled = true;
            showNotice(error.message, true);
        }
    }

    async function uploadAsset(assetKind, inputId) {
        const input = byId(inputId);
        const file = validateImage(input.files?.[0]);
        const module = assetKind === 'module_icon' ? selectedModule() : null;
        if (assetKind === 'module_icon' && !module) throw new Error('กรุณาเลือกระบบก่อนอัปโหลดไอคอน');
        const revision = module ? module.revision : managerState.settings?.revision;
        if (!revision) throw new Error('กรุณาโหลดข้อมูลล่าสุดก่อนอัปโหลด');
        const form = new FormData();
        form.append('file', file, file.name);
        form.append('asset_kind', assetKind);
        if (module) form.append('module_key', module.module_key);
        form.append('request_id', requestId());
        form.append('expected_revision', String(revision));
        setBusy(true);
        showNotice('กำลังอัปโหลดรูปภาพ…');
        try {
            await portalRequest({ formData: form, timeoutMs: 30000 });
            const localUrl = managerState.localUrls.get(inputId);
            if (localUrl) URL.revokeObjectURL(localUrl);
            managerState.localUrls.delete(inputId);
            input.value = '';
            const uploadButton = assetKind === 'logo' ? byId('portalLogoUpload') : assetKind === 'hero' ? byId('portalHeroUpload') : byId('portalModuleIconUpload');
            uploadButton.disabled = true;
            uploadButton.dataset.wasDisabled = 'true';
            managerState.loaded = false;
            showNotice('อัปโหลดรูปภาพเรียบร้อย กำลังโหลดข้อมูลล่าสุด…');
        } catch (error) {
            showNotice(error.message || 'อัปโหลดรูปภาพไม่สำเร็จ', true);
            setBusy(false);
            return;
        }
        setBusy(false);
        await loadManager(true);
    }

    function bindManagerEvents() {
        byId('portalManagerReload').addEventListener('click', () => loadManager(true));
        byId('portalSettingsForm').addEventListener('submit', saveSettings);
        byId('portalModuleForm').addEventListener('submit', saveModule);
        byId('portalModuleCreate').addEventListener('click', startCreateModule);
        byId('portalModuleCancel').addEventListener('click', () => selectModule(managerState.modules[0]?.module_key || ''));
        byId('portalModuleLinkType').addEventListener('change', () => {
            byId('portalModuleTargetUrl').setCustomValidity('');
            updateTargetHint();
        });
        byId('portalModuleKey').addEventListener('input', (event) => {
            managerState.moduleKeyTouched = true;
            event.target.value = event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
            event.target.setCustomValidity('');
        });
        byId('portalModuleDisplayName').addEventListener('input', applyAutomaticModuleDefaults);
        byId('portalModuleCategory').addEventListener('change', applyAutomaticModuleDefaults);
        byId('portalModuleSearchTerms').addEventListener('input', () => { managerState.searchTermsTouched = true; });
        byId('portalModuleIconAlt').addEventListener('input', () => { managerState.iconAltTouched = true; });
        ['portalBrandName', 'portalBrandSubtitle', 'portalHeroEyebrow', 'portalHeroTitle', 'portalHeroHighlight', 'portalHeroDescription', 'portalPrimaryColor', 'portalAccentColor'].forEach((id) => {
            byId(id).addEventListener('input', updateLivePreview);
        });
        [['portalPrimaryColorPicker', 'portalPrimaryColor'], ['portalAccentColorPicker', 'portalAccentColor']].forEach(([pickerId, textId]) => {
            byId(pickerId).addEventListener('input', () => { byId(textId).value = byId(pickerId).value.toUpperCase(); updateLivePreview(); });
            byId(textId).addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(byId(textId).value)) byId(pickerId).value = byId(textId).value; });
        });
        byId('portalLogoFile').addEventListener('change', (event) => previewFile(event.target, 'portalLogoPreview', 'portalLogoPlaceholder', 'portalLogoUpload'));
        byId('portalHeroFile').addEventListener('change', (event) => previewFile(event.target, 'portalHeroPreview', 'portalHeroPlaceholder', 'portalHeroUpload'));
        byId('portalModuleIconFile').addEventListener('change', (event) => previewFile(event.target, 'portalModuleIconPreview', 'portalModuleIconPlaceholder', 'portalModuleIconUpload'));
        byId('portalLogoUpload').addEventListener('click', () => uploadAsset('logo', 'portalLogoFile').catch((error) => showNotice(error.message, true)));
        byId('portalHeroUpload').addEventListener('click', () => uploadAsset('hero', 'portalHeroFile').catch((error) => showNotice(error.message, true)));
        byId('portalModuleIconUpload').addEventListener('click', () => uploadAsset('module_icon', 'portalModuleIconFile').catch((error) => showNotice(error.message, true)));
        window.addEventListener('portal-manager:open', () => loadManager());
        window.addEventListener('safety-dashboard:authenticated', () => loadManager());
        window.addEventListener('beforeunload', () => managerState.localUrls.forEach((url) => URL.revokeObjectURL(url)));
    }

    window.addEventListener('DOMContentLoaded', bindManagerEvents);
})();
