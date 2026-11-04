(() => {
    'use strict';

    const config = window.JOHNNY_CONTROL_CONFIG || {};
    const state = { token: '', active: 'overview', loaded: new Set(), overview: null, storageOffset: 0, storageLimit: 40, image: null };
    const titles = { overview: 'ภาพรวมระบบ', storage: 'Storage Explorer', retention: 'Retention & Legal Hold', line: 'LINE Message Usage', richmenu: 'Rich Menu Studio', health: 'System Health', audit: 'Audit Log' };
    const el = (id) => document.getElementById(id);
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
    const formatBytes = (bytes) => { const value = Number(bytes || 0); if (value < 1024) return `${value} B`; if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`; if (value < 1073741824) return `${(value / 1048576).toFixed(2)} MB`; return `${(value / 1073741824).toFixed(2)} GB`; };
    const formatDate = (value) => value ? new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
    const daysUntil = (value) => value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86400000) : null;
    const requestId = (prefix) => `${prefix}:${Date.now()}:${crypto.randomUUID()}`;

    function notice(message, type = 'info') {
        const node = el('pageNotice'); node.textContent = message; node.className = `notice${type === 'error' ? ' error' : ''}`; node.hidden = false;
        window.setTimeout(() => { if (node.textContent === message) node.hidden = true; }, 7000);
    }

    async function api(view, options = {}) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), options.timeout || Number(config.requestTimeoutMs) || 15000);
        const url = new URL(config.apiUrl);
        url.searchParams.set('view', view);
        Object.entries(options.params || {}).forEach(([key, value]) => { if (value !== '' && value != null) url.searchParams.set(key, value); });
        try {
            const response = await fetch(url, {
                method: options.method || 'GET',
                headers: { Authorization: `Bearer ${state.token}`, Accept: 'application/json', ...(options.body instanceof FormData ? {} : options.body ? { 'Content-Type': 'application/json' } : {}) },
                body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
                signal: controller.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
            });
            let payload = {}; try { payload = await response.json(); } catch { /* handled below */ }
            if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
            return payload;
        } finally { window.clearTimeout(timeout); }
    }

    function setGlobalStatus(ok, detail) {
        el('globalStatus').textContent = ok ? 'ระบบพร้อมใช้งาน' : 'ต้องตรวจสอบระบบ';
        el('globalUpdated').textContent = detail || `อัปเดต ${new Date().toLocaleTimeString('th-TH')}`;
        el('globalStatusDot').className = `status-dot ${ok ? 'ok' : 'bad'}`;
    }

    function metric(label, value, detail, level = '') {
        return `<article class="metric-card ${level}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><span>${escapeHtml(detail || '')}</span></article>`;
    }

    function alertLevel(percent) { return percent >= 95 ? 'danger' : percent >= 85 ? 'danger' : percent >= 70 ? 'warn' : ''; }

    async function loadOverview(force = false) {
        if (!force && state.loaded.has('overview')) return;
        el('overviewCards').innerHTML = metric('กำลังโหลด', '…', 'อ่านข้อมูล Production');
        const payload = await api('overview'); state.overview = payload; state.loaded.add('overview');
        const data = payload.overview || {}, storage = data.storage || {}, retention = data.retention || {};
        const quota = Number(payload.storage_quota_bytes || 0), used = Number(storage.total_bytes || 0), percent = quota ? used / quota * 100 : 0;
        el('dryRunBadge').textContent = payload.cleanup_dry_run ? '✓ Storage Cleanup: DRY RUN' : '⚠ Storage Cleanup: LIVE';
        el('overviewCards').innerHTML = [
            metric('Storage ทั้งหมด', formatBytes(used), `${percent.toFixed(1)}% ของ ${formatBytes(quota)}`, alertLevel(percent)),
            metric('Safety Evidence', `${Number(storage.safety_objects || 0).toLocaleString('th-TH')} รูป`, formatBytes(storage.safety_bytes)),
            metric('ใกล้ลบภายใน 7 วัน', Number(retention.due_7d || 0).toLocaleString('th-TH'), `เลยกำหนด ${Number(retention.due_count || 0)} รายการ`, Number(retention.due_count || 0) ? 'warn' : ''),
            metric('Legal Hold', Number(data.legal_hold_count || 0).toLocaleString('th-TH'), 'เคสที่ระงับการลบ'),
            metric('Cleanup Failed', Number(retention.failed_count || 0).toLocaleString('th-TH'), `กำลังประมวลผล ${Number(retention.processing_count || 0)}`, Number(retention.failed_count || 0) ? 'danger' : ''),
            metric('Rich Menu Versions', Number(data.rich_menu?.version_count || 0).toLocaleString('th-TH'), `Draft ${Number(data.rich_menu?.draft_count || 0)}`),
            metric('Tracked Evidence', formatBytes(retention.tracked_bytes), `${Number(retention.active_count || 0)} รายการ active`),
            metric('Cleanup ล่าสุด', data.last_cleanup_event?.event_type || 'ยังไม่มีข้อมูล', formatDate(data.last_cleanup_event?.created_at)),
        ].join('');
        const buckets = Array.isArray(storage.buckets) ? storage.buckets : [];
        el('bucketUsage').innerHTML = buckets.length ? buckets.map((bucket) => `<div class="bucket-row"><strong>${escapeHtml(bucket.bucket_id)}</strong><div class="progress"><span style="width:${Math.min(100, Number(bucket.byte_size || 0) / Math.max(used, 1) * 100)}%"></span></div><span>${formatBytes(bucket.byte_size)} · ${Number(bucket.object_count).toLocaleString('th-TH')}</span></div>`).join('') : '<div class="empty">ยังไม่มีไฟล์ใน Storage</div>';
        el('upcomingSummary').innerHTML = [
            ['เลยกำหนดแล้ว', retention.due_count, 'danger'], ['ภายใน 1 วัน', retention.due_1d, 'warning'], ['ภายใน 3 วัน', retention.due_3d, ''], ['ภายใน 7 วัน', retention.due_7d, '']
        ].map(([label, value, badge]) => `<div class="summary-row"><strong>${label}</strong><span></span><span class="badge ${badge}">${Number(value || 0).toLocaleString('th-TH')} รายการ</span></div>`).join('');
        const warnings = [];
        if (percent >= 70) warnings.push(`Storage ใช้ ${percent.toFixed(1)}% แล้ว`);
        if (Number(retention.failed_count || 0)) warnings.push(`มี Cleanup ล้มเหลว ${retention.failed_count} รายการ`);
        if (!payload.cleanup_dry_run) warnings.push('ระบบลบไฟล์จริงอยู่ในโหมด LIVE');
        el('alertStrip').hidden = !warnings.length; el('alertStrip').textContent = warnings.join(' · ');
        setGlobalStatus(!Number(retention.failed_count || 0), `อัปเดต ${formatDate(data.generated_at)}`);
    }

    async function loadStorage(force = false) {
        if (!force && state.loaded.has(`storage:${state.storageOffset}`)) return;
        el('storageGrid').innerHTML = '<div class="empty">กำลังโหลดรูปที่ได้รับอนุญาต…</div>';
        const payload = await api('storage', { params: { limit: state.storageLimit, offset: state.storageOffset, status: el('storageStatus').value, search: el('storageSearch').value.trim() } });
        state.loaded.add(`storage:${state.storageOffset}`); const items = payload.items || [];
        el('storageSummary').textContent = `พบ ${Number(payload.total || 0).toLocaleString('th-TH')} ไฟล์ · Signed URL มีอายุ 10 นาที`;
        el('storageGrid').innerHTML = items.length ? items.map((item) => `<article class="media-card">${item.image_url ? `<a href="${escapeHtml(item.image_url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(item.image_url)}" loading="lazy" alt="หลักฐาน ${escapeHtml(item.case_number || '')}"></a>` : '<div class="image-placeholder">ไม่มี Preview</div>'}<div class="media-copy"><span class="badge ${item.status === 'FAILED' ? 'failed' : ''}">${escapeHtml(item.status)}</span><h3>${escapeHtml(item.case_number || item.source_kind || 'ไม่ผูกเคส')}</h3><div class="media-meta"><span>${escapeHtml(item.source_kind)} · ${formatBytes(item.byte_size)}</span><span>อัปโหลด ${formatDate(item.object_created_at)}</span><span>กำหนดลบ ${formatDate(item.retain_until)}</span>${item.legal_hold ? '<span>🔒 Legal Hold</span>' : ''}</div></div></article>`).join('') : '<div class="empty">ไม่พบไฟล์ตามตัวกรอง</div>';
        const total = Number(payload.total || 0), page = Math.floor(state.storageOffset / state.storageLimit) + 1;
        el('storagePagination').innerHTML = `<button class="button ghost" data-page="prev" ${state.storageOffset === 0 ? 'disabled' : ''}>← ก่อนหน้า</button><span>หน้า ${page}</span><button class="button ghost" data-page="next" ${state.storageOffset + state.storageLimit >= total ? 'disabled' : ''}>ถัดไป →</button>`;
    }

    async function loadRetention(force = false) {
        if (!force && state.loaded.has('retention')) return;
        el('retentionRows').innerHTML = '<tr><td colspan="7">กำลังโหลด…</td></tr>';
        const payload = await api('retention'); state.loaded.add('retention');
        const items = payload.retention?.items || [];
        const due = items.filter((item) => item.retain_until && new Date(item.retain_until) <= new Date()).length;
        el('retentionStats').innerHTML = [metric('รายการทั้งหมด', items.length, 'ไม่รวมที่ลบแล้ว'), metric('เลยกำหนด', due, 'Dry Run ยังไม่ลบ', due ? 'warn' : ''), metric('Failed', items.filter((item) => item.status === 'FAILED').length, 'ตรวจ retry'), metric('Legal Hold', items.filter((item) => item.legal_hold).length, 'ระงับการลบ'), metric('โหมด Cleanup', payload.cleanup_dry_run ? 'DRY RUN' : 'LIVE', payload.cleanup_dry_run ? 'ปลอดภัย: ไม่ลบไฟล์' : 'ลบไฟล์จริง', payload.cleanup_dry_run ? '' : 'danger')].join('');
        el('retentionRows').innerHTML = items.length ? items.map((item) => { const days = daysUntil(item.retain_until); return `<tr><td><strong>${escapeHtml(item.case_number || '—')}</strong></td><td>${escapeHtml(item.source_kind)}</td><td><span class="badge ${item.status === 'FAILED' ? 'failed' : ''}">${escapeHtml(item.status)}</span></td><td>${formatBytes(item.byte_size)}</td><td>${formatDate(item.retain_until)}<br><small>${days == null ? '' : days < 0 ? `เลย ${Math.abs(days)} วัน` : `เหลือ ${days} วัน`}</small></td><td>${item.legal_hold ? '🔒 เปิด' : '—'}</td><td>${item.case_id ? `<button class="button ghost hold-button" data-case-id="${escapeHtml(item.case_id)}" data-hold="${item.legal_hold ? 'false' : 'true'}">${item.legal_hold ? 'ปลด Hold' : 'เปิด Hold'}</button>` : '—'}</td></tr>`; }).join('') : '<tr><td colspan="7" class="empty">ไม่มีรายการ Retention</td></tr>';
    }

    async function loadLine(force = false) {
        if (!force && state.loaded.has('line')) return;
        el('lineQuotaPanel').textContent = 'กำลังอ่านข้อมูลจาก LINE…';
        const payload = await api('line-usage'); state.loaded.add('line');
        const limit = Number(payload.quota?.value || 0), used = Number(payload.consumption?.totalUsage || 0), percent = payload.percentage == null ? null : Number(payload.percentage);
        el('lineQuotaPanel').innerHTML = `<div class="quota-number"><div><small>ใช้ไปแล้วในเดือนนี้</small><strong>${used.toLocaleString('th-TH')} / ${limit ? limit.toLocaleString('th-TH') : 'ไม่จำกัด'}</strong></div><span>${percent == null ? 'Unlimited' : `${percent.toFixed(1)}%`}</span></div><div class="quota-bar"><span style="width:${Math.min(100, percent || 0)}%;${percent >= 95 ? 'background:#d64545' : percent >= 85 ? 'background:#e58d1b' : ''}"></span></div><p>${percent != null && percent >= 70 ? `⚠ ถึงระดับแจ้งเตือน ${percent >= 95 ? '95%' : percent >= 85 ? '85%' : '70%'}` : 'สถานะการใช้งานปกติ'} · Reply message ไม่ถูกนับในโควตาแบบเดียวกับ Push/Broadcast</p>`;
        el('lineDailyRows').innerHTML = (payload.daily || []).map((day) => `<tr><td>${escapeHtml(day.date)}</td><td>${Number(day.apiReply || 0).toLocaleString('th-TH')}</td><td>${Number(day.apiPush || 0).toLocaleString('th-TH')}</td><td>${Number(day.apiBroadcast || 0).toLocaleString('th-TH')}</td><td>${Number(day.apiMulticast || 0).toLocaleString('th-TH')}</td><td><span class="badge ${day.status !== 'ready' ? 'warning' : ''}">${escapeHtml(day.status || 'unknown')}</span></td></tr>`).join('');
    }

    function versionCard(item, legacy = false) {
        const status = legacy ? (item.is_default ? 'DEFAULT LEGACY' : 'LEGACY') : item.status;
        const actions = legacy ? '' : `<div class="version-actions">${['DRAFT', 'FAILED'].includes(item.status) ? `<button class="button ghost menu-action" data-action="validate" data-id="${item.id}">Validate</button>` : ''}${['VALIDATED', 'DRAFT'].includes(item.status) ? `<button class="button primary menu-action" data-action="publish" data-id="${item.id}">Publish</button>` : ''}${item.line_rich_menu_id && item.status !== 'PUBLISHED' ? `<button class="button warning menu-action" data-action="rollback" data-id="${item.id}">Rollback</button>` : ''}</div>`;
        return `<article class="version-card">${item.image_url ? `<img src="${escapeHtml(item.image_url)}" loading="lazy" alt="${escapeHtml(item.name)}">` : ''}<div class="version-card-copy"><span class="badge ${status.includes('FAILED') ? 'failed' : ''}">${escapeHtml(status)}</span><h4>${escapeHtml(item.name || `Rich Menu ${item.richMenuId?.slice(-8) || ''}`)}</h4><p>${legacy ? `LINE ID ${escapeHtml(item.richMenuId || '')}` : `Version ${item.version_no} · Revision ${item.revision}`}</p><p>${legacy ? (item.is_default ? 'กำลังเป็น Default ปัจจุบัน' : 'ค้นพบจาก LINE API') : `เผยแพร่ ${formatDate(item.published_at)}`}</p>${legacy && item.aliases?.length ? `<p>Alias: ${item.aliases.map(escapeHtml).join(', ')}</p>` : ''}${actions}</div></article>`;
    }

    async function loadRichMenu(force = false) {
        if (!force && state.loaded.has('richmenu')) return;
        el('managedMenus').textContent = 'กำลังโหลด…'; el('legacyMenus').textContent = 'กำลังตรวจเมนูเดิมจาก LINE…';
        const payload = await api('rich-menu', { timeout: Number(config.richMenuTimeoutMs) || 30000 }); state.loaded.add('richmenu');
        el('managedMenus').innerHTML = payload.managed?.length ? payload.managed.map((item) => versionCard(item)).join('') : '<div class="empty">ยังไม่มีเวอร์ชันที่ Control Center จัดการ</div>';
        el('legacyMenus').innerHTML = payload.legacy?.length ? payload.legacy.map((item) => versionCard(item, true)).join('') : '<div class="empty">ไม่พบ Legacy ที่ยังไม่ถูกนำเข้า</div>';
        el('importLegacyButton').disabled = !payload.legacy?.length;
    }

    async function loadHealth(force = false) {
        if (!force && state.loaded.has('health')) return;
        const payload = await api('health'); state.loaded.add('health'); const health = payload.health || {};
        const flat = Object.entries(health).filter(([, value]) => ['number', 'string', 'boolean'].includes(typeof value)).slice(0, 8);
        el('healthCards').innerHTML = flat.length ? flat.map(([key, value]) => metric(key.replaceAll('_', ' '), String(value), '')).join('') : metric('Automation Health', 'พร้อมอ่านข้อมูล', 'ดูรายละเอียดด้านล่าง');
        el('healthDetails').textContent = JSON.stringify({ ...health, storage_cleanup: { function: payload.cleanup_function, dry_run: payload.cleanup_dry_run } }, null, 2);
    }

    async function loadAudit(force = false) {
        if (!force && state.loaded.has('audit')) return;
        const payload = await api('audit'); state.loaded.add('audit');
        el('auditRows').innerHTML = payload.items?.length ? payload.items.map((item) => `<tr><td>${formatDate(item.created_at)}</td><td>${escapeHtml(item.actor_uid)}</td><td><span class="badge">${escapeHtml(item.action)}</span></td><td>${escapeHtml(item.entity_type)}<br><small>${escapeHtml(item.entity_key)}</small></td><td><code>${escapeHtml(JSON.stringify(item.details || {})).slice(0, 300)}</code></td></tr>`).join('') : '<tr><td colspan="5" class="empty">ยังไม่มี Audit Log</td></tr>';
    }

    const loaders = { overview: loadOverview, storage: loadStorage, retention: loadRetention, line: loadLine, richmenu: loadRichMenu, health: loadHealth, audit: loadAudit };
    async function showView(name, force = false) {
        if (!loaders[name]) return; state.active = name; el('pageTitle').textContent = titles[name];
        document.querySelectorAll('[data-panel]').forEach((panel) => { const active = panel.dataset.panel === name; panel.hidden = !active; panel.classList.toggle('is-active', active); });
        document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.view === name));
        document.querySelector('.sidebar').classList.remove('is-open');
        try { await loaders[name](force); } catch (error) { notice(error.message || 'โหลดข้อมูลไม่สำเร็จ', 'error'); setGlobalStatus(false, 'โหลดข้อมูลไม่สำเร็จ'); }
    }

    function confirmAction({ title, message, phrase = '' }) {
        return new Promise((resolve) => {
            const dialog = el('confirmDialog'), input = el('confirmPhraseInput'), wrap = el('confirmPhraseWrap');
            el('confirmTitle').textContent = title; el('confirmMessage').textContent = message; wrap.hidden = !phrase; input.value = ''; input.placeholder = phrase;
            const close = () => { dialog.removeEventListener('close', close); resolve(dialog.returnValue === 'confirm' && (!phrase || input.value.trim() === phrase)); };
            dialog.addEventListener('close', close); dialog.showModal();
        });
    }

    async function action(body, timeout) { return api('action', { method: 'POST', body: { ...body, request_id: requestId(body.action.toLowerCase()) }, timeout }); }

    async function toggleHold(button) {
        const hold = button.dataset.hold === 'true', caseId = button.dataset.caseId;
        const reason = hold ? window.prompt('ระบุเหตุผลที่เปิด Legal Hold')?.trim() : window.prompt('ระบุเหตุผลที่ปลด Legal Hold')?.trim();
        if (!reason) return; const ok = await confirmAction({ title: hold ? 'เปิด Legal Hold' : 'ปลด Legal Hold', message: `ยืนยันการเปลี่ยนสถานะเคสนี้หรือไม่? เหตุผล: ${reason}` }); if (!ok) return;
        button.disabled = true; try { await action({ action: 'SET_LEGAL_HOLD', case_id: caseId, hold, reason, confirm: true }); state.loaded.delete('retention'); state.loaded.delete('overview'); await loadRetention(true); notice('อัปเดต Legal Hold และบันทึก Audit แล้ว'); } catch (error) { notice(error.message, 'error'); } finally { button.disabled = false; }
    }

    async function runDryRun() {
        const ok = await confirmAction({ title: 'ทดลอง Storage Dry Run', message: 'ระบบจะค้นหาและคำนวณไฟล์ถึงกำหนด แต่จะไม่ลบไฟล์จริง' }); if (!ok) return;
        const button = el('runDryRunButton'); button.disabled = true; try { const result = await action({ action: 'RUN_STORAGE_DRY_RUN', confirm: true }); notice(`Dry Run สำเร็จ: ${result.due_items} ไฟล์ รวม ${formatBytes(result.due_bytes)}`); state.loaded.delete('retention'); state.loaded.delete('overview'); await loadRetention(true); } catch (error) { notice(error.message, 'error'); } finally { button.disabled = false; }
    }

    function menuConfig() {
        let areas; try { areas = JSON.parse(el('menuAreas').value); } catch { throw new Error('JSON พื้นที่ปุ่มไม่ถูกต้อง'); }
        if (!Array.isArray(areas)) throw new Error('พื้นที่ปุ่มต้องเป็น JSON Array');
        return { size: { width: 2500, height: Number(el('menuHeight').value) }, selected: true, name: el('menuName').value.trim(), chatBarText: el('menuChatBar').value.trim(), areas };
    }

    function previewMenu() {
        const file = el('menuImage').files[0]; if (!file) throw new Error('กรุณาเลือกภาพก่อน'); const configValue = menuConfig();
        const url = URL.createObjectURL(file), preview = el('menuPreview'); preview.style.aspectRatio = `2500/${configValue.size.height}`;
        preview.innerHTML = `<img src="${url}" alt="Rich Menu preview">` + configValue.areas.map((area, index) => { const b = area.bounds || {}; return `<span class="preview-area" style="left:${Number(b.x || 0) / 25}%;top:${Number(b.y || 0) / configValue.size.height * 100}%;width:${Number(b.width || 0) / 25}%;height:${Number(b.height || 0) / configValue.size.height * 100}%">${index + 1}</span>`; }).join('');
    }

    async function saveDraft(event) {
        event.preventDefault(); const file = el('menuImage').files[0]; if (!file) return notice('กรุณาเลือกภาพ', 'error');
        let configValue; try { configValue = menuConfig(); previewMenu(); } catch (error) { return notice(error.message, 'error'); }
        const submit = event.submitter; submit.disabled = true;
        try {
            const form = new FormData(); form.append('action', 'UPLOAD_RICH_MENU_IMAGE'); form.append('request_id', requestId('richmenu-upload')); form.append('file', file);
            const uploaded = await api('action', { method: 'POST', body: form, timeout: Number(config.richMenuTimeoutMs) || 30000 });
            const saved = await action({ action: 'SAVE_RICH_MENU_DRAFT', menu_config: configValue, image: uploaded.image }, Number(config.richMenuTimeoutMs) || 30000);
            notice(`บันทึก Draft version ${saved.version.version_no} แล้ว`); event.target.reset(); el('menuChatBar').value = 'เมนูหลัก'; state.loaded.delete('richmenu'); state.loaded.delete('audit'); await loadRichMenu(true);
        } catch (error) { notice(error.message, 'error'); } finally { submit.disabled = false; }
    }

    async function menuAction(button) {
        const kind = button.dataset.action, id = button.dataset.id; let body = { action: '', version_id: id };
        if (kind === 'validate') body.action = 'VALIDATE_RICH_MENU';
        if (kind === 'publish') { const ok = await confirmAction({ title: 'Publish Rich Menu ไปยัง Production', message: 'เมนูนี้จะกลายเป็น Default สำหรับผู้ใช้ทั้งหมด การเปลี่ยนแปลงจะถูกบันทึกและ Rollback ได้', phrase: 'PUBLISH_RICH_MENU' }); if (!ok) return; body = { ...body, action: 'PUBLISH_RICH_MENU', confirmation: 'PUBLISH_RICH_MENU' }; }
        if (kind === 'rollback') { const ok = await confirmAction({ title: 'Rollback Rich Menu', message: 'Default Rich Menu จะกลับไปใช้เวอร์ชันนี้', phrase: 'ROLLBACK_RICH_MENU' }); if (!ok) return; body = { ...body, action: 'ROLLBACK_RICH_MENU', confirmation: 'ROLLBACK_RICH_MENU' }; }
        button.disabled = true; try { await action(body, Number(config.richMenuTimeoutMs) || 30000); notice(`${body.action} สำเร็จ`); state.loaded.delete('richmenu'); state.loaded.delete('audit'); await loadRichMenu(true); } catch (error) { notice(error.message, 'error'); } finally { button.disabled = false; }
    }

    async function importLegacy() {
        const ok = await confirmAction({ title: 'นำเข้า Legacy Rich Menu', message: 'ระบบจะสำรองภาพและ config ของเมนูเดิมเป็น Baseline โดยไม่เปลี่ยนเมนูที่ผู้ใช้กำลังเห็น', phrase: 'IMPORT_LEGACY_RICH_MENUS' }); if (!ok) return;
        const button = el('importLegacyButton'); button.disabled = true; try { const result = await action({ action: 'IMPORT_LEGACY_RICH_MENUS', confirmation: 'IMPORT_LEGACY_RICH_MENUS' }, 60000); notice(`นำเข้า ${result.imported} จาก ${result.discovered} เมนู`); state.loaded.delete('richmenu'); state.loaded.delete('audit'); await loadRichMenu(true); } catch (error) { notice(error.message, 'error'); } finally { button.disabled = false; }
    }

    function bindEvents() {
        el('sideNavigation').addEventListener('click', (event) => { const button = event.target.closest('[data-view]'); if (button) showView(button.dataset.view); });
        document.addEventListener('click', (event) => {
            const go = event.target.closest('[data-go]'); if (go) showView(go.dataset.go);
            const hold = event.target.closest('.hold-button'); if (hold) toggleHold(hold);
            const menu = event.target.closest('.menu-action'); if (menu) menuAction(menu);
            const page = event.target.closest('[data-page]'); if (page) { state.storageOffset = Math.max(0, state.storageOffset + (page.dataset.page === 'next' ? state.storageLimit : -state.storageLimit)); loadStorage(true); }
        });
        el('refreshButton').addEventListener('click', () => { state.loaded.delete(state.active); showView(state.active, true); });
        el('retryButton').addEventListener('click', initialize);
        el('mobileMenuButton').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('is-open'));
        el('storageFilters').addEventListener('submit', (event) => { event.preventDefault(); state.storageOffset = 0; [...state.loaded].filter((key) => key.startsWith('storage:')).forEach((key) => state.loaded.delete(key)); loadStorage(true); });
        el('runDryRunButton').addEventListener('click', runDryRun);
        el('previewMenuButton').addEventListener('click', () => { try { previewMenu(); } catch (error) { notice(error.message, 'error'); } });
        el('richMenuForm').addEventListener('submit', saveDraft);
        el('importLegacyButton').addEventListener('click', importLegacy);
    }

    async function initialize() {
        el('appLoading').hidden = false; el('appError').hidden = true; el('appShell').hidden = true;
        try {
            if (!config.liffId || !config.apiUrl) throw new Error('Frontend configuration is incomplete');
            await liff.init({ liffId: config.liffId });
            if (!liff.isLoggedIn()) { liff.login({ redirectUri: window.location.href.split('#')[0] }); return; }
            state.token = liff.getAccessToken() || ''; if (!state.token) throw new Error('ไม่พบ LINE access token');
            el('loadingMessage').textContent = 'กำลังโหลดสถานะระบบ…'; const payload = await api('overview'); state.overview = payload; state.loaded.add('overview');
            el('adminName').textContent = payload.admin?.displayName || 'Safety Admin'; el('adminFallback').textContent = (payload.admin?.displayName || 'A').slice(0, 1).toUpperCase();
            if (payload.admin?.pictureUrl) { el('adminImage').src = payload.admin.pictureUrl; el('adminImage').hidden = false; el('adminFallback').hidden = true; }
            el('appLoading').hidden = true; el('appShell').hidden = false; state.loaded.delete('overview'); await loadOverview(true);
        } catch (error) {
            el('appLoading').hidden = true; el('appError').hidden = false; el('errorTitle').textContent = /Forbidden|403/.test(error.message) ? 'ไม่มีสิทธิ์เข้าถึง' : 'เปิด Control Center ไม่สำเร็จ'; el('errorMessage').textContent = error.message || 'กรุณาลองใหม่';
        }
    }

    bindEvents(); window.addEventListener('load', initialize, { once: true });
})();
