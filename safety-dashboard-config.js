/**
 * Public browser configuration. Do not place secrets in this file.
 * Replace the LIFF ID after creating the dedicated Safety Dashboard LIFF app.
 */
window.SAFETY_DASHBOARD_CONFIG = Object.freeze({
    liffId: 'REPLACE_WITH_NEW_LIFF_ID',
    apiUrl: 'https://dqsfioiqwxuxpucwwhsv.supabase.co/functions/v1/safety-admin-dashboard',
    requestTimeoutMs: 12000,
});
