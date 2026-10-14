'use strict';

const STATUS_LABELS = Object.freeze({
    AI_ANALYZED: 'รอเลือกแนวทาง',
    WAIT_CONTACT_NUMBER: 'รอข้อมูลติดต่อ',
    USER_ACTION_PENDING: 'รอเริ่มดำเนินการ',
    WAIT_CORRECTIVE_EVIDENCE: 'รอหลักฐานแก้ไข',
    USER_EVIDENCE_SUBMITTED: 'รอตรวจหลักฐาน',
    SAFETY_REVIEW_PENDING: 'รอ จป. ตรวจสอบ',
    WAIT_SAFETY_ADVICE: 'รอคำแนะนำ จป.',
    ADVICE_PENDING_USER_ACTION: 'รอผู้แจ้งดำเนินการ',
    SAFETY_ACTION_IN_PROGRESS: 'จป. กำลังดำเนินการ',
    ESCALATED_TO_SAFETY: 'ส่งต่อทีม Safety',
    AWAITING_REWARD_CODE: 'รอรหัสคะแนน',
    RESOLVED: 'ปิดสำเร็จ',
    REJECTED_NOT_HAZARD: 'ไม่ใช่เหตุอันตราย',
    CANCELLED: 'ยกเลิก',
    UNSPECIFIED: 'ไม่ระบุ',
});

const RANK_LABELS = Object.freeze({ HIGH: 'สูง', MEDIUM: 'กลาง', LOW: 'ต่ำ', UNSPECIFIED: 'ไม่ระบุ' });
const PATH_LABELS = Object.freeze({
    SELF_CORRECTION: 'ผู้แจ้งแก้ไขเอง',
    SAFETY_OFFICER: 'ทีม Safety ดำเนินการ',
    NOT_HAZARD: 'ไม่ใช่เหตุอันตราย',
    UNSPECIFIED: 'ยังไม่เลือกแนวทาง',
});
const MONTHS = Object.freeze(['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']);
const PAGE_SIZE = 10;

const state = {
    token: '',
    period: 'month',
    year: 0,
    month: 0,
    status: '',
    rank: '',
    offset: 0,
    total: 0,
    busy: false,
};

const element = (id) => document.getElementById(id);
const config = window.SAFETY_DASHBOARD_CONFIG || {};

function bangkokDateParts() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok', year: 'numeric', month: 'numeric',
    }).formatToParts(new Date());
    return {
        year: Number(parts.find((part) => part.type === 'year')?.value),
        month: Number(parts.find((part) => part.type === 'month')?.value),
    };
}

function showGateError(title, message, retry = true) {
    element('appLoading').hidden = true;
    element('appShell').hidden = true;
    element('appError').hidden = false;
    element('gateErrorTitle').textContent = title;
    element('gateErrorMessage').textContent = message;
    element('retryLoginButton').hidden = !retry;
}

function showDashboard() {
    element('appLoading').hidden = true;
    element('appError').hidden = true;
    element('appShell').hidden = false;
}

function setNotice(message = '') {
    const notice = element('pageNotice');
    notice.textContent = message;
    notice.hidden = !message;
}

function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? new Intl.NumberFormat('th-TH').format(number) : '—';
}

function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short',
    }).format(date);
}

