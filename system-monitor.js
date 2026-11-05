(() => {
  "use strict";

  const config = window.JOHNNY_CONTROL_CONFIG || {};
  const emptyActions = () => Array.from({ length: 9 }, () => null);
  const state = {
    token: "",
    active: "overview",
    loaded: new Set(),
    overview: null,
    storageOffset: 0,
    storageLimit: 40,
    image: null,
    menuPageIndex: 0,
    menuAreaIndex: 0,
    previewPageIndex: 0,
    menuPages: [
      {
        page_key: "page-1",
        alias_id: "page-1",
        name: "Menu Page 1",
        chatBarText: "เมนูหลัก",
        height: 1686,
        file: null,
        objectUrl: "",
        actions: [
          {
            type: "uri",
            label: "Report 1",
            uri: "https://liff.line.me/2007053300-s20OjYXq",
          },
          null,
          {
            type: "richmenuswitch",
            label: "ไปหน้า 2",
            richMenuAliasId: "page-2",
            data: "switch_to_p2",
          },
          {
            type: "uri",
            label: "Report 2",
            uri: "https://dev.tshpcl.com/safety/tsh-safety-core/",
          },
          null,
          null,
          { type: "message", label: "Admin", text: "คุยกับแอดมิน" },
          {
            type: "uri",
            label: "LIFF 1",
            uri: "https://liff.line.me/2007053300-9xLKdwZp",
          },
          {
            type: "uri",
            label: "LIFF 2",
            uri: "https://liff.line.me/2007053300-QoEvbXyn",
          },
        ],
      },
      {
        page_key: "page-2",
        alias_id: "page-2",
        name: "Menu Page 2",
        chatBarText: "กิจกรรม",
        height: 1686,
        file: null,
        objectUrl: "",
        actions: [
          {
            type: "richmenuswitch",
            label: "กลับหน้า 1",
            richMenuAliasId: "page-1",
            data: "switch_to_p1",
          },
          ...Array.from({ length: 8 }, () => ({
            type: "uri",
            label: "Activity",
            uri: "https://liff.line.me/2007053300-JTSerFbF",
          })),
        ],
      },
    ],
  };
  const titles = {
    overview: "ภาพรวมระบบ",
    storage: "Storage Explorer",
    retention: "Retention & Legal Hold",
    line: "LINE Message Usage",
    richmenu: "Rich Menu Studio",
    health: "System Health",
    audit: "Audit Log",
  };
  const el = (id) => document.getElementById(id);
  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>'"]/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[char],
    );
  const formatBytes = (bytes) => {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1073741824) return `${(value / 1048576).toFixed(2)} MB`;
    return `${(value / 1073741824).toFixed(2)} GB`;
  };
  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleString("th-TH", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";
  const daysUntil = (value) =>
    value
      ? Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)
      : null;
  const requestId = (prefix) =>
    `${prefix}:${Date.now()}:${crypto.randomUUID()}`;

  function notice(message, type = "info") {
    const node = el("pageNotice");
    node.textContent = message;
    node.className = `notice${type === "error" ? " error" : ""}`;
    node.hidden = false;
    window.setTimeout(() => {
      if (node.textContent === message) node.hidden = true;
    }, 7000);
  }

  function renderAdminProfile(admin = {}) {
    const displayName =
      String(admin.displayName || "Safety Admin").trim() || "Safety Admin";
    const image = el("adminImage");
    const fallback = el("adminFallback");
    let pictureUrl = "";
    try {
      const candidate = new URL(String(admin.pictureUrl || ""));
      if (candidate.protocol === "https:") pictureUrl = candidate.href;
    } catch (_) {
      /* keep the text fallback */
    }

    el("adminName").textContent = displayName;
    fallback.textContent = displayName.slice(0, 1).toUpperCase();
    fallback.hidden = false;
    image.hidden = true;
    image.removeAttribute("src");
    image.onload = () => {
      image.hidden = false;
      fallback.hidden = true;
    };
    image.onerror = () => {
      image.hidden = true;
      fallback.hidden = false;
      image.removeAttribute("src");
    };
    if (pictureUrl) image.src = pictureUrl;
  }

  async function api(view, options = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      options.timeout || Number(config.requestTimeoutMs) || 15000,
    );
    const url = new URL(config.apiUrl);
    url.searchParams.set("view", view);
    Object.entries(options.params || {}).forEach(([key, value]) => {
      if (value !== "" && value != null) url.searchParams.set(key, value);
    });
    try {
      const response = await fetch(url, {
        method: options.method || "GET",
        headers: {
          Authorization: `Bearer ${state.token}`,
          Accept: "application/json",
          ...(options.body instanceof FormData
            ? {}
            : options.body
              ? { "Content-Type": "application/json" }
              : {}),
        },
        body:
          options.body instanceof FormData
            ? options.body
            : options.body
              ? JSON.stringify(options.body)
              : undefined,
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      let payload = {};
      try {
        payload = await response.json();
      } catch {
        /* handled below */
      }
      if (!response.ok)
        throw new Error(payload.error || `HTTP ${response.status}`);
      return payload;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function setGlobalStatus(ok, detail) {
    el("globalStatus").textContent = ok ? "ระบบพร้อมใช้งาน" : "ต้องตรวจสอบระบบ";
    el("globalUpdated").textContent =
      detail || `อัปเดต ${new Date().toLocaleTimeString("th-TH")}`;
    el("globalStatusDot").className = `status-dot ${ok ? "ok" : "bad"}`;
  }

  function metric(label, value, detail, level = "") {
    return `<article class="metric-card ${level}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><span>${escapeHtml(detail || "")}</span></article>`;
  }

  function alertLevel(percent) {
    return percent >= 95
      ? "danger"
      : percent >= 85
        ? "danger"
        : percent >= 70
          ? "warn"
          : "";
  }

  async function loadOverview(force = false) {
    if (!force && state.loaded.has("overview")) return;
    el("overviewCards").innerHTML = metric(
      "กำลังโหลด",
      "…",
      "อ่านข้อมูล Production",
    );
    const payload = await api("overview");
    state.overview = payload;
    state.loaded.add("overview");
    const data = payload.overview || {},
      storage = data.storage || {},
      retention = data.retention || {};
    const quota = Number(payload.storage_quota_bytes || 0),
      used = Number(storage.total_bytes || 0),
      percent = quota ? (used / quota) * 100 : 0;
    el("dryRunBadge").textContent = payload.cleanup_dry_run
      ? "✓ Storage Cleanup: DRY RUN"
      : "⚠ Storage Cleanup: LIVE";
    el("overviewCards").innerHTML = [
      metric(
        "Storage ทั้งหมด",
        formatBytes(used),
        `${percent.toFixed(1)}% ของ ${formatBytes(quota)}`,
        alertLevel(percent),
      ),
      metric(
        "Safety Evidence",
        `${Number(storage.safety_objects || 0).toLocaleString("th-TH")} รูป`,
        formatBytes(storage.safety_bytes),
      ),
      metric(
        "ใกล้ลบภายใน 7 วัน",
        Number(retention.due_7d || 0).toLocaleString("th-TH"),
        `เลยกำหนด ${Number(retention.due_count || 0)} รายการ`,
        Number(retention.due_count || 0) ? "warn" : "",
      ),
      metric(
        "Legal Hold",
        Number(data.legal_hold_count || 0).toLocaleString("th-TH"),
        "เคสที่ระงับการลบ",
      ),
      metric(
        "Cleanup Failed",
        Number(retention.failed_count || 0).toLocaleString("th-TH"),
        `กำลังประมวลผล ${Number(retention.processing_count || 0)}`,
        Number(retention.failed_count || 0) ? "danger" : "",
      ),
      metric(
        "Rich Menu Versions",
        Number(data.rich_menu?.version_count || 0).toLocaleString("th-TH"),
        `Draft ${Number(data.rich_menu?.draft_count || 0)}`,
      ),
      metric(
        "Tracked Evidence",
        formatBytes(retention.tracked_bytes),
        `${Number(retention.active_count || 0)} รายการ active`,
      ),
      metric(
        "Cleanup ล่าสุด",
        data.last_cleanup_event?.event_type || "ยังไม่มีข้อมูล",
        formatDate(data.last_cleanup_event?.created_at),
      ),
    ].join("");
    const buckets = Array.isArray(storage.buckets) ? storage.buckets : [];
    el("bucketUsage").innerHTML = buckets.length
      ? buckets
          .map(
            (bucket) =>
              `<div class="bucket-row"><strong>${escapeHtml(bucket.bucket_id)}</strong><div class="progress"><span style="width:${Math.min(100, (Number(bucket.byte_size || 0) / Math.max(used, 1)) * 100)}%"></span></div><span>${formatBytes(bucket.byte_size)} · ${Number(bucket.object_count).toLocaleString("th-TH")}</span></div>`,
          )
          .join("")
      : '<div class="empty">ยังไม่มีไฟล์ใน Storage</div>';
    el("upcomingSummary").innerHTML = [
      ["เลยกำหนดแล้ว", retention.due_count, "danger"],
      ["ภายใน 1 วัน", retention.due_1d, "warning"],
      ["ภายใน 3 วัน", retention.due_3d, ""],
      ["ภายใน 7 วัน", retention.due_7d, ""],
    ]
      .map(
        ([label, value, badge]) =>
          `<div class="summary-row"><strong>${label}</strong><span></span><span class="badge ${badge}">${Number(value || 0).toLocaleString("th-TH")} รายการ</span></div>`,
      )
      .join("");
    const warnings = [];
    if (percent >= 70) warnings.push(`Storage ใช้ ${percent.toFixed(1)}% แล้ว`);
    if (Number(retention.failed_count || 0))
      warnings.push(`มี Cleanup ล้มเหลว ${retention.failed_count} รายการ`);
    if (!payload.cleanup_dry_run)
      warnings.push("ระบบลบไฟล์จริงอยู่ในโหมด LIVE");
    el("alertStrip").hidden = !warnings.length;
    el("alertStrip").textContent = warnings.join(" · ");
    setGlobalStatus(
      !Number(retention.failed_count || 0),
      `อัปเดต ${formatDate(data.generated_at)}`,
    );
  }

  async function loadStorage(force = false) {
    if (!force && state.loaded.has(`storage:${state.storageOffset}`)) return;
    el("storageGrid").innerHTML =
      '<div class="empty">กำลังโหลดรูปที่ได้รับอนุญาต…</div>';
    const payload = await api("storage", {
      params: {
        limit: state.storageLimit,
        offset: state.storageOffset,
        status: el("storageStatus").value,
        search: el("storageSearch").value.trim(),
      },
    });
    state.loaded.add(`storage:${state.storageOffset}`);
    const items = payload.items || [];
    el("storageSummary").textContent =
      `พบ ${Number(payload.total || 0).toLocaleString("th-TH")} ไฟล์ · Signed URL มีอายุ 10 นาที`;
    el("storageGrid").innerHTML = items.length
      ? items
          .map(
            (item) =>
              `<article class="media-card">${item.image_url ? `<a href="${escapeHtml(item.image_url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(item.image_url)}" loading="lazy" alt="หลักฐาน ${escapeHtml(item.case_number || "")}"></a>` : '<div class="image-placeholder">ไม่มี Preview</div>'}<div class="media-copy"><span class="badge ${item.status === "FAILED" ? "failed" : ""}">${escapeHtml(item.status)}</span><h3>${escapeHtml(item.case_number || item.source_kind || "ไม่ผูกเคส")}</h3><div class="media-meta"><span>${escapeHtml(item.source_kind)} · ${formatBytes(item.byte_size)}</span><span>อัปโหลด ${formatDate(item.object_created_at)}</span><span>กำหนดลบ ${formatDate(item.retain_until)}</span>${item.legal_hold ? "<span>🔒 Legal Hold</span>" : ""}</div></div></article>`,
          )
          .join("")
      : '<div class="empty">ไม่พบไฟล์ตามตัวกรอง</div>';
    const total = Number(payload.total || 0),
      page = Math.floor(state.storageOffset / state.storageLimit) + 1;
    el("storagePagination").innerHTML =
      `<button class="button ghost" data-page="prev" ${state.storageOffset === 0 ? "disabled" : ""}>← ก่อนหน้า</button><span>หน้า ${page}</span><button class="button ghost" data-page="next" ${state.storageOffset + state.storageLimit >= total ? "disabled" : ""}>ถัดไป →</button>`;
  }

  async function loadRetention(force = false) {
    if (!force && state.loaded.has("retention")) return;
    el("retentionRows").innerHTML = '<tr><td colspan="7">กำลังโหลด…</td></tr>';
    const payload = await api("retention");
    state.loaded.add("retention");
    const items = payload.retention?.items || [];
    const due = items.filter(
      (item) => item.retain_until && new Date(item.retain_until) <= new Date(),
    ).length;
    el("retentionStats").innerHTML = [
      metric("รายการทั้งหมด", items.length, "ไม่รวมที่ลบแล้ว"),
      metric("เลยกำหนด", due, "Dry Run ยังไม่ลบ", due ? "warn" : ""),
      metric(
        "Failed",
        items.filter((item) => item.status === "FAILED").length,
        "ตรวจ retry",
      ),
      metric(
        "Legal Hold",
        items.filter((item) => item.legal_hold).length,
        "ระงับการลบ",
      ),
      metric(
        "โหมด Cleanup",
        payload.cleanup_dry_run ? "DRY RUN" : "LIVE",
        payload.cleanup_dry_run ? "ปลอดภัย: ไม่ลบไฟล์" : "ลบไฟล์จริง",
        payload.cleanup_dry_run ? "" : "danger",
      ),
    ].join("");
    el("retentionRows").innerHTML = items.length
      ? items
          .map((item) => {
            const days = daysUntil(item.retain_until);
            return `<tr><td data-label="เคส"><strong>${escapeHtml(item.case_number || "—")}</strong></td><td data-label="ประเภท">${escapeHtml(item.source_kind)}</td><td data-label="สถานะ"><span class="badge ${item.status === "FAILED" ? "failed" : ""}">${escapeHtml(item.status)}</span></td><td data-label="ขนาด">${formatBytes(item.byte_size)}</td><td data-label="กำหนดลบ">${formatDate(item.retain_until)}<br><small>${days == null ? "" : days < 0 ? `เลย ${Math.abs(days)} วัน` : `เหลือ ${days} วัน`}</small></td><td data-label="Legal Hold">${item.legal_hold ? "🔒 เปิด" : "—"}</td><td data-label="ดำเนินการ">${item.case_id ? `<button class="button ghost hold-button" data-case-id="${escapeHtml(item.case_id)}" data-hold="${item.legal_hold ? "false" : "true"}">${item.legal_hold ? "ปลด Hold" : "เปิด Hold"}</button>` : "—"}</td></tr>`;
          })
          .join("")
      : '<tr><td colspan="7" class="empty">ไม่มีรายการ Retention</td></tr>';
  }

  async function loadLine(force = false) {
    if (!force && state.loaded.has("line")) return;
    el("lineQuotaPanel").textContent = "กำลังอ่านข้อมูลจาก LINE…";
    const payload = await api("line-usage");
    state.loaded.add("line");
    const limit = Number(payload.quota?.value || 0),
      used = Number(payload.consumption?.totalUsage || 0),
      percent = payload.percentage == null ? null : Number(payload.percentage);
    el("lineQuotaPanel").innerHTML =
      `<div class="quota-number"><div><small>ใช้ไปแล้วในเดือนนี้</small><strong>${used.toLocaleString("th-TH")} / ${limit ? limit.toLocaleString("th-TH") : "ไม่จำกัด"}</strong></div><span>${percent == null ? "Unlimited" : `${percent.toFixed(1)}%`}</span></div><div class="quota-bar"><span style="width:${Math.min(100, percent || 0)}%;${percent >= 95 ? "background:#d64545" : percent >= 85 ? "background:#e58d1b" : ""}"></span></div><p>${percent != null && percent >= 70 ? `⚠ ถึงระดับแจ้งเตือน ${percent >= 95 ? "95%" : percent >= 85 ? "85%" : "70%"}` : "สถานะการใช้งานปกติ"} · Reply message ไม่ถูกนับในโควตาแบบเดียวกับ Push/Broadcast</p>`;
    el("lineDailyRows").innerHTML = (payload.daily || [])
      .map(
        (day) =>
          `<tr><td data-label="วันที่ (LINE/JST)">${escapeHtml(day.date)}</td><td data-label="Reply">${Number(day.apiReply || 0).toLocaleString("th-TH")}</td><td data-label="Push">${Number(day.apiPush || 0).toLocaleString("th-TH")}</td><td data-label="Broadcast">${Number(day.apiBroadcast || 0).toLocaleString("th-TH")}</td><td data-label="Multicast">${Number(day.apiMulticast || 0).toLocaleString("th-TH")}</td><td data-label="สถานะ"><span class="badge ${day.status !== "ready" ? "warning" : ""}">${escapeHtml(day.status || "unknown")}</span></td></tr>`,
      )
      .join("");
  }

  function versionCard(item, legacy = false) {
    const status = legacy
      ? item.is_default
        ? "DEFAULT LEGACY"
        : "LEGACY"
      : item.status;
    const actions = legacy
      ? ""
      : `<div class="version-actions">${["DRAFT", "FAILED"].includes(item.status) ? `<button class="button ghost menu-action" data-action="validate" data-id="${item.id}">Validate</button>` : ""}${["VALIDATED", "DRAFT"].includes(item.status) ? `<button class="button primary menu-action" data-action="publish" data-id="${item.id}">Publish</button>` : ""}${item.line_rich_menu_id && item.status !== "PUBLISHED" ? `<button class="button warning menu-action" data-action="rollback" data-id="${item.id}">Rollback</button>` : ""}</div>`;
    return `<article class="version-card">${item.image_url ? `<img src="${escapeHtml(item.image_url)}" loading="lazy" alt="${escapeHtml(item.name)}">` : ""}<div class="version-card-copy"><span class="badge ${status.includes("FAILED") ? "failed" : ""}">${escapeHtml(status)}</span><h4>${escapeHtml(item.name || `Rich Menu ${item.richMenuId?.slice(-8) || ""}`)}</h4><p>${legacy ? `LINE ID ${escapeHtml(item.richMenuId || "")}` : `Version ${item.version_no} · Revision ${item.revision}`}</p><p>${legacy ? (item.is_default ? "กำลังเป็น Default ปัจจุบัน" : "ค้นพบจาก LINE API") : `เผยแพร่ ${formatDate(item.published_at)}`}</p>${legacy && item.aliases?.length ? `<p>Alias: ${item.aliases.map(escapeHtml).join(", ")}</p>` : ""}${actions}</div></article>`;
  }

  function menuSetCard(item) {
    const status = String(item.status || "DRAFT");
    const pages = Array.isArray(item.pages) ? item.pages : [];
    const actions = `<div class="version-actions">${["DRAFT", "FAILED"].includes(status) ? `<button class="button ghost menu-set-action" data-action="validate" data-id="${item.id}">Validate ทั้งชุด</button>` : ""}${status === "VALIDATED" ? `<button class="button primary menu-set-action" data-action="publish" data-id="${item.id}">Publish ทั้งชุด</button>` : ""}${status === "ARCHIVED" && pages.every((page) => page.line_rich_menu_id) ? `<button class="button warning menu-set-action" data-action="rollback" data-id="${item.id}">Rollback ทั้งชุด</button>` : ""}</div>`;
    return `<article class="version-card"><div class="version-card-copy"><span class="badge ${status === "FAILED" ? "failed" : ""}">${escapeHtml(status)}</span><h4>${escapeHtml(item.name)}</h4><p>Set version ${Number(item.version_no || 0)} · ${pages.length} หน้า · เริ่มที่ ${escapeHtml(item.default_page_key)}</p>${pages.map((page) => `<p><strong>${escapeHtml(page.page_key)}</strong> · Alias ${escapeHtml(page.alias_id)}${page.line_rich_menu_id ? " · พร้อมใน LINE" : ""}</p>`).join("")}<p>เผยแพร่ ${formatDate(item.published_at)}</p>${actions}</div></article>`;
  }

  async function loadRichMenu(force = false) {
    if (!force && state.loaded.has("richmenu")) return;
    el("managedMenus").textContent = "กำลังโหลด…";
    el("legacyMenus").textContent = "กำลังตรวจเมนูเดิมจาก LINE…";
    const payload = await api("rich-menu", {
      timeout: Number(config.richMenuTimeoutMs) || 30000,
    });
    state.loaded.add("richmenu");
    const sets = Array.isArray(payload.managed_sets)
      ? payload.managed_sets
      : [];
    const legacyManaged = Array.isArray(payload.managed) ? payload.managed : [];
    el("managedMenus").innerHTML =
      sets.length || legacyManaged.length
        ? sets.map(menuSetCard).join("") +
          legacyManaged.map((item) => versionCard(item)).join("")
        : '<div class="empty">ยังไม่มีเวอร์ชันที่ Control Center จัดการ</div>';
    el("legacyMenus").innerHTML = payload.legacy?.length
      ? payload.legacy.map((item) => versionCard(item, true)).join("")
      : '<div class="empty">ไม่พบ Legacy ที่ยังไม่ถูกนำเข้า</div>';
    el("importLegacyButton").disabled = !payload.legacy?.length;
  }

  async function loadHealth(force = false) {
    if (!force && state.loaded.has("health")) return;
    const payload = await api("health");
    state.loaded.add("health");
    const health = payload.health || {};
    el("healthCards").innerHTML = [
      metric(
        "สถานะรวม",
        health.healthy === false ? "ต้องตรวจสอบ" : "ปกติ",
        "ตรวจจาก Backend ล่าสุด",
        health.healthy === false ? "danger" : "",
      ),
      metric(
        "Webhook ค้าง",
        Number(health.webhooks?.stale_processing || 0).toLocaleString("th-TH"),
        `ล้มเหลว 24 ชม. ${Number(health.webhooks?.failed_24h || 0)}`,
        Number(health.webhooks?.failed_24h || 0) ? "danger" : "",
      ),
      metric(
        "Reminder ถึงกำหนด",
        Number(health.reminders?.due_now || 0).toLocaleString("th-TH"),
        `ส่งแล้ว 24 ชม. ${Number(health.reminders?.sent_24h || 0)}`,
      ),
      metric(
        "Storage Cleanup",
        payload.cleanup_dry_run ? "DRY RUN" : "LIVE",
        payload.cleanup_function || "ไม่พบชื่อ Function",
        payload.cleanup_dry_run ? "" : "danger",
      ),
    ].join("");
    const serviceCard = (name, ok, values) =>
      `<article class="health-card"><header><h3>${escapeHtml(name)}</h3><span class="badge ${ok ? "" : "failed"}">${ok ? "ปกติ" : "ตรวจสอบ"}</span></header><dl>${Object.entries(
        values,
      )
        .map(
          ([label, value]) =>
            `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`,
        )
        .join("")}</dl></article>`;
    el("healthServices").innerHTML = [
      serviceCard(
        "Webhook",
        !Number(health.webhooks?.failed_24h || 0) &&
          !Number(health.webhooks?.stale_processing || 0),
        {
          "สำเร็จ 24 ชม.": Number(
            health.webhooks?.completed_24h || 0,
          ).toLocaleString("th-TH"),
          "ล้มเหลว 24 ชม.": Number(
            health.webhooks?.failed_24h || 0,
          ).toLocaleString("th-TH"),
          ค้างประมวลผล: Number(
            health.webhooks?.stale_processing || 0,
          ).toLocaleString("th-TH"),
        },
      ),
      serviceCard("Reminder", !Number(health.reminders?.failed_24h || 0), {
        ถึงกำหนดตอนนี้: Number(health.reminders?.due_now || 0).toLocaleString(
          "th-TH",
        ),
        "ส่งแล้ว 24 ชม.": Number(
          health.reminders?.sent_24h || 0,
        ).toLocaleString("th-TH"),
        "ล้มเหลว 24 ชม.": Number(
          health.reminders?.failed_24h || 0,
        ).toLocaleString("th-TH"),
      }),
      serviceCard(
        "Scheduler",
        health.scheduler?.active !== false &&
          health.scheduler?.cadence_ok !== false,
        {
          เปิดใช้งาน: health.scheduler?.active === false ? "ไม่" : "ใช่",
          รอบเวลาถูกต้อง:
            health.scheduler?.cadence_ok === false ? "ไม่" : "ใช่",
          ตารางที่คาดหวัง: health.scheduler?.expected_schedule || "—",
        },
      ),
      serviceCard("Storage Cleanup", Boolean(payload.cleanup_dry_run), {
        Function: payload.cleanup_function || "—",
        โหมด: payload.cleanup_dry_run ? "DRY RUN (ไม่ลบไฟล์)" : "LIVE",
        สร้างข้อมูลเมื่อ: formatDate(health.generated_at),
      }),
    ].join("");
    el("healthDetails").textContent = JSON.stringify(
      {
        ...health,
        storage_cleanup: {
          function: payload.cleanup_function,
          dry_run: payload.cleanup_dry_run,
        },
      },
      null,
      2,
    );
  }

  async function loadAudit(force = false) {
    if (!force && state.loaded.has("audit")) return;
    const payload = await api("audit");
    state.loaded.add("audit");
    el("auditRows").innerHTML = payload.items?.length
      ? payload.items
          .map(
            (item) =>
              `<tr><td data-label="วันเวลา">${formatDate(item.created_at)}</td><td data-label="ผู้ดำเนินการ">${escapeHtml(item.actor_uid)}</td><td data-label="Action"><span class="badge">${escapeHtml(item.action)}</span></td><td data-label="รายการ">${escapeHtml(item.entity_type)}<br><small>${escapeHtml(item.entity_key)}</small></td><td data-label="รายละเอียด"><code>${escapeHtml(JSON.stringify(item.details || {})).slice(0, 300)}</code></td></tr>`,
          )
          .join("")
      : '<tr><td colspan="5" class="empty">ยังไม่มี Audit Log</td></tr>';
  }

  const loaders = {
    overview: loadOverview,
    storage: loadStorage,
    retention: loadRetention,
    line: loadLine,
    richmenu: loadRichMenu,
    health: loadHealth,
    audit: loadAudit,
  };
  async function showView(name, force = false) {
    if (!loaders[name]) return;
    state.active = name;
    el("pageTitle").textContent = titles[name];
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      const active = panel.dataset.panel === name;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
    document
      .querySelectorAll("[data-view]")
      .forEach((button) =>
        button.classList.toggle("is-active", button.dataset.view === name),
      );
    document.querySelector(".sidebar").classList.remove("is-open");
    try {
      await loaders[name](force);
    } catch (error) {
      notice(error.message || "โหลดข้อมูลไม่สำเร็จ", "error");
      setGlobalStatus(false, "โหลดข้อมูลไม่สำเร็จ");
    }
  }

  function confirmAction({ title, message, phrase = "" }) {
    return new Promise((resolve) => {
      const dialog = el("confirmDialog"),
        input = el("confirmPhraseInput"),
        wrap = el("confirmPhraseWrap");
      el("confirmTitle").textContent = title;
      el("confirmMessage").textContent = message;
      wrap.hidden = !phrase;
      input.value = "";
      input.placeholder = phrase;
      const close = () => {
        dialog.removeEventListener("close", close);
        resolve(
          dialog.returnValue === "confirm" &&
            (!phrase || input.value.trim() === phrase),
        );
      };
      dialog.addEventListener("close", close);
      dialog.showModal();
    });
  }

  async function action(body, timeout) {
    return api("action", {
      method: "POST",
      body: { ...body, request_id: requestId(body.action.toLowerCase()) },
      timeout,
    });
  }

  async function toggleHold(button) {
    const hold = button.dataset.hold === "true",
      caseId = button.dataset.caseId;
    const reason = hold
      ? window.prompt("ระบุเหตุผลที่เปิด Legal Hold")?.trim()
      : window.prompt("ระบุเหตุผลที่ปลด Legal Hold")?.trim();
    if (!reason) return;
    const ok = await confirmAction({
      title: hold ? "เปิด Legal Hold" : "ปลด Legal Hold",
      message: `ยืนยันการเปลี่ยนสถานะเคสนี้หรือไม่? เหตุผล: ${reason}`,
    });
    if (!ok) return;
    button.disabled = true;
    try {
      await action({
        action: "SET_LEGAL_HOLD",
        case_id: caseId,
        hold,
        reason,
        confirm: true,
      });
      state.loaded.delete("retention");
      state.loaded.delete("overview");
      await loadRetention(true);
      notice("อัปเดต Legal Hold และบันทึก Audit แล้ว");
    } catch (error) {
      notice(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  async function runDryRun() {
    const ok = await confirmAction({
      title: "ทดลอง Storage Dry Run",
      message: "ระบบจะค้นหาและคำนวณไฟล์ถึงกำหนด แต่จะไม่ลบไฟล์จริง",
    });
    if (!ok) return;
    const button = el("runDryRunButton");
    button.disabled = true;
    try {
      const result = await action({
        action: "RUN_STORAGE_DRY_RUN",
        confirm: true,
      });
      notice(
        `Dry Run สำเร็จ: ${result.due_items} ไฟล์ รวม ${formatBytes(result.due_bytes)}`,
      );
      state.loaded.delete("retention");
      state.loaded.delete("overview");
      await loadRetention(true);
    } catch (error) {
      notice(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  const actionValue = (action) =>
    action?.uri || action?.text || action?.data || "";
  const areaBounds = (index, height) => {
    const col = index % 3,
      row = Math.floor(index / 3);
    const x = Math.floor((2500 * col) / 3),
      nextX = Math.floor((2500 * (col + 1)) / 3);
    const y = Math.floor((height * row) / 3),
      nextY = Math.floor((height * (row + 1)) / 3);
    return { x, y, width: nextX - x, height: nextY - y };
  };

  function actionSummary(action) {
    if (!action) return "ไม่ทำงาน";
    if (action.type === "uri") return `ลิงก์: ${action.label || "เปิด URL"}`;
    if (action.type === "message") return `ข้อความ: ${action.text || "—"}`;
    if (action.type === "postback")
      return `Postback: ${action.label || action.data || "—"}`;
    if (action.type === "richmenuswitch")
      return `สลับไป ${action.richMenuAliasId || "—"}`;
    return action.type;
  }

  function syncPageFields() {
    const page = state.menuPages[state.menuPageIndex];
    page.name = el("menuPageName").value.trim();
    page.chatBarText = el("menuChatBar").value.trim();
    page.page_key = el("menuPageKey").value.trim();
    page.alias_id = el("menuAlias").value.trim();
    page.height = Number(el("menuHeight").value);
  }

  function renderMenuTabs() {
    const selectedDefault = el("menuDefaultPage").value;
    const tabs = state.menuPages
      .map(
        (page, index) =>
          `<button class="page-tab ${index === state.menuPageIndex ? "is-active" : ""}" type="button" data-menu-page="${index}" role="tab" aria-selected="${index === state.menuPageIndex}">หน้า ${index + 1}: ${escapeHtml(page.name)}</button>`,
      )
      .join("");
    el("menuPageTabs").innerHTML = tabs;
    el("previewPageTabs").innerHTML = state.menuPages
      .map(
        (page, index) =>
          `<button class="page-tab ${index === state.previewPageIndex ? "is-active" : ""}" type="button" data-preview-page="${index}">หน้า ${index + 1}</button>`,
      )
      .join("");
    el("menuActionTarget").innerHTML = state.menuPages
      .map(
        (page, index) =>
          `<option value="${escapeHtml(page.alias_id)}">หน้า ${index + 1}: ${escapeHtml(page.alias_id)}</option>`,
      )
      .join("");
    el("menuDefaultPage").innerHTML = state.menuPages.map((page, index) => `<option value="${escapeHtml(page.page_key)}">หน้า ${index + 1}: ${escapeHtml(page.page_key)}</option>`).join("");
    el("menuDefaultPage").value = state.menuPages.some((page) => page.page_key === selectedDefault) ? selectedDefault : state.menuPages[0].page_key;
  }

  function renderActionEditor() {
    const action =
      state.menuPages[state.menuPageIndex].actions[state.menuAreaIndex];
    const type = action?.type || "none";
    el("menuActionLegend").textContent = `ปุ่มที่ ${state.menuAreaIndex + 1}`;
    el("menuActionType").value = type;
    el("menuActionLabel").value = action?.label || "";
    el("menuActionValue").value = actionValue(action);
    el("menuActionValue").maxLength = type === "uri" ? 1000 : 300;
    el("menuActionTargetWrap").hidden = type !== "richmenuswitch";
    el("menuActionValueWrap").hidden =
      type === "none" || type === "richmenuswitch";
    if (type === "richmenuswitch")
      el("menuActionTarget").value =
        action.richMenuAliasId ||
        state.menuPages[1 - state.menuPageIndex].alias_id;
  }

  function renderMenuBuilder() {
    const page = state.menuPages[state.menuPageIndex];
    el("menuPageHeading").textContent =
      `ตั้งค่าหน้า ${state.menuPageIndex + 1}`;
    el("menuPageName").value = page.name;
    el("menuChatBar").value = page.chatBarText;
    el("menuPageKey").value = page.page_key;
    el("menuAlias").value = page.alias_id;
    el("menuHeight").value = String(page.height);
    el("menuImage").value = "";
    el("menuPageStatus").textContent = page.file
      ? `${page.file.name} · ${formatBytes(page.file.size)}`
      : "ยังไม่เลือกภาพ";
    el("menuAreaGrid").innerHTML = page.actions
      .map(
        (action, index) =>
          `<button class="area-button ${index === state.menuAreaIndex ? "is-active" : ""}" type="button" data-menu-area="${index}"><strong>${index + 1}</strong><small>${escapeHtml(actionSummary(action))}</small></button>`,
      )
      .join("");
    el("menuAreas").value = JSON.stringify(
      menuConfigForPage(page).areas,
      null,
      2,
    );
    renderMenuTabs();
    renderActionEditor();
    previewMenu();
  }

  function updateCurrentAction() {
    const type = el("menuActionType").value;
    let next = null;
    const label = el("menuActionLabel").value.trim();
    const value = el("menuActionValue").value.trim();
    if (type === "uri") next = { type, label, uri: value };
    if (type === "message") next = { type, label, text: value };
    if (type === "postback")
      next = { type, label, data: value, displayText: label || undefined };
    if (type === "richmenuswitch")
      next = {
        type,
        label,
        richMenuAliasId: el("menuActionTarget").value,
        data: `switch_to_${el("menuActionTarget").value.replace(/[^a-z0-9]/gi, "_")}`,
      };
    state.menuPages[state.menuPageIndex].actions[state.menuAreaIndex] = next;
    renderMenuBuilder();
  }

  function menuConfigForPage(page) {
    return {
      size: { width: 2500, height: page.height },
      selected: true,
      name: page.name,
      chatBarText: page.chatBarText,
      areas: page.actions
        .map((action, index) =>
          action ? { bounds: areaBounds(index, page.height), action } : null,
        )
        .filter(Boolean),
    };
  }

  function previewMenu() {
    const page = state.menuPages[state.previewPageIndex],
      preview = el("menuPreview"),
      configValue = menuConfigForPage(page);
    preview.style.aspectRatio = `2500/${page.height}`;
    if (!page.objectUrl)
      preview.innerHTML =
        '<div class="preview-empty">เลือกภาพของหน้านี้เพื่อดู Preview</div>';
    else
      preview.innerHTML =
        `<img src="${page.objectUrl}" alt="Preview ${escapeHtml(page.name)}">` +
        page.actions
          .map((action, index) =>
            action
              ? `<button type="button" class="preview-area" data-preview-action="${index}" style="left:${areaBounds(index, page.height).x / 25}%;top:${(areaBounds(index, page.height).y / page.height) * 100}%;width:${areaBounds(index, page.height).width / 25}%;height:${(areaBounds(index, page.height).height / page.height) * 100}%" aria-label="${escapeHtml(action.label || `ปุ่ม ${index + 1}`)}">${index + 1}<br>${escapeHtml(action.label || action.type)}</button>`
              : "",
          )
          .join("");
    el("menuAreas").value = JSON.stringify(
      menuConfigForPage(state.menuPages[state.menuPageIndex]).areas,
      null,
      2,
    );
    renderMenuTabs();
  }

  function simulatePreview(index) {
    const action = state.menuPages[state.previewPageIndex].actions[index];
    if (!action) return;
    if (action.type === "richmenuswitch") {
      const target = state.menuPages.findIndex(
        (page) => page.alias_id === action.richMenuAliasId,
      );
      if (target >= 0) {
        state.previewPageIndex = target;
        el("previewActionResult").textContent =
          `จำลองการสลับไปหน้า ${target + 1} (${action.richMenuAliasId})`;
        previewMenu();
        return;
      }
    }
    const descriptions = {
      uri: `จะเปิดลิงก์ ${action.uri}`,
      message: `จะส่งข้อความ “${action.text}”`,
      postback: `จะส่ง Postback “${action.data}”`,
    };
    el("previewActionResult").textContent =
      descriptions[action.type] || actionSummary(action);
  }

  async function uploadMenuImage(file) {
    const form = new FormData();
    form.append("action", "UPLOAD_RICH_MENU_IMAGE");
    form.append("request_id", requestId("richmenu-upload"));
    form.append("file", file);
    return api("action", {
      method: "POST",
      body: form,
      timeout: Number(config.richMenuTimeoutMs) || 30000,
    });
  }

  function imageDimensions(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("อ่านขนาดภาพ Rich Menu ไม่สำเร็จ"));
      image.src = url;
    });
  }

  async function saveDraft(event) {
    event.preventDefault();
    syncPageFields();
    const missing = state.menuPages.findIndex((page) => !page.file);
    if (missing >= 0)
      return notice(`กรุณาเลือกภาพสำหรับหน้า ${missing + 1}`, "error");
    const submit = event.submitter;
    submit.disabled = true;
    try {
      const uploads = [];
      for (const [index, page] of state.menuPages.entries()) {
        const dimensions = await imageDimensions(page.objectUrl);
        if (dimensions.width !== 2500 || dimensions.height !== page.height) throw new Error(`ภาพหน้า ${index + 1} ต้องมีขนาด 2500 × ${page.height} px (ไฟล์นี้ ${dimensions.width} × ${dimensions.height} px)`);
        if (!page.actions.some(Boolean)) throw new Error(`หน้า ${index + 1} ต้องมีปุ่มอย่างน้อย 1 พื้นที่`);
        uploads.push((await uploadMenuImage(page.file)).image);
      }
      const menuSet = {
        name: el("menuSetName").value.trim(),
        default_page_key: el("menuDefaultPage").value,
        pages: state.menuPages.map((page, index) => ({
          page_key: page.page_key,
          alias_id: page.alias_id,
          menu_config: menuConfigForPage(page),
          image: uploads[index],
        })),
      };
      const saved = await action(
        { action: "SAVE_RICH_MENU_SET_DRAFT", menu_set: menuSet },
        Number(config.richMenuTimeoutMs) || 30000,
      );
      notice(
        `บันทึก Rich Menu Set version ${saved.set.version_no} แล้ว (ยังไม่กระทบ Production)`,
      );
      state.loaded.delete("richmenu");
      state.loaded.delete("audit");
      await loadRichMenu(true);
    } catch (error) {
      notice(error.message, "error");
    } finally {
      submit.disabled = false;
    }
  }

  async function menuAction(button) {
    const kind = button.dataset.action,
      id = button.dataset.id;
    let body = { action: "", version_id: id };
    if (kind === "validate") body.action = "VALIDATE_RICH_MENU";
    if (kind === "publish") {
      const ok = await confirmAction({
        title: "Publish Rich Menu ไปยัง Production",
        message:
          "เมนูนี้จะกลายเป็น Default สำหรับผู้ใช้ทั้งหมด การเปลี่ยนแปลงจะถูกบันทึกและ Rollback ได้",
        phrase: "PUBLISH_RICH_MENU",
      });
      if (!ok) return;
      body = {
        ...body,
        action: "PUBLISH_RICH_MENU",
        confirmation: "PUBLISH_RICH_MENU",
      };
    }
    if (kind === "rollback") {
      const ok = await confirmAction({
        title: "Rollback Rich Menu",
        message: "Default Rich Menu จะกลับไปใช้เวอร์ชันนี้",
        phrase: "ROLLBACK_RICH_MENU",
      });
      if (!ok) return;
      body = {
        ...body,
        action: "ROLLBACK_RICH_MENU",
        confirmation: "ROLLBACK_RICH_MENU",
      };
    }
    button.disabled = true;
    try {
      await action(body, Number(config.richMenuTimeoutMs) || 30000);
      notice(`${body.action} สำเร็จ`);
      state.loaded.delete("richmenu");
      state.loaded.delete("audit");
      await loadRichMenu(true);
    } catch (error) {
      notice(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  async function menuSetAction(button) {
    const kind = button.dataset.action,
      id = button.dataset.id;
    let body = { action: "VALIDATE_RICH_MENU_SET", set_id: id };
    if (kind === "publish") {
      const ok = await confirmAction({
        title: "Publish Rich Menu ทั้ง 2 หน้า",
        message:
          "ระบบจะสร้างเมนูทั้งชุด เชื่อม Alias และตั้งหน้าเริ่มต้นให้ผู้ใช้ทั้งหมด หากขั้นตอนใดล้มเหลว Backend จะคืนค่าเดิม",
        phrase: "PUBLISH_RICH_MENU_SET",
      });
      if (!ok) return;
      body = {
        action: "PUBLISH_RICH_MENU_SET",
        set_id: id,
        confirmation: "PUBLISH_RICH_MENU_SET",
      };
    }
    if (kind === "rollback") {
      const ok = await confirmAction({
        title: "Rollback Rich Menu ทั้งชุด",
        message: "Alias และหน้าเริ่มต้นจะกลับไปยังชุดนี้พร้อมกัน",
        phrase: "ROLLBACK_RICH_MENU_SET",
      });
      if (!ok) return;
      body = {
        action: "ROLLBACK_RICH_MENU_SET",
        set_id: id,
        confirmation: "ROLLBACK_RICH_MENU_SET",
      };
    }
    button.disabled = true;
    try {
      await action(body, Number(config.richMenuTimeoutMs) || 60000);
      notice(`${body.action} สำเร็จ`);
      state.loaded.delete("richmenu");
      state.loaded.delete("audit");
      await loadRichMenu(true);
    } catch (error) {
      notice(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  async function importLegacy() {
    const ok = await confirmAction({
      title: "นำเข้า Legacy Rich Menu",
      message:
        "ระบบจะสำรองภาพและ config ของเมนูเดิมเป็น Baseline โดยไม่เปลี่ยนเมนูที่ผู้ใช้กำลังเห็น",
      phrase: "IMPORT_LEGACY_RICH_MENUS",
    });
    if (!ok) return;
    const button = el("importLegacyButton");
    button.disabled = true;
    try {
      const result = await action(
        {
          action: "IMPORT_LEGACY_RICH_MENUS",
          confirmation: "IMPORT_LEGACY_RICH_MENUS",
        },
        60000,
      );
      notice(`นำเข้า ${result.imported} จาก ${result.discovered} เมนู`);
      state.loaded.delete("richmenu");
      state.loaded.delete("audit");
      await loadRichMenu(true);
    } catch (error) {
      notice(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  function bindEvents() {
    el("sideNavigation").addEventListener("click", (event) => {
      const button = event.target.closest("[data-view]");
      if (button) showView(button.dataset.view);
    });
    document.addEventListener("click", (event) => {
      const go = event.target.closest("[data-go]");
      if (go) showView(go.dataset.go);
      const hold = event.target.closest(".hold-button");
      if (hold) toggleHold(hold);
      const menu = event.target.closest(".menu-action");
      if (menu) menuAction(menu);
      const menuSet = event.target.closest(".menu-set-action");
      if (menuSet) menuSetAction(menuSet);
      const menuPage = event.target.closest("[data-menu-page]");
      if (menuPage) {
        syncPageFields();
        state.menuPageIndex = Number(menuPage.dataset.menuPage);
        state.menuAreaIndex = 0;
        renderMenuBuilder();
      }
      const menuArea = event.target.closest("[data-menu-area]");
      if (menuArea) {
        state.menuAreaIndex = Number(menuArea.dataset.menuArea);
        renderMenuBuilder();
      }
      const previewPage = event.target.closest("[data-preview-page]");
      if (previewPage) {
        state.previewPageIndex = Number(previewPage.dataset.previewPage);
        previewMenu();
      }
      const previewAction = event.target.closest("[data-preview-action]");
      if (previewAction)
        simulatePreview(Number(previewAction.dataset.previewAction));
      const page = event.target.closest("[data-page]");
      if (page) {
        state.storageOffset = Math.max(
          0,
          state.storageOffset +
            (page.dataset.page === "next"
              ? state.storageLimit
              : -state.storageLimit),
        );
        loadStorage(true);
      }
    });
    el("refreshButton").addEventListener("click", () => {
      state.loaded.delete(state.active);
      showView(state.active, true);
    });
    el("retryButton").addEventListener("click", initialize);
    el("mobileMenuButton").addEventListener("click", () =>
      document.querySelector(".sidebar").classList.toggle("is-open"),
    );
    el("storageFilters").addEventListener("submit", (event) => {
      event.preventDefault();
      state.storageOffset = 0;
      [...state.loaded]
        .filter((key) => key.startsWith("storage:"))
        .forEach((key) => state.loaded.delete(key));
      loadStorage(true);
    });
    el("runDryRunButton").addEventListener("click", runDryRun);
    el("previewMenuButton").addEventListener("click", () => {
      try {
        previewMenu();
      } catch (error) {
        notice(error.message, "error");
      }
    });
    el("richMenuForm").addEventListener("submit", saveDraft);
    ["menuPageName", "menuChatBar", "menuHeight"].forEach((id) =>
      el(id).addEventListener("change", () => {
        syncPageFields();
        renderMenuBuilder();
      }),
    );
    el("menuPageKey").addEventListener("change", () => { syncPageFields(); renderMenuBuilder(); });
    el("menuAlias").addEventListener("change", () => {
      const page = state.menuPages[state.menuPageIndex], previousAlias = page.alias_id, nextAlias = el("menuAlias").value.trim();
      state.menuPages.forEach((candidate) => candidate.actions.forEach((action) => { if (action?.type === "richmenuswitch" && action.richMenuAliasId === previousAlias) action.richMenuAliasId = nextAlias; }));
      syncPageFields(); renderMenuBuilder();
    });
    [
      "menuActionType",
      "menuActionLabel",
      "menuActionValue",
      "menuActionTarget",
    ].forEach((id) => el(id).addEventListener("change", updateCurrentAction));
    el("menuImage").addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 1048576) {
        event.target.value = "";
        return notice("ภาพต้องมีขนาดไม่เกิน 1 MB", "error");
      }
      const page = state.menuPages[state.menuPageIndex];
      if (page.objectUrl) URL.revokeObjectURL(page.objectUrl);
      page.file = file;
      page.objectUrl = URL.createObjectURL(file);
      state.previewPageIndex = state.menuPageIndex;
      renderMenuBuilder();
    });
    el("applyMenuJson").addEventListener("click", () => {
      try {
        const areas = JSON.parse(el("menuAreas").value);
        if (!Array.isArray(areas)) throw new Error("JSON ต้องเป็น Array");
        const page = state.menuPages[state.menuPageIndex],
          actions = emptyActions();
        areas.forEach((area) => {
          const bounds = area?.bounds || {};
          const col = Math.min(
            2,
            Math.floor(Number(bounds.x || 0) / (2500 / 3)),
          );
          const row = Math.min(
            2,
            Math.floor(Number(bounds.y || 0) / (page.height / 3)),
          );
          actions[row * 3 + col] = area.action || null;
        });
        page.actions = actions;
        renderMenuBuilder();
        notice("นำ JSON ไปใช้กับหน้านี้แล้ว");
      } catch (error) {
        notice(error.message || "JSON ไม่ถูกต้อง", "error");
      }
    });
    el("importLegacyButton").addEventListener("click", importLegacy);
    renderMenuBuilder();
  }

  async function initialize() {
    el("appLoading").hidden = false;
    el("appError").hidden = true;
    el("appShell").hidden = true;
    try {
      if (!config.liffId || !config.apiUrl)
        throw new Error("Frontend configuration is incomplete");
      if (new URLSearchParams(window.location.search).get("liff") !== "1") {
        const liffEntry = new URL(
          `https://liff.line.me/${encodeURIComponent(config.liffId)}`,
        );
        liffEntry.searchParams.set("target", "system-monitor");
        window.location.replace(liffEntry.href);
        return;
      }
      await liff.init({ liffId: config.liffId });
      if (!liff.isLoggedIn()) {
        const liffEntry = new URL(
          `https://liff.line.me/${encodeURIComponent(config.liffId)}`,
        );
        liffEntry.searchParams.set("target", "system-monitor");
        window.location.replace(liffEntry.href);
        return;
      }
      state.token = liff.getAccessToken() || "";
      if (!state.token) throw new Error("ไม่พบ LINE access token");
      el("loadingMessage").textContent = "กำลังโหลดสถานะระบบ…";
      const payload = await api("overview");
      state.overview = payload;
      state.loaded.add("overview");
      renderAdminProfile(payload.admin);
      el("appLoading").hidden = true;
      el("appShell").hidden = false;
      state.loaded.delete("overview");
      await loadOverview(true);
    } catch (error) {
      el("appLoading").hidden = true;
      el("appError").hidden = false;
      el("errorTitle").textContent = /Forbidden|403/.test(error.message)
        ? "ไม่มีสิทธิ์เข้าถึง"
        : "เปิด Control Center ไม่สำเร็จ";
      el("errorMessage").textContent = error.message || "กรุณาลองใหม่";
    }
  }

  bindEvents();
  window.addEventListener("load", initialize, { once: true });
})();
