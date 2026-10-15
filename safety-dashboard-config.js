/**
 * Public browser configuration. Do not place secrets in this file.
 * Public runtime settings for the dedicated Safety Dashboard LIFF app.
 */
window.SAFETY_DASHBOARD_CONFIG = Object.freeze({
    liffId: '2007053300-FmMHHcD7',
    apiUrl: 'https://dqsfioiqwxuxpucwwhsv.supabase.co/functions/v1/safety-admin-dashboard',
    portalApiUrl: 'https://dqsfioiqwxuxpucwwhsv.supabase.co/functions/v1/admin-portal-content',
    portalAssetBaseUrl: 'https://dqsfioiqwxuxpucwwhsv.supabase.co/storage/v1/object/public/admin-portal-assets/',
    requestTimeoutMs: 12000,
    exportTimeoutMs: 30000,
});
