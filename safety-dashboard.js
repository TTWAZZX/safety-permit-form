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
const EVIDENCE_LABELS = Object.freeze({ BEFORE: 'ก่อนแก้ไข', AFTER: 'หลังแก้ไข', ADDITIONAL: 'หลักฐานเพิ่มเติม' });
const REVIEW_LABELS = Object.freeze({ PENDING: 'รอตรวจ', APPROVED: 'อนุมัติแล้ว', REJECTED: 'ให้แก้ไขใหม่' });
const EVENT_LABELS = Object.freeze({
    SAFETY_CASE_CREATED: 'สร้าง Safety Case',
    SAFETY_CASE_AI_ANALYZED: 'AI วิเคราะห์เคสแล้ว',
    SAFETY_CASE_RESOLUTION_SELECTED: 'เลือกแนวทางดำเนินการ',
    SAFETY_CASE_CLAIMED: 'แอดมินรับเคส',
    SAFETY_CASE_MARKED_URGENT: 'ระบุเป็นเคสเร่งด่วน',
    SAFETY_ADVICE_SUBMITTED: 'ส่งคำแนะนำจาก Safety',
    SAFETY_EVIDENCE_SUBMITTED: 'ผู้แจ้งส่งหลักฐาน',
    SAFETY_EVIDENCE_APPROVED: 'อนุมัติหลักฐาน',
    SAFETY_EVIDENCE_REJECTED: 'ขอหลักฐานเพิ่มเติม',
    SAFETY_REWARD_ISSUED: 'ออกรหัสคะแนนและปิดเคส',
    SAFETY_CASE_CANCELLED_BY_ADMIN: 'แอดมินยกเลิกเคส',
    MANUAL_REPORTER_REMINDER_REQUESTED: 'แอดมินแจ้งเตือนผู้แจ้ง',
    MANUAL_ADMIN_NOTIFICATION_REQUESTED: 'แจ้งเตือนทีม Safety',
    CASE_CHAT_REQUESTED: 'ผู้แจ้งขอสนทนากับ Safety',
    CASE_CHAT_ACCEPTED: 'แอดมินรับการสนทนา',
    CASE_CHAT_CLOSED: 'ปิดการสนทนา',
    DASHBOARD_CLAIM: 'รับผิดชอบเคสผ่าน Dashboard',
    DASHBOARD_SET_RANK: 'ยืนยันระดับความเสี่ยง',
    DASHBOARD_SET_DUE: 'กำหนด SLA หลักฐาน',
    DASHBOARD_ADD_NOTE: 'เพิ่มบันทึกภายใน',
    DASHBOARD_SET_TAGS: 'ปรับ Tags ของเคส',
    DASHBOARD_REMIND_REPORTER: 'แจ้งเตือนผู้แจ้งจาก Dashboard',
    DASHBOARD_REQUEST_INFO: 'ขอข้อมูลเพิ่มเติมจากผู้แจ้ง',
    DASHBOARD_REQUEST_EVIDENCE: 'ขอหลักฐานเพิ่มเติมจากผู้แจ้ง',
    DASHBOARD_NOTIFY_TEAM: 'แจ้งทีม Safety จาก Dashboard',
});
const MONTHS = Object.freeze(['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']);
const PAGE_SIZE = 20;

