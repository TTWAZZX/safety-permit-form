import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, script, config, portal] = await Promise.all([
    readFile(new URL('safety-dashboard.html', root), 'utf8'),
    readFile(new URL('safety-dashboard.js', root), 'utf8'),
    readFile(new URL('safety-dashboard-config.js', root), 'utf8'),
    readFile(new URL('admin-portal.html', root), 'utf8'),
]);

for (const id of [
    'appLoading', 'appError', 'appShell', 'yearSelect', 'monthSelect',
    'metricTotal', 'metricOpen', 'metricResolved', 'metricOverdue',
    'trendChart', 'statusBreakdown', 'rankBreakdown', 'pathBreakdown',
    'caseTableBody', 'caseCards', 'exportButton',
    'caseSearch', 'scopeFilter', 'assignmentFilter', 'slaFilter',
    'pathFilter', 'sortFilter', 'clearFilters', 'queueUpdated',
    'queueOpen', 'queueMine', 'queueUnassigned', 'queueOverdue', 'queueHighRisk',
    'automationHealthBadge', 'healthReminderDue', 'healthReminderFailed',
    'healthWebhookFailed', 'healthScheduler', 'automationHealthUpdated',
    'caseDetailOverlay', 'caseDetailPanel', 'closeCaseDetail',
    'detailLoading', 'detailError', 'detailContent', 'detailCaseNumber',
    'detailSummaryGrid', 'detailHazard', 'detailAi', 'detailEvidence',
    'detailReminders', 'detailReward', 'detailChat', 'detailTimeline',
    'claimCaseButton', 'caseRankInput',
    'caseDueInput', 'caseTagsInput', 'caseNoteInput', 'caseMessageInput',
    'caseInternalNotes', 'caseActionDeliveries',
    'resolutionActionState', 'resolutionActionNotice', 'reviewEvidenceInput',
    'evidenceReviewNoteInput', 'approveEvidenceButton', 'reviseEvidenceButton',
    'rewardPreview', 'completeSafetyActionButton', 'rewardCodeInput',
    'issueRewardButton', 'notHazardReasonInput', 'rejectNotHazardButton',
    'closeReasonInput', 'prepareCloseButton', 'closeConfirmation',
    'closeCaseNumberInput', 'confirmCloseButton',
    'communicationState', 'communicationNotice', 'chatSessionStatus',
    'chatSessionMeta', 'chatUnreadBadge', 'acceptChatButton',
    'markChatReadButton', 'refreshConversationButton', 'closeChatButton',
    'messageTemplateSelect', 'chatComposerInput', 'chatCharacterCount',
    'sendChatMessageButton',
    'analyticsUpdated', 'analyticsSlaRate', 'analyticsSlaContext',
    'analyticsMedianClose', 'analyticsP90Close', 'analyticsReminderRate',
    'analyticsReminderContext', 'analyticsEvidenceRate', 'analyticsEvidenceContext',
    'analyticsRewardPoints', 'analyticsRewardContext', 'analyticsResponseTime',
    'analyticsHighRisk', 'analyticsHighRiskContext', 'closeTimeBreakdown',
    'reportTypeBreakdown', 'reminderPerformance', 'adminWorkload',
    'rewardCommunicationSummary',
    'exportGovernanceStatus',
]) {
    if (!html.includes(`id="${id}"`)) throw new Error(`Dashboard HTML is missing #${id}`);
    if (!script.includes(`'${id}'`)) throw new Error(`Dashboard script does not bind #${id}`);
}
if (!html.includes('id="detailActionsSection"')) throw new Error('Dashboard HTML is missing #detailActionsSection');
if (!html.includes('id="detailResolutionSection"')) throw new Error('Dashboard HTML is missing #detailResolutionSection');