function compact(value, maxLength = 150) {
    const text = String(value || '').trim().replace(/\s+/g, ' ');
    if (!text) return '—';
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function statusTone(status) {
    if (status === 'RESOLVED') return 'badge-success';
    if (status === 'CANCELLED' || status === 'REJECTED_NOT_HAZARD') return 'badge-muted';
    if (['WAIT_CORRECTIVE_EVIDENCE', 'SAFETY_REVIEW_PENDING'].includes(status)) return 'badge-danger';
    if (['SAFETY_ACTION_IN_PROGRESS', 'ESCALATED_TO_SAFETY'].includes(status)) return 'badge-info';
    return 'badge-warning';
}

function rankTone(rank) {
    return rank === 'HIGH' ? 'badge-danger' : rank === 'MEDIUM' ? 'badge-warning' : rank === 'LOW' ? 'badge-success' : 'badge-muted';
}

function makeBadge(label, tone) {
    const badge = document.createElement('span');
    badge.className = `badge ${tone}`;
    badge.textContent = label;
    return badge;
}

function periodParams(view) {
    const params = new URLSearchParams({ view, period: state.period, year: String(state.year) });
    if (state.period === 'month') params.set('month', String(state.month));
    return params;
}

async function apiRequest(view, extra = {}) {
    const params = periodParams(view);
    for (const [key, value] of Object.entries(extra)) {
        if (value !== '' && value !== null && value !== undefined) params.set(key, String(value));
    }
    const controller = new AbortController();
    const timeoutMs = view === 'export'
        ? Number(config.exportTimeoutMs) || 30000
        : Number(config.requestTimeoutMs) || 12000;
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${config.apiUrl}?${params}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${state.token}` },
            cache: 'no-store',
            signal: controller.signal,
        });
        if (!response.ok) {
            let detail = '';
            try { detail = String((await response.json()).error || ''); } catch (_) { /* no response body */ }
            const error = new Error(detail || `Request failed (${response.status})`);
            error.status = response.status;
            throw error;
        }
        return response;
    } finally {
        window.clearTimeout(timeout);
    }
}

function handleRequestError(error) {
    console.error('Safety Dashboard request failed', error);
    if (error?.status === 401) {
        showGateError('เซสชัน LINE หมดอายุ', 'กรุณาเข้าสู่ระบบ LINE ใหม่อีกครั้ง');
        return;
    }
    if (error?.status === 403) {
        showGateError('ไม่มีสิทธิ์เข้าถึง', 'บัญชี LINE นี้ไม่ได้อยู่ในรายชื่อ Safety Admin', false);
        return;
    }
    if (error?.status === 429) {
        setNotice('มีการเรียกข้อมูลถี่เกินไป กรุณารอประมาณ 1 นาทีแล้วลองใหม่');
        return;
    }
    setNotice(error?.name === 'AbortError' ? 'การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่' : 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
}

function setBusy(busy) {
    state.busy = busy;
    element('refreshButton').disabled = busy;
    element('exportButton').disabled = busy;
    element('yearSelect').disabled = busy;
    element('monthSelect').disabled = busy;
    element('statusFilter').disabled = busy;
    element('rankFilter').disabled = busy;
    document.querySelectorAll('.period-button').forEach((button) => { button.disabled = busy; });
}

function renderSummary(report) {
    const metrics = report?.metrics || {};
    element('metricTotal').textContent = formatNumber(metrics.total);
    element('metricOpen').textContent = formatNumber(metrics.open_now);
    element('metricOpenContext').textContent = `${formatNumber(metrics.open)} เคสสร้างในช่วงที่เลือก`;
    element('metricResolved').textContent = formatNumber(metrics.resolved);
    element('metricResolutionRate').textContent = `อัตราปิด ${formatNumber(metrics.resolution_rate)}%`;
    element('metricOverdue').textContent = formatNumber(metrics.overdue_now);
    element('metricAverageClose').textContent = metrics.average_close_hours === null ? '—' : formatNumber(metrics.average_close_hours);
    element('lastUpdated').textContent = `อัปเดต ${formatDateTime(report?.generated_at)}`;
    renderTrend(report?.trend || []);
    renderBreakdown('statusBreakdown', report?.by_status || [], STATUS_LABELS, '#145c46');
    renderBreakdown('rankBreakdown', report?.by_rank || [], RANK_LABELS, '#dc5a55');
    renderBreakdown('pathBreakdown', report?.by_resolution_path || [], PATH_LABELS, '#4f7bd9');
}

function renderTrend(items) {
    const chart = element('trendChart');
    chart.replaceChildren();
    if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'trend-empty';
        empty.textContent = 'ยังไม่มีข้อมูลแนวโน้มในช่วงนี้';
        chart.append(empty);
        return;
    }
    const max = Math.max(1, ...items.map((item) => Number(item.total) || 0));
    items.forEach((item) => {
        const column = document.createElement('div');
        column.className = 'trend-column';
        const bars = document.createElement('div');
        bars.className = 'trend-bars';
        const total = document.createElement('div');
        total.className = 'trend-bar trend-bar-total';
        total.style.height = `${Math.max(2, ((Number(item.total) || 0) / max) * 100)}%`;
        total.title = `${item.bucket}: แจ้งใหม่ ${formatNumber(item.total)}`;
        const resolved = document.createElement('div');
        resolved.className = 'trend-bar trend-bar-resolved';
        resolved.style.height = `${Math.max(2, ((Number(item.resolved) || 0) / max) * 100)}%`;
        resolved.title = `${item.bucket}: ปิดสำเร็จ ${formatNumber(item.resolved)}`;
        bars.append(total, resolved);
        const label = document.createElement('span');
        label.className = 'trend-label';
        label.textContent = String(item.bucket || '');
        column.append(bars, label);
        chart.append(column);
    });
}

function renderBreakdown(containerId, items, labels, color) {
    const container = element(containerId);
    container.replaceChildren();
    const total = items.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
    if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'panel-subtitle';
        empty.textContent = 'ยังไม่มีข้อมูลในช่วงนี้';
        container.append(empty);
        return;
    }
    items.forEach((item) => {
        const count = Number(item.count) || 0;
        const row = document.createElement('div');
        row.className = 'breakdown-row';
        const label = document.createElement('span');
        label.className = 'breakdown-label';
        label.textContent = labels[item.key] || item.key || 'ไม่ระบุ';
        label.title = label.textContent;
        const track = document.createElement('div');
        track.className = 'breakdown-track';
        const fill = document.createElement('div');
        fill.className = 'breakdown-fill';
        fill.style.width = `${total ? (count / total) * 100 : 0}%`;
        fill.style.backgroundColor = color;
        track.append(fill);
        const value = document.createElement('span');
        value.className = 'breakdown-value';
        value.textContent = formatNumber(count);
        row.append(label, track, value);
        container.append(row);
    });
}

function caseRank(item) {
    return item.confirmed_rank || item.reported_rank || 'UNSPECIFIED';
}

function appendCell(row, value, className = '') {
    const cell = document.createElement('td');
    if (className) cell.className = className;
    if (value instanceof Node) cell.append(value); else cell.textContent = String(value ?? '—');
    row.append(cell);
}

function renderCases(items, pagination) {
    const table = element('caseTableBody');
    const cards = element('caseCards');
    table.replaceChildren();
    cards.replaceChildren();
    state.total = Number(pagination?.total) || 0;
    element('caseCount').textContent = `พบ ${formatNumber(state.total)} รายการ`;
    element('emptyCases').hidden = items.length > 0;

    items.forEach((item) => {
        const rank = caseRank(item);
        const row = document.createElement('tr');
        appendCell(row, item.case_number, 'case-number');
        appendCell(row, formatDateTime(item.created_at));
        appendCell(row, makeBadge(STATUS_LABELS[item.status] || item.status, statusTone(item.status)));
        appendCell(row, makeBadge(RANK_LABELS[rank] || rank, rankTone(rank)));
        appendCell(row, compact(item.ai_finding), 'case-finding');
        appendCell(row, item.assigned_admin_uid ? `LINE …${String(item.assigned_admin_uid).slice(-6)}` : 'ยังไม่มีผู้รับเคส');
        table.append(row);

        const card = document.createElement('article');
        card.className = 'case-card';
        const header = document.createElement('div');
        header.className = 'case-card-header';
        const number = document.createElement('strong');
        number.className = 'case-number';
        number.textContent = item.case_number || 'Safety Case';
        const time = document.createElement('time');
        time.textContent = formatDateTime(item.created_at);
        header.append(number, time);
        const meta = document.createElement('div');
        meta.className = 'case-card-meta';
        meta.append(makeBadge(STATUS_LABELS[item.status] || item.status, statusTone(item.status)), makeBadge(RANK_LABELS[rank] || rank, rankTone(rank)));
        const finding = document.createElement('p');
        finding.textContent = compact(item.ai_finding, 220);
        card.append(header, meta, finding);
        cards.append(card);
    });

    const page = Math.floor(state.offset / PAGE_SIZE) + 1;
    const pages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
    element('pageLabel').textContent = `หน้า ${page} จาก ${pages}`;
    element('previousPage').disabled = state.offset <= 0 || state.busy;
    element('nextPage').disabled = state.offset + items.length >= state.total || state.busy;
}

async function loadSummary() {
    const response = await apiRequest('summary');
    const payload = await response.json();
    renderSummary(payload.report);
}

async function loadCases() {
    const response = await apiRequest('cases', {
        status: state.status, rank: state.rank, limit: PAGE_SIZE, offset: state.offset,
    });
    const payload = await response.json();
    renderCases(payload.cases || [], payload.pagination || {});
}

async function loadDashboard() {
    if (state.busy) return;
    setBusy(true);
    setNotice();
    updatePeriodDescription();
    try {
        await Promise.all([loadSummary(), loadCases()]);
    } catch (error) {
        handleRequestError(error);
    } finally {
        setBusy(false);
        element('previousPage').disabled = state.offset <= 0;
        element('nextPage').disabled = state.offset + PAGE_SIZE >= state.total;
    }
}

async function exportCases() {
    if (state.busy) return;
    setBusy(true);
    setNotice();
    try {
        const response = await apiRequest('export', {
            status: state.status, rank: state.rank, format: 'xlsx',
        });
        const blob = await response.blob();
        const disposition = response.headers.get('content-disposition') || '';
        const filename = disposition.match(/filename="([^"]+)"/)?.[1] || 'safety-cases.xlsx';
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
        if (response.headers.get('x-export-truncated') === 'true') {
            setNotice('ไฟล์ถึงขีดจำกัด 5,000 รายการ กรุณาเลือกช่วงเวลาหรือตัวกรองให้แคบลง');
        }
    } catch (error) {
        handleRequestError(error);
    } finally {
        setBusy(false);
    }
}

function updatePeriodDescription() {
    element('periodDescription').textContent = state.period === 'month'
        ? `รายงานเดือน${MONTHS[state.month - 1]} พ.ศ. ${state.year + 543}`
        : `รายงานประจำปี พ.ศ. ${state.year + 543}`;
    element('monthField').hidden = state.period === 'year';
}

function populateControls() {
    const current = bangkokDateParts();
    state.year = current.year;
    state.month = current.month;
    const yearSelect = element('yearSelect');
    for (let year = current.year + 1; year >= current.year - 5; year -= 1) {
        const option = document.createElement('option');
        option.value = String(year);
        option.textContent = `พ.ศ. ${year + 543}`;
        option.selected = year === state.year;
        yearSelect.append(option);
    }
    MONTHS.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = String(index + 1);
        option.textContent = month;
        option.selected = index + 1 === state.month;
        element('monthSelect').append(option);
    });
    Object.entries(STATUS_LABELS).filter(([key]) => key !== 'UNSPECIFIED').forEach(([key, label]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = label;
        element('statusFilter').append(option);
    });
    updatePeriodDescription();
}

function bindEvents() {
    document.querySelectorAll('.period-button').forEach((button) => {
        button.addEventListener('click', () => {
            state.period = button.dataset.period;
            state.offset = 0;
            document.querySelectorAll('.period-button').forEach((item) => {
                const active = item === button;
                item.classList.toggle('is-active', active);
                item.setAttribute('aria-pressed', String(active));
            });
            loadDashboard();
        });
    });
    element('yearSelect').addEventListener('change', (event) => { state.year = Number(event.target.value); state.offset = 0; loadDashboard(); });
    element('monthSelect').addEventListener('change', (event) => { state.month = Number(event.target.value); state.offset = 0; loadDashboard(); });
    element('statusFilter').addEventListener('change', (event) => { state.status = event.target.value; state.offset = 0; loadCases().catch(handleRequestError); });
    element('rankFilter').addEventListener('change', (event) => { state.rank = event.target.value; state.offset = 0; loadCases().catch(handleRequestError); });
    element('refreshButton').addEventListener('click', loadDashboard);
    element('exportButton').addEventListener('click', exportCases);
    element('previousPage').addEventListener('click', () => { state.offset = Math.max(0, state.offset - PAGE_SIZE); loadCases().catch(handleRequestError); });
    element('nextPage').addEventListener('click', () => { state.offset += PAGE_SIZE; loadCases().catch(handleRequestError); });
    element('retryLoginButton').addEventListener('click', () => window.location.reload());
}

async function initialize() {
    populateControls();
    bindEvents();
    if (!config.liffId || config.liffId === 'REPLACE_WITH_NEW_LIFF_ID') {
        showGateError('รอตั้งค่า LIFF ID', 'สร้าง LIFF app สำหรับ Safety Dashboard แล้วใส่รหัสในไฟล์ safety-dashboard-config.js', false);
        return;
    }
    if (!config.apiUrl || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/safety-admin-dashboard$/.test(config.apiUrl)) {
        showGateError('ตั้งค่า Backend ไม่ถูกต้อง', 'กรุณาตรวจสอบ apiUrl ใน safety-dashboard-config.js', false);
        return;
    }
    if (!window.liff) {
        showGateError('โหลด LINE LIFF ไม่สำเร็จ', 'กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
        return;
    }
    try {
        await window.liff.init({ liffId: config.liffId });
        if (!window.liff.isLoggedIn()) {
            window.liff.login({ redirectUri: window.location.href });
            return;
        }
        state.token = window.liff.getAccessToken() || '';
        if (!state.token) throw new Error('LINE access token is unavailable');
        try {
            const profile = await window.liff.getProfile();
            const displayName = String(profile?.displayName || 'Safety Admin');
            element('adminName').textContent = displayName;
            element('adminAvatar').textContent = displayName.slice(0, 1).toUpperCase();
        } catch (profileError) {
            console.warn('LINE profile is unavailable', profileError);
        }
        showDashboard();
        await loadDashboard();
    } catch (error) {
        console.error('Safety Dashboard initialization failed', error);
        showGateError('เชื่อมต่อ LINE ไม่สำเร็จ', 'กรุณาเปิดผ่าน LINE หรือเข้าสู่ระบบ LINE แล้วลองใหม่');
    }
}

window.addEventListener('DOMContentLoaded', initialize);