const state = {
    token: '',
    period: 'month',
    year: 0,
    month: 0,
    status: '',
    rank: '',
    resolutionPath: '',
    search: '',
    scope: 'OPEN',
    assignment: 'ALL',
    sla: 'ALL',
    sort: 'PRIORITY',
    offset: 0,
    total: 0,
    busy: false,
    detailBusy: false,
    actionBusy: false,
    detailCaseId: '',
    detailData: null,
    detailReturnFocus: null,
    pendingActionKeys: new Map(),
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

function formatAge(hours) {
    const value = Number(hours);
    if (!Number.isFinite(value)) return '—';
    if (value < 1) return 'ไม่ถึง 1 ชม.';
    if (value < 24) return `${Math.floor(value)} ชม.`;
    return `${Math.floor(value / 24)} วัน ${Math.floor(value % 24)} ชม.`;
}

function formatSla(item) {
    if (!item.is_open) return { label: 'ปิดแล้ว', tone: 'badge-muted' };
    if (item.evidence_due_at === null || item.evidence_due_at === undefined) {
        return { label: 'ยังไม่มีกำหนด', tone: 'badge-muted' };
    }
    const hours = Number(item.due_in_hours);
    if (item.is_overdue) return { label: `เกิน ${formatAge(Math.abs(hours))}`, tone: 'badge-danger' };
    if (hours < 24) return { label: `เหลือ ${formatAge(hours)}`, tone: 'badge-warning' };
    return { label: `เหลือ ${formatAge(hours)}`, tone: 'badge-success' };
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

function emptyDetail(message) {
    const empty = document.createElement('p');
    empty.className = 'detail-empty';
    empty.textContent = message;
    return empty;
}

function appendDetailValue(container, label, value, className = '') {
    const block = document.createElement('div');
    block.className = `detail-value ${className}`.trim();
    const caption = document.createElement('span');
    caption.textContent = label;
    const content = document.createElement('strong');
    content.textContent = String(value ?? '—') || '—';
    block.append(caption, content);
    container.append(block);
    return block;
}

function appendProse(container, label, value) {
    const block = document.createElement('div');
    block.className = 'prose-block';
    const heading = document.createElement('strong');
    heading.textContent = label;
    const text = document.createElement('p');
    text.textContent = compact(value, 2000);
    block.append(heading, text);
    container.append(block);
}

function reviewTone(status) {
    if (status === 'APPROVED') return 'badge-success';
    if (status === 'REJECTED') return 'badge-danger';
    return 'badge-warning';
}

function reminderTone(status) {
    if (status === 'SENT') return 'badge-success';
    if (status === 'FAILED') return 'badge-danger';
    if (status === 'CANCELLED') return 'badge-muted';
    return 'badge-warning';
}

function renderDetailSummary(detail) {
    const item = detail.case || {};
    const hazard = detail.hazard_report || {};
    const grid = element('detailSummaryGrid');
    grid.replaceChildren();
    const rank = item.confirmed_rank || item.reported_rank || 'UNSPECIFIED';
    const sla = formatSla({
        is_open: !['RESOLVED', 'REJECTED_NOT_HAZARD', 'CANCELLED'].includes(item.status),
        evidence_due_at: item.evidence_due_at,
        due_in_hours: item.evidence_due_at ? (new Date(item.evidence_due_at).getTime() - Date.now()) / 3600000 : null,
        is_overdue: Boolean(item.evidence_due_at) && new Date(item.evidence_due_at).getTime() < Date.now(),
    });
    appendDetailValue(grid, 'ระดับความเสี่ยง', RANK_LABELS[rank] || rank, rank === 'HIGH' ? 'detail-value-danger' : '');
    appendDetailValue(grid, 'แนวทาง', PATH_LABELS[item.resolution_path] || 'ยังไม่เลือก');
    appendDetailValue(grid, 'ผู้รับผิดชอบ', item.is_mine ? 'ฉันรับผิดชอบ' : item.assigned_admin_suffix ? `LINE …${item.assigned_admin_suffix}` : 'ยังไม่มีผู้รับ');
    appendDetailValue(grid, 'SLA', sla.label, sla.tone === 'badge-danger' ? 'detail-value-danger' : '');
    appendDetailValue(grid, 'ผู้แจ้ง', hazard.reporter_name || 'ไม่ระบุ');
    appendDetailValue(grid, 'ข้อมูลติดต่อ', item.reporter_contact || 'ยังไม่มีข้อมูล');
    appendDetailValue(grid, 'วันที่แจ้ง', formatDateTime(item.created_at));
    appendDetailValue(grid, 'อัปเดตล่าสุด', formatDateTime(item.updated_at));
}

function renderDetailOverview(detail) {
    const hazard = detail.hazard_report || {};
    const item = detail.case || {};
    const hazardContainer = element('detailHazard');
    hazardContainer.replaceChildren();
    appendProse(hazardContainer, 'รายละเอียดที่แจ้ง', hazard.note);
    appendProse(hazardContainer, 'ประเภท / ความรุนแรง', [hazard.report_type, hazard.severity].filter(Boolean).join(' · '));
    appendProse(hazardContainer, 'วันที่รับรายงาน', formatDateTime(hazard.reported_at || item.created_at));
    if (hazard.has_original_line_image) appendProse(hazardContainer, 'ภาพต้นฉบับ', 'มีภาพต้นฉบับใน LINE (ดูหลักฐานที่จัดเก็บไว้ด้านล่าง)');

    const aiContainer = element('detailAi');
    aiContainer.replaceChildren();
    appendProse(aiContainer, 'สิ่งที่ตรวจพบ', item.ai_finding);
    appendProse(aiContainer, 'ความเสี่ยง', item.ai_risk);
    appendProse(aiContainer, 'คำแนะนำจาก AI', item.ai_recommendation);
    appendProse(aiContainer, 'คำแนะนำจาก Safety', item.safety_advice);
    appendProse(aiContainer, 'บันทึกการตรวจ', item.safety_review_note);
}

function createEvidenceImage(url, alt) {
    const link = document.createElement('a');
    link.className = 'evidence-image-link';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const image = document.createElement('img');
    image.src = url;
    image.alt = alt;
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    link.append(image);
    return link;
}

function renderEvidence(items) {
    const container = element('detailEvidence');
    container.replaceChildren();
    element('detailEvidenceCount').textContent = `${formatNumber(items.length)} รายการ`;
    if (!items.length) {
        container.append(emptyDetail('ยังไม่มีหลักฐานในเคสนี้'));
        return;
    }
    items.forEach((item, index) => {
        const card = document.createElement('article');
        card.className = 'evidence-card';
        if (item.image_url) card.append(createEvidenceImage(item.image_url, `${EVIDENCE_LABELS[item.evidence_kind] || 'หลักฐาน'} ${index + 1}`));
        else {
            const placeholder = document.createElement('div');
            placeholder.className = 'evidence-placeholder';
            placeholder.textContent = 'ไม่สามารถเปิดภาพได้หรือ URL หมดอายุ';
            card.append(placeholder);
        }
        const body = document.createElement('div');
        body.className = 'evidence-body';
        const heading = document.createElement('div');
        heading.className = 'evidence-heading';
        const title = document.createElement('strong');
        title.textContent = EVIDENCE_LABELS[item.evidence_kind] || item.evidence_kind || 'หลักฐาน';
        heading.append(title, makeBadge(REVIEW_LABELS[item.review_status] || item.review_status, reviewTone(item.review_status)));
        const date = document.createElement('span');
        date.textContent = `ส่ง ${formatDateTime(item.created_at)}`;
        body.append(heading, date);
        if (item.review_note) {
            const note = document.createElement('p');
            note.textContent = item.review_note;
            body.append(note);
        }
        card.append(body);
        container.append(card);
    });
}

function renderReminders(items) {
    const container = element('detailReminders');
    container.replaceChildren();
    element('detailReminderCount').textContent = `${formatNumber(items.length)} รายการ`;
    if (!items.length) {
        container.append(emptyDetail('เคสนี้ยังไม่มีประวัติ Reminder'));
        return;
    }
    items.forEach((item) => {
        const row = document.createElement('article');
        row.className = 'detail-list-row';
        const main = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = `${item.audience === 'REPORTER' ? 'ผู้แจ้ง' : 'ทีม Safety'} · ${item.reminder_type || 'ติดตามเคส'}`;
        const meta = document.createElement('span');
        meta.textContent = `${formatDateTime(item.scheduled_for)} · พยายาม ${formatNumber(item.attempts)} ครั้ง`;
        main.append(title, meta);
        row.append(main, makeBadge(item.status || 'UNKNOWN', reminderTone(item.status)));
        if (item.error_detail) {
            const error = document.createElement('p');
            error.className = 'detail-inline-error';
            error.textContent = compact(item.error_detail, 300);
            row.append(error);
        }
        container.append(row);
    });
}

function renderReward(reward) {
    const container = element('detailReward');
    container.replaceChildren();
    if (!reward) {
        container.append(emptyDetail('ยังไม่มีการออกรหัสคะแนนสำหรับเคสนี้'));
        return;
    }
    const total = document.createElement('div');
    total.className = 'reward-total';
    const label = document.createElement('span');
    label.textContent = 'คะแนนรวม';
    const value = document.createElement('strong');
    value.textContent = formatNumber(reward.total_points);
    total.append(label, value);
    container.append(total);
    appendProse(container, 'รหัส Royal Point', reward.code);
    appendProse(container, 'สถานะ', reward.status);
    appendProse(container, 'รายละเอียดคะแนน', `แจ้งเหตุ ${formatNumber(reward.report_points)} + แก้ไข ${formatNumber(reward.correction_points)} + ปิดเคส ${formatNumber(reward.resolution_bonus)} + Rank ${formatNumber(reward.rank_a_bonus)}`);
    appendProse(container, 'วันที่ออก', formatDateTime(reward.issued_at));
}

function renderChat(messages, sessions) {
    const container = element('detailChat');
    container.replaceChildren();
    element('detailChatCount').textContent = `${formatNumber(messages.length)} ข้อความ`;
    if (!messages.length) {
        const status = sessions[0]?.status ? `สถานะห้องล่าสุด: ${sessions[0].status}` : 'เคสนี้ยังไม่มีการสนทนา';
        container.append(emptyDetail(status));
        return;
    }
    messages.forEach((item) => {
        const bubble = document.createElement('article');
        bubble.className = `chat-message ${item.sender_type === 'SAFETY_ADMIN' ? 'chat-admin' : 'chat-reporter'}`;
        const sender = document.createElement('strong');
        sender.textContent = item.sender_type === 'SAFETY_ADMIN' ? (item.is_current_admin ? 'ฉัน (Safety)' : 'Safety Admin') : 'ผู้แจ้ง';
        bubble.append(sender);
        if (item.message_text) {
            const text = document.createElement('p');
            text.textContent = item.message_text;
            bubble.append(text);
        }
        if (item.image_url) bubble.append(createEvidenceImage(item.image_url, 'รูปภาพในการสนทนา'));
        if (item.message_type === 'STICKER') {
            const sticker = document.createElement('p');
            sticker.textContent = 'ส่งสติกเกอร์';
            bubble.append(sticker);
        }
        const time = document.createElement('time');
        time.textContent = formatDateTime(item.created_at);
        bubble.append(time);
        container.append(bubble);
    });
}

function readableEventDetail(detail) {
    if (!detail || typeof detail !== 'object') return '';
    return Object.entries(detail)
        .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
        .slice(0, 5)
        .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`)
        .join(' · ');
}

function renderTimeline(items) {
    const container = element('detailTimeline');
    container.replaceChildren();
    element('detailTimelineCount').textContent = `${formatNumber(items.length)} เหตุการณ์`;
    if (!items.length) {
        container.append(emptyDetail('ยังไม่มีประวัติเหตุการณ์'));
        return;
    }
    items.forEach((item) => {
        const event = document.createElement('article');
        event.className = 'timeline-event';
        const dot = document.createElement('span');
        dot.className = 'timeline-dot';
        const body = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = EVENT_LABELS[item.event_type] || String(item.event_type || '').replace(/_/g, ' ');
        const meta = document.createElement('span');
        const actor = item.actor_type === 'SAFETY_ADMIN' ? (item.is_current_admin ? 'ฉัน' : 'Safety Admin') : item.actor_type === 'REPORTER' ? 'ผู้แจ้ง' : 'ระบบ';
        meta.textContent = `${actor} · ${formatDateTime(item.created_at)}`;
        body.append(title, meta);
        if (item.from_status || item.to_status) {
            const transition = document.createElement('p');
            transition.textContent = `${STATUS_LABELS[item.from_status] || item.from_status || 'เริ่มต้น'} → ${STATUS_LABELS[item.to_status] || item.to_status || 'คงสถานะเดิม'}`;
            body.append(transition);
        }
        const detail = readableEventDetail(item.detail);
        if (detail) {
            const note = document.createElement('p');
            note.textContent = detail;
            body.append(note);
        }
        event.append(dot, body);
        container.append(event);
    });
}

function toLocalDateTimeInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const bangkok = new Date(date.getTime() + (7 * 60 * 60 * 1000));
    return bangkok.toISOString().slice(0, 16);
}

function setCaseActionNotice(message = '', tone = '') {
    const notice = element('caseActionNotice');
    notice.textContent = message;
    notice.className = `action-notice ${tone}`.trim();
    notice.hidden = !message;
}

function setCaseActionBusy(busy) {
    state.actionBusy = busy;
    element('caseActionState').textContent = busy ? 'กำลังดำเนินการ…' : 'พร้อมทำงาน';
    [
        'claimCaseButton', 'caseRankInput', 'saveCaseRankButton', 'caseDueInput',
        'saveCaseDueButton', 'clearCaseDueButton', 'caseTagsInput', 'saveCaseTagsButton',
        'caseNoteInput', 'addCaseNoteButton', 'caseMessageInput', 'remindReporterButton',
        'requestInfoButton', 'requestEvidenceButton', 'notifyTeamButton',
    ].forEach((id) => { element(id).disabled = busy; });
}

function renderInternalNotes(items) {
    const container = element('caseInternalNotes');
    container.replaceChildren();
    if (!items.length) {
        container.append(emptyDetail('ยังไม่มีบันทึกภายใน'));
        return;
    }
    items.forEach((item) => {
        const row = document.createElement('article');
        row.className = 'detail-list-row';
        const body = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = item.is_current_admin ? 'ฉัน' : `Safety Admin …${item.author_admin_suffix || ''}`;
        const note = document.createElement('span');
        note.textContent = item.note || '—';
        const time = document.createElement('span');
        time.textContent = formatDateTime(item.created_at);
        body.append(title, note, time);
        row.append(body);
        container.append(row);
    });
}

function renderActionDeliveries(items) {
    const container = element('caseActionDeliveries');
    container.replaceChildren();
    if (!items.length) {
        container.append(emptyDetail('ยังไม่มีประวัติการส่งข้อความจาก Dashboard'));
        return;
    }
    items.forEach((item) => {
        const row = document.createElement('article');
        row.className = 'detail-list-row';
        const body = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = EVENT_LABELS[`DASHBOARD_${item.action}`] || item.action;
        const meta = document.createElement('span');
        meta.textContent = `${formatDateTime(item.created_at)} · พยายาม ${formatNumber(item.attempts)} ครั้ง`;
        body.append(title, meta);
        if (item.message) {
            const message = document.createElement('span');
            message.textContent = compact(item.message, 500);
            body.append(message);
        }
        row.append(body, makeBadge(item.status || 'UNKNOWN', reminderTone(item.status === 'COMPLETED' ? 'SENT' : item.status)));
        if (item.error_detail) {
            const error = document.createElement('p');
            error.className = 'detail-inline-error';
            error.textContent = compact(item.error_detail, 300);
            row.append(error);
        }
        container.append(row);
    });
}

function renderCaseActions(detail) {
    const item = detail.case || {};
    const terminal = ['RESOLVED', 'REJECTED_NOT_HAZARD', 'CANCELLED'].includes(item.status);
    element('claimCaseButton').disabled = state.actionBusy || terminal || item.is_mine || Boolean(item.assigned_admin_suffix);
    element('claimCaseButton').textContent = item.is_mine ? 'ฉันรับเคสนี้แล้ว' : item.assigned_admin_suffix ? `มีผู้รับแล้ว …${item.assigned_admin_suffix}` : terminal ? 'เคสปิดแล้ว' : 'รับเคสนี้';
    element('caseRankInput').value = ['HIGH', 'MEDIUM', 'LOW'].includes(item.confirmed_rank) ? item.confirmed_rank : (['HIGH', 'MEDIUM', 'LOW'].includes(item.reported_rank) ? item.reported_rank : 'MEDIUM');
    element('caseDueInput').value = toLocalDateTimeInput(item.evidence_due_at);
    element('caseTagsInput').value = Array.isArray(item.tags) ? item.tags.join(', ') : '';
    ['caseRankInput', 'saveCaseRankButton', 'caseDueInput', 'saveCaseDueButton', 'clearCaseDueButton', 'remindReporterButton', 'requestInfoButton', 'requestEvidenceButton', 'notifyTeamButton']
        .forEach((id) => { element(id).disabled = state.actionBusy || terminal; });
    element('remindReporterButton').disabled = state.actionBusy || terminal || item.status !== 'WAIT_CORRECTIVE_EVIDENCE';
    renderInternalNotes(Array.isArray(detail.internal_notes) ? detail.internal_notes : []);
    renderActionDeliveries(Array.isArray(detail.action_deliveries) ? detail.action_deliveries : []);
}

async function reloadCurrentCaseDetail() {
    const caseId = state.detailCaseId;
    if (!caseId) return;
    const response = await apiRequest('detail', { case_id: caseId });
    const payload = await response.json();
    state.detailData = payload.detail || {};
    renderCaseDetail(state.detailData);
}

async function performCaseAction(action, payload = {}, options = {}) {
    if (state.actionBusy || !state.detailCaseId || !state.detailData?.case) return;
    if (options.confirmMessage && !window.confirm(options.confirmMessage)) return;
    const operationKey = `${state.detailCaseId}:${action}`;
    const idempotencyKey = state.pendingActionKeys.get(operationKey) || crypto.randomUUID();
    state.pendingActionKeys.set(operationKey, idempotencyKey);
    setCaseActionBusy(true);
    setCaseActionNotice();
    try {
        await apiAction({
            case_id: state.detailCaseId,
            action,
            idempotency_key: idempotencyKey,
            expected_updated_at: options.withStaleCheck ? state.detailData.case.updated_at : null,
            payload,
        });
        state.pendingActionKeys.delete(operationKey);
        setCaseActionNotice(options.successMessage || 'ดำเนินการสำเร็จ', 'action-notice-success');
        if (action === 'ADD_NOTE') element('caseNoteInput').value = '';
        if (['REMIND_REPORTER', 'REQUEST_INFO', 'REQUEST_EVIDENCE', 'NOTIFY_TEAM'].includes(action)) element('caseMessageInput').value = '';
        await Promise.all([reloadCurrentCaseDetail(), loadCases(), loadSummary()]);
    } catch (error) {
        if ([400, 404, 409].includes(error?.status)) state.pendingActionKeys.delete(operationKey);
        const conflict = error?.status === 409 ? 'ข้อมูลเคสเปลี่ยนไปแล้ว กรุณารีเฟรชรายละเอียดและลองอีกครั้ง' : '';
        const retry = error?.status === 502 || error?.name === 'AbortError' ? ' การกดคำสั่งเดิมอีกครั้งจะใช้รหัสเดิมและไม่ส่งซ้ำ' : '';
        setCaseActionNotice(`${conflict || error?.message || 'ดำเนินการไม่สำเร็จ'}${retry}`, 'action-notice-error');
        if ([401, 403].includes(error?.status)) handleRequestError(error);
    } finally {
        setCaseActionBusy(false);
        if (state.detailData) renderCaseActions(state.detailData);
    }
}

function renderCaseDetail(detail) {
    const item = detail.case || {};
    element('detailCaseNumber').textContent = item.case_number || 'รายละเอียด Safety Case';
    const status = element('detailStatus');
    status.className = `badge ${statusTone(item.status)}`;
    status.textContent = STATUS_LABELS[item.status] || item.status || 'ไม่ทราบสถานะ';
    element('detailUpdated').textContent = `ข้อมูล ณ ${formatDateTime(detail.generated_at)} · ทุก Action มี Audit Log`;
    renderDetailSummary(detail);
    renderDetailOverview(detail);
    renderEvidence(Array.isArray(detail.evidence) ? detail.evidence : []);
    renderReminders(Array.isArray(detail.reminders) ? detail.reminders : []);
    renderReward(detail.reward || null);
    renderChat(Array.isArray(detail.chat_messages) ? detail.chat_messages : [], Array.isArray(detail.chat_sessions) ? detail.chat_sessions : []);
    renderTimeline(Array.isArray(detail.events) ? detail.events : []);
    renderCaseActions(detail);
}

async function openCaseDetail(caseId, trigger = null) {
    if (!caseId || state.detailBusy) return;
    state.detailBusy = true;
    state.detailCaseId = caseId;
    state.detailReturnFocus = trigger || document.activeElement;
    const overlay = element('caseDetailOverlay');
    overlay.hidden = false;
    document.body.classList.add('detail-open');
    element('detailLoading').hidden = false;
    element('detailError').hidden = true;
    element('detailContent').hidden = true;
    element('detailNavigation').hidden = true;
    element('detailCaseNumber').textContent = 'กำลังโหลดรายละเอียด…';
    element('caseDetailPanel').focus();
    try {
        const response = await apiRequest('detail', { case_id: caseId });
        const payload = await response.json();
        state.detailData = payload.detail || {};
        renderCaseDetail(state.detailData);
        element('detailLoading').hidden = true;
        element('detailContent').hidden = false;
        element('detailNavigation').hidden = false;
    } catch (error) {
        console.error('Case detail request failed', error);
        element('detailLoading').hidden = true;
        const errorBox = element('detailError');
        errorBox.textContent = error?.status === 404 ? 'ไม่พบเคสนี้หรือเคสถูกย้ายแล้ว' : 'โหลดรายละเอียดเคสไม่สำเร็จ กรุณาปิดแล้วลองใหม่';
        errorBox.hidden = false;
        if ([401, 403].includes(error?.status)) handleRequestError(error);
    } finally {
        state.detailBusy = false;
    }
}

function closeCaseDetail() {
    element('caseDetailOverlay').hidden = true;
    document.body.classList.remove('detail-open');
    state.detailCaseId = '';
    state.detailData = null;
    if (state.detailReturnFocus instanceof HTMLElement) state.detailReturnFocus.focus();
    state.detailReturnFocus = null;
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

async function apiAction(body) {
    const params = new URLSearchParams({ view: 'action' });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), Number(config.actionTimeoutMs) || 35000);
    try {
        const response = await fetch(`${config.apiUrl}?${params}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${state.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            cache: 'no-store',
            signal: controller.signal,
        });
        let payload = {};
        try { payload = await response.json(); } catch (_) { /* no response body */ }
        if (!response.ok) {
            const error = new Error(String(payload.error || `Action failed (${response.status})`));
            error.status = response.status;
            error.retryable = Boolean(payload.retryable);
            throw error;
        }
        return payload;
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
    ['caseSearch', 'scopeFilter', 'assignmentFilter', 'slaFilter', 'pathFilter', 'sortFilter', 'clearFilters'].forEach((id) => {
        element(id).disabled = busy;
    });
    document.querySelectorAll('.queue-metric').forEach((button) => { button.disabled = busy; });
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

function renderAutomationHealth(health) {
    const reminders = health?.reminders || {};
    const webhooks = health?.webhooks || {};
    const scheduler = health?.scheduler || {};
    element('healthReminderDue').textContent = formatNumber(reminders.due_now);
    element('healthReminderFailed').textContent = formatNumber(reminders.failed_24h);
    element('healthWebhookFailed').textContent = formatNumber(webhooks.failed_24h);
    element('healthScheduler').textContent = scheduler.configured && scheduler.active && scheduler.cadence_ok
        ? 'ปกติ'
        : 'ต้องตรวจสอบ';

    const critical = Number(reminders.stale_leases) > 0
        || Number(reminders.exhausted) > 0
        || Number(webhooks.stale_processing) > 0
        || Number(webhooks.exhausted) > 0
        || !scheduler.configured
        || !scheduler.active
        || !scheduler.cadence_ok;
    const warning = Number(reminders.failed_24h) > 0 || Number(webhooks.failed_24h) > 0;
    const badge = element('automationHealthBadge');
    badge.className = critical
        ? 'health-badge health-danger'
        : warning
            ? 'health-badge health-warning'
            : 'health-badge health-good';
    badge.textContent = critical ? 'ต้องตรวจสอบ' : warning ? 'มีรายการสะดุด' : 'ระบบปกติ';
    element('automationHealthUpdated').textContent = `อัปเดต ${formatDateTime(health?.generated_at)} · ตรวจเฉพาะข้อมูลปฏิบัติการ ไม่แสดง secret`;
}

function renderAutomationHealthUnavailable() {
    const badge = element('automationHealthBadge');
    badge.className = 'health-badge health-warning';
    badge.textContent = 'อ่านสถานะไม่ได้';
    element('automationHealthUpdated').textContent = 'ข้อมูลเคสส่วนอื่นยังใช้งานได้ กรุณารีเฟรชเพื่อตรวจอีกครั้ง';
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

function renderQueueMetrics(metrics) {
    element('queueOpen').textContent = formatNumber(metrics?.open);
    element('queueMine').textContent = formatNumber(metrics?.mine);
    element('queueUnassigned').textContent = formatNumber(metrics?.unassigned);
    element('queueOverdue').textContent = formatNumber(metrics?.overdue);
    element('queueHighRisk').textContent = formatNumber(metrics?.high_risk);
}

function renderCases(items, pagination, metrics, generatedAt) {
    const table = element('caseTableBody');
    const cards = element('caseCards');
    table.replaceChildren();
    cards.replaceChildren();
    state.total = Number(pagination?.total) || 0;
    element('caseCount').textContent = `พบ ${formatNumber(state.total)} รายการ`;
    element('queueUpdated').textContent = `อัปเดต ${formatDateTime(generatedAt)}`;
    renderQueueMetrics(metrics);
    element('emptyCases').hidden = items.length > 0;

    items.forEach((item) => {
        const rank = caseRank(item);
        const sla = formatSla(item);
        const row = document.createElement('tr');
        row.className = 'case-row';
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        row.setAttribute('aria-label', `เปิดรายละเอียดเคส ${item.case_number || ''}`);
        appendCell(row, item.case_number, 'case-number');
        appendCell(row, formatAge(item.age_hours));
        const statusCell = document.createElement('div');
        statusCell.className = 'stacked-badges';
        statusCell.append(makeBadge(STATUS_LABELS[item.status] || item.status, statusTone(item.status)), makeBadge(RANK_LABELS[rank] || rank, rankTone(rank)));
        appendCell(row, statusCell);
        appendCell(row, makeBadge(sla.label, sla.tone));
        appendCell(row, compact(item.ai_finding), 'case-finding');
        appendCell(row, item.is_mine ? 'ฉันรับผิดชอบ' : item.assigned_admin_uid ? `LINE …${String(item.assigned_admin_uid).slice(-6)}` : 'ยังไม่มีผู้รับเคส');
        table.append(row);
        row.addEventListener('click', () => openCaseDetail(item.id, row));
        row.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openCaseDetail(item.id, row);
            }
        });

        const card = document.createElement('article');
        card.className = 'case-card';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `เปิดรายละเอียดเคส ${item.case_number || ''}`);
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
        meta.append(makeBadge(STATUS_LABELS[item.status] || item.status, statusTone(item.status)), makeBadge(RANK_LABELS[rank] || rank, rankTone(rank)), makeBadge(sla.label, sla.tone));
        const finding = document.createElement('p');
        finding.textContent = compact(item.ai_finding, 220);
        const owner = document.createElement('p');
        owner.className = 'case-card-owner';
        owner.textContent = `ผู้รับเคส: ${item.is_mine ? 'ฉันรับผิดชอบ' : item.assigned_admin_uid ? `LINE …${String(item.assigned_admin_uid).slice(-6)}` : 'ยังไม่มีผู้รับเคส'} · อายุ ${formatAge(item.age_hours)}`;
        card.append(header, meta, finding, owner);
        cards.append(card);
        card.addEventListener('click', () => openCaseDetail(item.id, card));
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openCaseDetail(item.id, card);
            }
        });
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