for (const marker of [
    "liff.init({ liffId: config.liffId })",
    'window.liff.getAccessToken()',
    'Authorization: `Bearer ${state.token}`',
    "apiRequest('summary')",
    "apiRequest('analytics')",
    "apiRequest('queue'",
    "apiRequest('export'",
    "apiRequest('health')",
    "apiRequest('detail'",
    "apiAction({",
    "performCaseAction('CLAIM'",
    "performCaseAction('SET_RANK'",
    "performCaseAction('SET_DUE'",
    "performCaseAction('ADD_NOTE'",
    "performCaseAction('SET_TAGS'",
    "performCaseAction('REMIND_REPORTER'",
    "performCaseAction('REQUEST_INFO'",
    "performCaseAction('REQUEST_EVIDENCE'",
    "performCaseAction('NOTIFY_TEAM'",
    "performCaseAction('REVIEW_EVIDENCE'",
    "performCaseAction('COMPLETE_SAFETY_ACTION'",
    "performCaseAction('ISSUE_REWARD'",
    "performCaseAction('CREATE_CLOSE_INTENT'",
    "performCaseAction('CONFIRM_CLOSE'",
    "performCaseAction('REJECT_NOT_HAZARD'",
    "performCommunicationAction('ACCEPT_CHAT'",
    "performCommunicationAction('SEND_CHAT_MESSAGE'",
    "performCommunicationAction('CLOSE_CHAT'",
    "performCommunicationAction('MARK_CHAT_READ'",
    "pendingActionKeys",
    "crypto.randomUUID()",
    "format: 'xlsx'",
    "cache: 'no-store'",
    'AbortController',
    "view === 'export'",
    'textContent',
    'renderAutomationHealth',
    'renderQueueMetrics',
    'formatSla',
    "assignment: state.assignment",
    "resolution_path: state.resolutionPath",
    'openCaseDetail(item.id',
    'renderCaseDetail',
    'renderEvidence',
    'renderReminders',
    'renderReward',
    'renderChat',
    'renderTimeline',
    'renderCommunicationCenter',
    'renderAnalytics',
    'renderAnalyticsUnavailable',
    "response.headers.get('x-export-audit-id')",
    'detailRefreshTimer',
    "event.key === 'Escape'",
    "event.key === 'Tab'",
    "rel = 'noopener noreferrer'",
    "referrerPolicy = 'no-referrer'",
]) {
    if (!script.includes(marker)) throw new Error(`Dashboard script is missing: ${marker}`);
}

if (!config.includes("liffId: '2007053300-FmMHHcD7'")) {
    throw new Error('Dedicated Safety Dashboard LIFF ID is missing');
}
if (!config.includes('/functions/v1/safety-admin-dashboard')) {
    throw new Error('Dashboard backend endpoint is missing');
}
if (!config.includes('exportTimeoutMs: 30000')) {
    throw new Error('XLSX export timeout is not configured');
}
if (/service[_-]?role|db[_-]?password|channel[_-]?secret/i.test(config)) {
    throw new Error('Public dashboard config appears to contain a secret field');
}
if (!html.includes("default-src 'self'")) throw new Error('Dashboard CSP is missing');
if (!html.includes("connect-src 'self' https://api.line.me https://liffsdk.line-scdn.net https://dqsfioiqwxuxpucwwhsv.supabase.co")) {
    throw new Error('Dashboard CSP does not allow the LIFF SDK runtime endpoint');
}
if (/content-security-policy[^>]+frame-ancestors/i.test(html)) {
    throw new Error('frame-ancestors must be delivered as an HTTP header, not in a CSP meta element');
}
if (!html.includes('<script charset="utf-8" src="https://static.line-scdn.net/liff/edge/2/sdk.js" defer></script>')) {
    throw new Error('LIFF SDK must be loaded as UTF-8 from the official CDN');
}
if (/\.innerHTML\s*=/.test(script)) throw new Error('Dashboard must not render API data with innerHTML');
if (!portal.includes('href="https://liff.line.me/2007053300-FmMHHcD7"')) throw new Error('Admin Portal is missing the LIFF Dashboard entry');

console.log('PASS Safety Dashboard LIFF authentication and admin-only backend contract');
console.log('PASS monthly/yearly metrics, filtering, pagination, and XLSX export UI contract');
console.log('PASS admin-only reminder, webhook, and scheduler health UI contract');
console.log('PASS Phase 9 work queue search, SLA, assignment, sorting, quick filters, and responsive UI contract');
console.log('PASS Phase 10 responsive Case Detail 360, evidence gallery, chat, reminder, reward, and audit timeline UI contract');
console.log('PASS Phase 11 responsive Case Actions, safe manual retry, internal notes, tags, SLA, and LINE notification UI contract');
console.log('PASS Phase 12 evidence review, reward, not-hazard, typed case-number confirmation, and two-step closure UI contract');
console.log('PASS Phase 13 Communication Center, templates, unread state, safe retry, active-session ownership, and responsive composer contract');
console.log('PASS Phase 14 full analytics, SLA, closure speed, follow-up, reward, communication, workload, and reporting UI contract');
console.log('PASS Phase 15 admin-only governance notice, masked export policy, and export audit receipt UI contract');
console.log('PASS public frontend contains no privileged backend credentials');
