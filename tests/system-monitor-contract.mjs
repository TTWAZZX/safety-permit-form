import { readFile } from "node:fs/promises";

const files = await Promise.all([
  readFile(new URL("../system-monitor.html", import.meta.url), "utf8"),
  readFile(new URL("../system-monitor.js", import.meta.url), "utf8"),
  readFile(new URL("../system-monitor-config.js", import.meta.url), "utf8"),
  readFile(new URL("../admin-portal.html", import.meta.url), "utf8"),
  readFile(new URL("../safety-dashboard.js", import.meta.url), "utf8"),
  readFile(new URL("../portal-module-favicon.js", import.meta.url), "utf8"),
]);
const [html, js, config, portal, dashboard, moduleBranding] = files;

for (const tab of [
  "overview",
  "storage",
  "retention",
  "line",
  "richmenu",
  "health",
  "audit",
]) {
  if (!html.includes(`data-panel="${tab}"`))
    throw new Error(`Missing dashboard panel ${tab}`);
}
for (const behavior of [
  "RUN_STORAGE_DRY_RUN",
  "SET_LEGAL_HOLD",
  "IMPORT_LEGACY_RICH_MENUS",
  "PUBLISH_RICH_MENU",
  "ROLLBACK_RICH_MENU",
  "SAVE_RICH_MENU_SET_DRAFT",
  "VALIDATE_RICH_MENU_SET",
  "PUBLISH_RICH_MENU_SET",
  "ROLLBACK_RICH_MENU_SET",
]) {
  if (!js.includes(behavior))
    throw new Error(`Missing frontend behavior ${behavior}`);
}
if (
  !portal.includes('href="system-monitor.html"') ||
  !portal.includes('data-module-id="johnny-control-center"')
) {
  throw new Error("Admin Portal entry point missing");
}
if (
  !js.includes('liffEntry.searchParams.set("target", "system-monitor")') ||
  !js.includes("window.location.replace(liffEntry.href)")
) {
  throw new Error(
    "Control Center must enter LINE authentication through the registered LIFF endpoint",
  );
}
if (
  !dashboard.includes("get('target') === 'system-monitor'") ||
  !dashboard.includes("new URL('system-monitor.html', window.location.href)")
) {
  throw new Error(
    "Safety Dashboard is missing the allowlisted Control Center LIFF bridge",
  );
}
if (
  !dashboard.includes("destination.searchParams.set('liff', '1')") ||
  !js.includes('get("liff") !== "1"')
) {
  throw new Error("Control Center LIFF bridge marker is missing");
}
for (const builderElement of [
  "menuPageTabs",
  "menuAreaGrid",
  "menuActionType",
  "previewPageTabs",
  "applyMenuJson",
]) {
  if (!html.includes(`id="${builderElement}"`))
    throw new Error(`Rich Menu visual builder is missing ${builderElement}`);
}
for (const insightElement of [
  "lineForecastCards",
  "lineAudienceCards",
  "lineChannelCards",
  "lineApiRows",
  "lineOaRows",
  "lineDataNotice",
]) {
  if (!html.includes(`id="${insightElement}"`))
    throw new Error(`LINE Operations Insights is missing ${insightElement}`);
}
for (const deliveryField of [
  "apiNarrowcast",
  "stepMessage",
  "autoResponse",
  "welcomeResponse",
  "ccAutoReply",
  "ccManualReply",
  "thirdPartyChatTool",
  "pnpNoticeMessage",
]) {
  if (!js.includes(deliveryField))
    throw new Error(`LINE Operations Insights is missing ${deliveryField}`);
}
if (!html.includes("https://profile.line-scdn.net"))
  throw new Error("LINE profile image CSP source missing");
for (const brandingMarker of [
  'data-portal-module-key="johnny-control-center"',
  'data-portal-admin-shortcut="false"',
  'data-portal-module-logo',
  'src="portal-module-favicon.js"',
  'href="portal-module-favicon.css"',
]) {
  if (!html.includes(brandingMarker))
    throw new Error(`Control Center managed branding is missing ${brandingMarker}`);
}
for (const sharedBrandingBehavior of [
  "module.icon_asset || payload?.settings?.logo_asset",
  "applyModuleLogos(asset, module.display_name)",
  "dataset.portalAdminShortcut !== 'false'",
]) {
  if (!moduleBranding.includes(sharedBrandingBehavior))
    throw new Error(`Shared module branding is missing ${sharedBrandingBehavior}`);
}
for (const profileBehavior of [
  "renderAdminProfile(payload.admin)",
  "image.onerror",
  'candidate.protocol === "https:"',
  'image.removeAttribute("src")',
]) {
  if (!js.includes(profileBehavior))
    throw new Error(
      `Control Center profile fallback is missing ${profileBehavior}`,
    );
}
if (js.includes("liff.login({ redirectUri: window.location.href")) {
  throw new Error(
    "Control Center must not request an unregistered LIFF callback URL",
  );
}
for (const secret of [
  "SERVICE_ROLE",
  "CHANNEL_ACCESS_TOKEN",
  "cleanup_secret",
]) {
  if (html.includes(secret) || js.includes(secret) || config.includes(secret))
    throw new Error(`Frontend contains forbidden secret marker ${secret}`);
}
if (!config.includes("/functions/v1/johnny-control-center"))
  throw new Error("Control Center API config missing");
console.log("PASS System Monitor frontend integration contract");