async function loadHealth() {
    try {
        const response = await apiRequest('health');
        const payload = await response.json();
        renderAutomationHealth(payload.health);
    } catch (error) {
        console.warn('Safety automation health request failed', error);
        renderAutomationHealthUnavailable();
    }
}

async function loadCases() {
    const response = await apiRequest('queue', {
        search: state.search,
        scope: state.scope,
        assignment: state.assignment,
        sla: state.sla,
        status: state.status,
        rank: state.rank,
        resolution_path: state.resolutionPath,
        sort: state.sort,
        limit: PAGE_SIZE,
        offset: state.offset,
    });
    const payload = await response.json();
    const queue = payload.queue || {};
    renderCases(queue.items || [], queue.pagination || {}, queue.metrics || {}, queue.generated_at);
}

async function loadDashboard() {
    if (state.busy) return;
    setBusy(true);
    setNotice();
    updatePeriodDescription();
    try {
        await Promise.all([loadSummary(), loadCases(), loadHealth()]);
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
    let searchTimer = 0;
    const refreshQueue = () => { state.offset = 0; loadCases().catch(handleRequestError); };
    const syncQuickFilter = () => {
        document.querySelectorAll('.queue-metric').forEach((button) => {
            const filter = button.dataset.quickFilter;
            const active = (filter === 'open' && state.scope === 'OPEN' && state.assignment === 'ALL' && state.sla === 'ALL' && state.rank === '')
                || (filter === 'mine' && state.assignment === 'MINE')
                || (filter === 'unassigned' && state.assignment === 'UNASSIGNED')
                || (filter === 'overdue' && state.sla === 'OVERDUE')
                || (filter === 'high' && state.rank === 'HIGH');
            button.classList.toggle('is-active', active);
        });
    };
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
    element('caseSearch').addEventListener('input', (event) => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => { state.search = event.target.value.trim(); refreshQueue(); }, 350);
    });
    element('scopeFilter').addEventListener('change', (event) => { state.scope = event.target.value; syncQuickFilter(); refreshQueue(); });
    element('assignmentFilter').addEventListener('change', (event) => { state.assignment = event.target.value; syncQuickFilter(); refreshQueue(); });
    element('slaFilter').addEventListener('change', (event) => { state.sla = event.target.value; syncQuickFilter(); refreshQueue(); });
    element('statusFilter').addEventListener('change', (event) => { state.status = event.target.value; syncQuickFilter(); refreshQueue(); });
    element('rankFilter').addEventListener('change', (event) => { state.rank = event.target.value; syncQuickFilter(); refreshQueue(); });
    element('pathFilter').addEventListener('change', (event) => { state.resolutionPath = event.target.value; refreshQueue(); });
    element('sortFilter').addEventListener('change', (event) => { state.sort = event.target.value; refreshQueue(); });
    document.querySelectorAll('.queue-metric').forEach((button) => {
        button.addEventListener('click', () => {
            state.scope = 'OPEN'; state.assignment = 'ALL'; state.sla = 'ALL'; state.rank = '';
            if (button.dataset.quickFilter === 'mine') state.assignment = 'MINE';
            if (button.dataset.quickFilter === 'unassigned') state.assignment = 'UNASSIGNED';
            if (button.dataset.quickFilter === 'overdue') state.sla = 'OVERDUE';
            if (button.dataset.quickFilter === 'high') state.rank = 'HIGH';
            element('scopeFilter').value = state.scope;
            element('assignmentFilter').value = state.assignment;
            element('slaFilter').value = state.sla;
            element('rankFilter').value = state.rank;
            syncQuickFilter(); refreshQueue();
        });
    });
    element('clearFilters').addEventListener('click', () => {
        Object.assign(state, { search: '', scope: 'OPEN', assignment: 'ALL', sla: 'ALL', status: '', rank: '', resolutionPath: '', sort: 'PRIORITY', offset: 0 });
        element('caseSearch').value = '';
        element('scopeFilter').value = state.scope;
        element('assignmentFilter').value = state.assignment;
        element('slaFilter').value = state.sla;
        element('statusFilter').value = '';
        element('rankFilter').value = '';
        element('pathFilter').value = '';
        element('sortFilter').value = state.sort;
        syncQuickFilter(); loadCases().catch(handleRequestError);
    });
    element('refreshButton').addEventListener('click', loadDashboard);
    element('exportButton').addEventListener('click', exportCases);
    element('claimCaseButton').addEventListener('click', () => performCaseAction('CLAIM', {}, { withStaleCheck: true, successMessage: 'รับผิดชอบเคสแล้ว' }));
    element('saveCaseRankButton').addEventListener('click', () => performCaseAction('SET_RANK', { rank: element('caseRankInput').value }, { withStaleCheck: true, successMessage: 'บันทึกระดับความเสี่ยงแล้ว' }));
    element('saveCaseDueButton').addEventListener('click', () => {
        const value = element('caseDueInput').value;
        if (!value) {
            setCaseActionNotice('กรุณาเลือกวันและเวลาก่อนบันทึก', 'action-notice-error');
            return;
        }
        const date = new Date(`${value}:00+07:00`);
        if (Number.isNaN(date.getTime())) {
            setCaseActionNotice('วันและเวลาไม่ถูกต้อง', 'action-notice-error');
            return;
        }
        performCaseAction('SET_DUE', { due_at: date.toISOString() }, { withStaleCheck: true, successMessage: 'บันทึกกำหนดส่งหลักฐานแล้ว' });
    });
    element('clearCaseDueButton').addEventListener('click', () => performCaseAction('SET_DUE', { due_at: null }, { withStaleCheck: true, successMessage: 'ล้างกำหนดส่งหลักฐานแล้ว' }));
    element('saveCaseTagsButton').addEventListener('click', () => {
        const tags = [...new Set(element('caseTagsInput').value.split(',').map((tag) => tag.trim()).filter(Boolean))];
        performCaseAction('SET_TAGS', { tags }, { withStaleCheck: true, successMessage: 'บันทึก Tags แล้ว' });
    });
    element('addCaseNoteButton').addEventListener('click', () => performCaseAction('ADD_NOTE', { note: element('caseNoteInput').value }, { successMessage: 'เพิ่มบันทึกภายในแล้ว' }));
    element('remindReporterButton').addEventListener('click', () => performCaseAction('REMIND_REPORTER', { message: element('caseMessageInput').value }, { confirmMessage: 'ส่งข้อความเตือนผู้แจ้งผ่าน LINE ตอนนี้หรือไม่?', successMessage: 'ส่งข้อความเตือนผู้แจ้งแล้ว' }));
    element('requestInfoButton').addEventListener('click', () => performCaseAction('REQUEST_INFO', { message: element('caseMessageInput').value }, { confirmMessage: 'ส่งคำขอข้อมูลเพิ่มเติมให้ผู้แจ้งผ่าน LINE ตอนนี้หรือไม่?', successMessage: 'ส่งคำขอข้อมูลเพิ่มเติมแล้ว' }));
    element('requestEvidenceButton').addEventListener('click', () => performCaseAction('REQUEST_EVIDENCE', { message: element('caseMessageInput').value }, { confirmMessage: 'ส่งคำขอหลักฐานเพิ่มเติมให้ผู้แจ้งผ่าน LINE ตอนนี้หรือไม่?', successMessage: 'ส่งคำขอหลักฐานเพิ่มเติมแล้ว' }));
    element('notifyTeamButton').addEventListener('click', () => performCaseAction('NOTIFY_TEAM', { message: element('caseMessageInput').value }, { confirmMessage: 'แจ้ง Safety Admin คนอื่นผ่าน LINE ตอนนี้หรือไม่?', successMessage: 'แจ้งทีม Safety แล้ว' }));
    element('previousPage').addEventListener('click', () => { state.offset = Math.max(0, state.offset - PAGE_SIZE); loadCases().catch(handleRequestError); });
    element('nextPage').addEventListener('click', () => { state.offset += PAGE_SIZE; loadCases().catch(handleRequestError); });
    element('retryLoginButton').addEventListener('click', () => window.location.reload());
    element('closeCaseDetail').addEventListener('click', closeCaseDetail);
    element('caseDetailOverlay').addEventListener('click', (event) => {
        if (event.target === element('caseDetailOverlay')) closeCaseDetail();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !element('caseDetailOverlay').hidden) closeCaseDetail();
        if (event.key === 'Tab' && !element('caseDetailOverlay').hidden) {
            const focusable = [...element('caseDetailPanel').querySelectorAll('a[href], button:not(:disabled), [tabindex="0"]')]
                .filter((item) => !item.hidden && item.getClientRects().length > 0);
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });
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
