// admin.js — Edu Prime Admin Dashboard
// STRICT: Only ADMIN_EMAIL can access. All others are signed out immediately.
import {
  auth, db, ADMIN_EMAIL,
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  getApps_, getAllBatches, createApp, updateApp, deleteApp_,
  createBatch, updateBatch, deleteBatch,
  getSettings, saveSettings, getAnalytics,
  collection, addDoc, orderBy, query
} from "./firebase.js";

// ── DOM ───────────────────────────────────────────────────────
const adminGate     = document.getElementById("adminGate");
const adminApp      = document.getElementById("adminApp");
const authError     = document.getElementById("authError");
const loginEmail    = document.getElementById("loginEmail");
const loginPass     = document.getElementById("loginPass");
const loginBtn      = document.getElementById("loginBtn");
const adminEmail    = document.getElementById("adminEmail");
const topbarUser    = document.getElementById("topbarUser");
const topbarTitle   = document.getElementById("topbarTitle");
const adminMenuBtn  = document.getElementById("adminMenuBtn");
const adminSidebar  = document.getElementById("adminSidebar");
const adminLogout   = document.getElementById("adminLogout");
const toastCont     = document.getElementById("toastContainer");

// ── Auth Guard ────────────────────────────────────────────────
// PAGE LOAD par: Show loading state
adminGate.style.display  = "none";
adminApp.style.display   = "none";

// Show a subtle loading indicator
const loadingDiv = document.createElement("div");
loadingDiv.style.cssText = `
  position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
  background:#0a0a0f; z-index:999;
`;
loadingDiv.innerHTML = `
  <div style="text-align:center">
    <div style="
      width:40px; height:40px; border:3px solid #2a2540;
      border-top-color:#7c3aed; border-radius:50%;
      animation:spin .8s linear infinite; margin:0 auto 12px;
    "></div>
    <div style="color:#7a7a9a; font-size:.82rem; font-family:sans-serif">Checking access…</div>
  </div>
  <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
`;
document.body.appendChild(loadingDiv);

onAuthStateChanged(auth, async user => {
  // Remove loading div
  loadingDiv.remove();

  if (user) {
    // STRICT CHECK: ONLY admin email allowed
    if (user.email === ADMIN_EMAIL) {
      showAdmin(user);
    } else {
      // Non-admin user is signed in → sign them out immediately
      await signOut(auth);
      showGate("⛔ Access Denied. This area is for admin only.");
    }
  } else {
    // No user logged in → show login gate
    showGate();
  }
});

function showGate(err = "") {
  adminGate.style.display = "flex";
  adminApp.style.display  = "none";
  if (err) {
    authError.textContent    = err;
    authError.style.display  = "block";
  } else {
    authError.style.display  = "none";
  }
  // Clear login form
  if (loginEmail) loginEmail.value = "";
  if (loginPass)  loginPass.value  = "";
}

function showAdmin(user) {
  adminGate.style.display = "none";
  adminApp.style.display  = "flex";
  adminEmail.textContent  = user.email;
  topbarUser.textContent  = user.email;
  loadAllData();
}

// ── Login ─────────────────────────────────────────────────────
loginBtn.addEventListener("click", async () => {
  const email = loginEmail.value.trim();
  const pass  = loginPass.value;

  authError.style.display = "none";
  authError.textContent   = "";

  if (!email || !pass) {
    authError.textContent   = "Please enter email and password.";
    authError.style.display = "block";
    return;
  }

  // Pre-check: Only allow admin email to attempt login
  if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    authError.textContent   = "⛔ Access Denied. You are not authorized to access this panel.";
    authError.style.display = "block";
    return;
  }

  loginBtn.textContent = "Signing in…";
  loginBtn.disabled    = true;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    // onAuthStateChanged will handle the rest
  } catch(e) {
    authError.textContent   = friendlyAuthError(e.code);
    authError.style.display = "block";
    loginBtn.textContent    = "Sign In →";
    loginBtn.disabled       = false;
  }
});

loginPass.addEventListener("keydown", e => {
  if (e.key === "Enter") loginBtn.click();
});

adminLogout.addEventListener("click", async () => {
  await signOut(auth);
  showToast("Signed out", "success");
});

function friendlyAuthError(code) {
  const map = {
    "auth/user-not-found":     "No account found with this email.",
    "auth/wrong-password":     "Incorrect password.",
    "auth/invalid-email":      "Invalid email address.",
    "auth/too-many-requests":  "Too many attempts. Try again later.",
    "auth/invalid-credential": "Invalid email or password.",
  };
  return map[code] || "Login failed. Please try again.";
}

// ── Sidebar / Navigation ──────────────────────────────────────
adminMenuBtn.addEventListener("click", () => adminSidebar.classList.toggle("open"));

document.querySelectorAll(".admin-nav a[data-tab]").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    const tab = link.dataset.tab;
    document.querySelectorAll(".admin-nav a").forEach(a => a.classList.remove("active"));
    link.classList.add("active");
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    document.getElementById(`tab-${tab}`)?.classList.add("active");
    topbarTitle.textContent = link.textContent.trim();
    adminSidebar.classList.remove("open");
    if (tab === "analytics")     loadAnalytics();
    if (tab === "apps")          loadAppsTable();
    if (tab === "batches")       loadBatchesTable();
    if (tab === "announcement")  loadAnnouncement();
    if (tab === "sidebar-links") loadSidebarLinks();
  });
});

// ── State ─────────────────────────────────────────────────────
let allApps     = [];
let allBatches_ = [];
let analytics   = [];

async function loadAllData() {
  try {
    [allApps, allBatches_, analytics] = await Promise.all([
      getApps_(), getAllBatches(), getAnalytics()
    ]);
    loadAnalytics();
    loadAppsTable();
    populateAppFilterDropdown();
  } catch(e) {
    showToast("Error loading data: " + e.message, "error");
  }
}

// ── Analytics ─────────────────────────────────────────────────
function loadAnalytics() {
  const now     = new Date();
  const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today - 7 * 864e5);
  const monAgo  = new Date(now.getFullYear(), now.getMonth(), 1);

  const toDate = a => a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp?.seconds * 1000 || 0);

  const todayClicks = analytics.filter(a => toDate(a) >= today).length;
  const weekClicks  = analytics.filter(a => toDate(a) >= weekAgo).length;
  const monClicks   = analytics.filter(a => toDate(a) >= monAgo).length;
  const uniq        = new Set(analytics.map(a => a.visitor_id)).size;

  document.getElementById("statVisitors").textContent = uniq;
  document.getElementById("statClicks").textContent   = analytics.length;
  document.getElementById("statToday").textContent    = todayClicks;
  document.getElementById("statWeek").textContent     = weekClicks;
  document.getElementById("statMonth").textContent    = monClicks;

  const appCounts = {};
  analytics.forEach(a => { if (a.app_id) appCounts[a.app_id] = (appCounts[a.app_id] || 0) + 1; });
  const topAppId = Object.entries(appCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  const topApp   = allApps.find(a => a.id === topAppId);
  document.getElementById("statTopApp").textContent = topApp?.app_name || topAppId;

  renderWeeklyChart();
  renderTop10("top10Apps", appCounts);

  const bCounts = {};
  analytics.forEach(a => { if (a.batch_id) bCounts[a.batch_id] = (bCounts[a.batch_id] || 0) + 1; });
  renderTop10Batches("top10Batches", bCounts);
  renderActivity();
}

function renderWeeklyChart() {
  const chart = document.getElementById("weeklyChart");
  const days  = [];
  const now   = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push(d);
  }
  const toDate = a => a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp?.seconds * 1000 || 0);
  const counts = days.map(d => {
    const next = new Date(d); next.setDate(d.getDate() + 1);
    return analytics.filter(a => { const t = toDate(a); return t >= d && t < next; }).length;
  });
  const maxC   = Math.max(...counts, 1);
  const labels = days.map(d => d.toLocaleDateString("en", { weekday: "short" }));
  chart.innerHTML = counts.map((c, i) => `
    <div class="bar-item">
      <div class="bar" style="height:${Math.max(4, (c / maxC) * 72)}px" title="${c} clicks"></div>
      <span class="bar-label">${labels[i]}</span>
    </div>`).join("");
}

function renderTop10(elId, counts) {
  const el = document.getElementById(elId);
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!sorted.length) { el.innerHTML = `<p style="color:var(--text-3);font-size:.8rem;padding:10px">No data yet</p>`; return; }
  el.innerHTML = sorted.map(([id, c], i) => {
    const app = allApps.find(a => a.id === id);
    return `<div class="top10-item">
      <span class="top10-rank">#${i + 1}</span>
      <span class="top10-name">${esc(app?.app_name || id)}</span>
      <span class="top10-count">${c}</span>
    </div>`;
  }).join("");
}

function renderTop10Batches(elId, counts) {
  const el = document.getElementById(elId);
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!sorted.length) { el.innerHTML = `<p style="color:var(--text-3);font-size:.8rem;padding:10px">No data yet</p>`; return; }
  el.innerHTML = sorted.map(([id, c], i) => {
    const b = allBatches_.find(x => x.id === id);
    return `<div class="top10-item">
      <span class="top10-rank">#${i + 1}</span>
      <span class="top10-name">${esc(b?.batch_name || id)}</span>
      <span class="top10-count">${c}</span>
    </div>`;
  }).join("");
}

function renderActivity() {
  const feed   = document.getElementById("activityFeed");
  const recent = analytics.slice(0, 20);
  if (!recent.length) { feed.innerHTML = `<p style="color:var(--text-3);font-size:.8rem;padding:10px">No activity yet</p>`; return; }
  feed.innerHTML = recent.map(a => {
    const app   = allApps.find(x => x.id === a.app_id);
    const batch = allBatches_.find(x => x.id === a.batch_id);
    const d     = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp?.seconds * 1000 || 0);
    return `<div class="activity-item">
      <div class="activity-dot"></div>
      <div class="activity-info">
        <div class="activity-name">${esc(batch?.batch_name || a.batch_name || "Unknown Batch")}</div>
        <div class="activity-meta">${esc(app?.app_name || a.app_id || "")} · ${esc(a.device_type || "")} · ${esc(a.browser || "")}</div>
      </div>
      <span class="activity-time">${timeAgo(d)}</span>
    </div>`;
  }).join("");
}

function timeAgo(d) {
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Apps Table ────────────────────────────────────────────────
const PAGE_SIZE = 10;
let appsPage = 1;
let appsSearchTerm = "";

const appsSearchInput = document.getElementById("appsSearch");
appsSearchInput?.addEventListener("input", () => {
  appsSearchTerm = appsSearchInput.value.trim().toLowerCase();
  appsPage = 1;
  loadAppsTable();
});

function getFilteredApps() {
  if (!appsSearchTerm) return allApps;
  return allApps.filter(a =>
    (a.app_name || "").toLowerCase().includes(appsSearchTerm) ||
    (a.description || "").toLowerCase().includes(appsSearchTerm)
  );
}

function loadAppsTable() {
  const tbody    = document.getElementById("appsTableBody");
  const filtered = getFilteredApps();

  if (!allApps.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px">No apps yet — click "+ Add App" to create one</td></tr>`;
    renderPagination("appsPagination", 0, 0);
    return;
  }
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px">No apps match "${esc(appsSearchTerm)}"</td></tr>`;
    renderPagination("appsPagination", 0, 0);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  appsPage = Math.min(appsPage, totalPages);
  const start     = (appsPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = pageItems.map(a => `
    <tr>
      <td>${a.app_logo ? `<img class="logo-prev" src="${esc(a.app_logo)}" loading="lazy"/>` : ""}</td>
      <td style="font-weight:600">${esc(a.app_name)}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.description || "")}</td>
      <td><span style="font-size:.74rem;color:var(--text-muted)">${esc(a.cta_label || "Let's Study")}</span></td>
      <td>${a.popular ? `<span class="badge-popular">Popular</span>` : ""}</td>
      <td><div class="table-actions">
        <button class="btn-edit" data-id="${esc(a.id)}">Edit</button>
        <button class="btn-delete" data-id="${esc(a.id)}" data-name="${esc(a.app_name)}">Delete</button>
      </div></td>
    </tr>`).join("");

  tbody.querySelectorAll(".btn-edit").forEach(btn =>
    btn.addEventListener("click", () => openAppModal(btn.dataset.id)));
  tbody.querySelectorAll(".btn-delete").forEach(btn =>
    btn.addEventListener("click", () => confirmDelete("app", btn.dataset.id, btn.dataset.name)));

  renderPagination("appsPagination", totalPages, appsPage, p => { appsPage = p; loadAppsTable(); });
}

function renderPagination(elId, totalPages, current, onPage) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ""; return; }

  const btn = (label, page, opts = {}) =>
    `<button class="page-btn${page === current ? " active" : ""}" data-page="${page}" ${opts.disabled ? "disabled" : ""}>${label}</button>`;

  let html = "";
  html += btn("‹", current - 1, { disabled: current <= 1 });
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - current) <= 1) {
      html += btn(p, p);
    } else if (p === 2 || p === totalPages - 1) {
      html += `<span style="color:var(--text-muted);padding:0 2px">…</span>`;
    }
  }
  html += btn("›", current + 1, { disabled: current >= totalPages });
  el.innerHTML = html;
  el.querySelectorAll(".page-btn[data-page]").forEach(b => {
    b.addEventListener("click", () => onPage(+b.dataset.page));
  });
}

// App Modal
const appModal       = document.getElementById("appModal");
const appModalTitle  = document.getElementById("appModalTitle");
const appModalId     = document.getElementById("appModalId");
const appLogoInput   = document.getElementById("appLogo");
const appLogoPreview = document.getElementById("appLogoPreview");
const appCtaLabel    = document.getElementById("appCtaLabel");
const appCtaStyle    = document.getElementById("appCtaStyle");
const ctaPreviewBtn  = document.getElementById("ctaPreviewBtn");

document.getElementById("addAppBtn").addEventListener("click", () => openAppModal());
document.getElementById("appModalCancel").addEventListener("click", () => closeModal(appModal));
appModal.addEventListener("click", e => { if (e.target === appModal) closeModal(appModal); });

appLogoInput.addEventListener("input", () => updateLogoPreview());
function updateLogoPreview() {
  const url = appLogoInput.value.trim();
  if (url) { appLogoPreview.src = url; appLogoPreview.style.display = "inline-block"; }
  else       { appLogoPreview.style.display = "none"; }
}

function updateCtaPreview() {
  ctaPreviewBtn.textContent = appCtaLabel.value.trim() || "Let's Study";
  if (appCtaStyle.value === "primary") {
    ctaPreviewBtn.style.background = "var(--violet-600)";
    ctaPreviewBtn.style.color = "#fff";
  } else {
    ctaPreviewBtn.style.background = "#15131f";
    ctaPreviewBtn.style.color = "#fff";
  }
}
appCtaLabel.addEventListener("input", updateCtaPreview);
appCtaStyle.addEventListener("change", updateCtaPreview);

document.getElementById("appModalSave").addEventListener("click", async () => {
  const name = document.getElementById("appName").value.trim();
  if (!name) { showToast("App name is required", "error"); return; }
  const data = {
    app_name:    name,
    app_logo:    document.getElementById("appLogo").value.trim(),
    description: document.getElementById("appDesc").value.trim(),
    order:       parseInt(document.getElementById("appOrder").value) || 1,
    popular:     document.getElementById("appPopular").checked,
    cta_label:   appCtaLabel.value.trim() || "Let's Study",
    cta_style:   appCtaStyle.value || "dark",
  };
  try {
    const id = appModalId.value;
    if (id) { await updateApp(id, data); showToast("App updated", "success"); }
    else    { await createApp(data);     showToast("App created", "success"); }
    closeModal(appModal);
    allApps = await getApps_();
    loadAppsTable();
    populateAppFilterDropdown();
  } catch(e) { showToast("Error: " + e.message, "error"); }
});

function openAppModal(id) {
  const app = id ? allApps.find(a => a.id === id) : null;
  appModalTitle.textContent = app ? "Edit App" : "Add App";
  appModalId.value = id || "";
  document.getElementById("appName").value      = app?.app_name    || "";
  document.getElementById("appLogo").value      = app?.app_logo    || "";
  document.getElementById("appDesc").value      = app?.description || "";
  document.getElementById("appOrder").value     = app?.order       || 1;
  document.getElementById("appPopular").checked = app?.popular     || false;
  appCtaLabel.value = app?.cta_label || "Let's Study";
  appCtaStyle.value = app?.cta_style || "dark";
  updateLogoPreview();
  updateCtaPreview();
  openModal(appModal);
}

// ── Batches Table ─────────────────────────────────────────────
let batchesPage         = 1;
let batchesSearchTerm   = "";
let batchesAppFilterId  = "";

const batchesSearchInput = document.getElementById("batchesSearch");
const batchesAppFilter   = document.getElementById("batchesAppFilter");

batchesSearchInput?.addEventListener("input", () => {
  batchesSearchTerm = batchesSearchInput.value.trim().toLowerCase();
  batchesPage = 1;
  loadBatchesTable();
});
batchesAppFilter?.addEventListener("change", () => {
  batchesAppFilterId = batchesAppFilter.value;
  batchesPage = 1;
  loadBatchesTable();
});

function populateAppFilterDropdown() {
  if (!batchesAppFilter) return;
  const current = batchesAppFilter.value;
  batchesAppFilter.innerHTML = `<option value="">All Apps</option>` +
    allApps.map(a => `<option value="${esc(a.id)}">${esc(a.app_name)}</option>`).join("");
  batchesAppFilter.value = current;
}

function populateBatchAppDropdown(selectedId) {
  const sel = document.getElementById("batchAppId");
  if (!sel) return;
  sel.innerHTML = `<option value="">Select an app…</option>` +
    allApps.map(a => `<option value="${esc(a.id)}">${esc(a.app_name)}</option>`).join("");
  sel.value = selectedId || "";
}

function getFilteredBatches() {
  let list = allBatches_;
  if (batchesAppFilterId) list = list.filter(b => b.app_id === batchesAppFilterId);
  if (batchesSearchTerm) {
    list = list.filter(b =>
      (b.batch_name || "").toLowerCase().includes(batchesSearchTerm) ||
      (b.description || "").toLowerCase().includes(batchesSearchTerm)
    );
  }
  return list;
}

async function loadBatchesTable() {
  const tbody = document.getElementById("batchesTableBody");
  if (!allBatches_.length) allBatches_ = await getAllBatches();

  if (!allBatches_.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">No batches yet — click "+ Add Batch" to create one</td></tr>`;
    renderPagination("batchesPagination", 0, 0);
    return;
  }

  const filtered = getFilteredBatches();
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">No batches match your filters</td></tr>`;
    renderPagination("batchesPagination", 0, 0);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  batchesPage = Math.min(batchesPage, totalPages);
  const start     = (batchesPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = pageItems.map(b => {
    const app = allApps.find(a => a.id === b.app_id);
    return `
    <tr>
      <td>${b.thumbnail_url ? `<img class="thumb-prev" src="${esc(b.thumbnail_url)}" loading="lazy"/>` : ""}</td>
      <td style="font-weight:600">${esc(b.batch_name || "")}</td>
      <td style="color:var(--text-muted)">${esc(app?.app_name || b.app_id || "")}</td>
      <td>${b.featured ? `<span class="badge-featured">Featured</span>` : ""}</td>
      <td><div class="table-actions">
        <button class="btn-edit" data-id="${esc(b.id)}">Edit</button>
        <button class="btn-delete" data-id="${esc(b.id)}" data-name="${esc(b.batch_name || '')}">Delete</button>
      </div></td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll(".btn-edit").forEach(btn =>
    btn.addEventListener("click", () => openBatchModal(btn.dataset.id)));
  tbody.querySelectorAll(".btn-delete").forEach(btn =>
    btn.addEventListener("click", () => confirmDelete("batch", btn.dataset.id, btn.dataset.name)));

  renderPagination("batchesPagination", totalPages, batchesPage, p => { batchesPage = p; loadBatchesTable(); });
}

// Batch Modal
const batchModal      = document.getElementById("batchModal");
const batchModalTitle = document.getElementById("batchModalTitle");
const batchModalId    = document.getElementById("batchModalId");
const batchThumbInput = document.getElementById("batchThumb");
const batchThumbPrev  = document.getElementById("batchThumbPreview");
const batchStudyUrl   = document.getElementById("batchStudyUrl");
const studyUrlHint    = document.getElementById("studyUrlHint");

document.getElementById("addBatchBtn").addEventListener("click", () => openBatchModal());
document.getElementById("batchModalCancel").addEventListener("click", () => closeModal(batchModal));
batchModal.addEventListener("click", e => { if (e.target === batchModal) closeModal(batchModal); });

batchThumbInput.addEventListener("input", () => {
  const url = batchThumbInput.value.trim();
  if (url) { batchThumbPrev.src = url; batchThumbPrev.style.display = "inline-block"; }
  else       { batchThumbPrev.style.display = "none"; }
});

batchStudyUrl.addEventListener("input", () => {
  const url = batchStudyUrl.value.trim();
  if (url && !/^https?:\/\//i.test(url)) {
    studyUrlHint.textContent = "⚠ This doesn't start with https:// — it will fail to load.";
    studyUrlHint.style.color = "var(--red-500)";
  } else {
    studyUrlHint.textContent = "Must start with https:// — links like intent:// or market:// will not load.";
    studyUrlHint.style.color = "";
  }
});

document.getElementById("batchModalSave").addEventListener("click", async () => {
  const appId = document.getElementById("batchAppId").value.trim();
  const name  = document.getElementById("batchName").value.trim();
  const url   = document.getElementById("batchStudyUrl").value.trim();
  if (!appId || !name || !url) { showToast("App, Name, and Study URL are required", "error"); return; }
  if (!/^https?:\/\//i.test(url)) {
    showToast("Study URL must start with https:// to be embeddable", "error");
    return;
  }
  const data = {
    app_id:        appId,
    batch_name:    name,
    thumbnail_url: document.getElementById("batchThumb").value.trim(),
    study_url:     url,
    description:   document.getElementById("batchDesc").value.trim(),
    featured:      document.getElementById("batchFeatured").checked,
  };
  try {
    const id = batchModalId.value;
    if (id) { await updateBatch(id, data); showToast("Batch updated", "success"); }
    else    { await createBatch(data);     showToast("Batch created", "success"); }
    closeModal(batchModal);
    allBatches_ = await getAllBatches();
    loadBatchesTable();
  } catch(e) { showToast("Error: " + e.message, "error"); }
});

function openBatchModal(id) {
  const b = id ? allBatches_.find(x => x.id === id) : null;
  batchModalTitle.textContent = b ? "Edit Batch" : "Add Batch";
  batchModalId.value = id || "";
  populateBatchAppDropdown(b?.app_id);
  document.getElementById("batchName").value       = b?.batch_name    || "";
  document.getElementById("batchThumb").value      = b?.thumbnail_url || "";
  document.getElementById("batchStudyUrl").value   = b?.study_url     || "";
  document.getElementById("batchDesc").value       = b?.description   || "";
  document.getElementById("batchFeatured").checked = b?.featured      || false;
  if (b?.thumbnail_url) { batchThumbPrev.src = b.thumbnail_url; batchThumbPrev.style.display = "inline-block"; }
  else { batchThumbPrev.style.display = "none"; }
  studyUrlHint.textContent = "Must start with https:// — links like intent:// or market:// will not load.";
  studyUrlHint.style.color = "";
  openModal(batchModal);
}

// ── Confirm Delete ────────────────────────────────────────────
const confirmModal  = document.getElementById("confirmModal");
const confirmMsg    = document.getElementById("confirmMsg");
const confirmOk     = document.getElementById("confirmOk");
const confirmCancel = document.getElementById("confirmCancel");
let confirmResolve  = null;

function confirmDelete(type, id, name) {
  confirmMsg.textContent = `Delete "${name}"? This cannot be undone.`;
  openModal(confirmModal);
  confirmResolve = async () => {
    try {
      if (type === "app")   { await deleteApp_(id);  allApps     = await getApps_();      loadAppsTable(); }
      if (type === "batch") { await deleteBatch(id); allBatches_ = await getAllBatches(); loadBatchesTable(); }
      showToast("Deleted successfully", "success");
    } catch(e) { showToast("Error: " + e.message, "error"); }
    closeModal(confirmModal);
  };
}
confirmOk.addEventListener("click", () => confirmResolve?.());
confirmCancel.addEventListener("click", () => closeModal(confirmModal));
confirmModal.addEventListener("click", e => { if (e.target === confirmModal) closeModal(confirmModal); });

// ── Announcement ──────────────────────────────────────────────
async function loadAnnouncement() {
  const s = await getSettings();
  document.getElementById("annTextarea").value = s.announcement || "";
}
document.getElementById("saveAnnBtn").addEventListener("click", async () => {
  const text = document.getElementById("annTextarea").value.trim();
  try {
    await saveSettings({ announcement: text });
    showToast("Announcement saved", "success");
  } catch(e) { showToast("Error: " + e.message, "error"); }
});

// ── Sidebar Links ─────────────────────────────────────────────
const ICON_PRESETS = {
  home:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9.5a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/></svg>`,
  telegram:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>`,
  youtube:   `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.8 8s-.2-1.4-.8-2a2.9 2.9 0 0 0-2-1C17.2 4.8 12 4.8 12 4.8s-5.2 0-7 .2a2.9 2.9 0 0 0-2 1C2.4 6.6 2.2 8 2.2 8S2 9.6 2 11.2v1.5c0 1.6.2 3.2.2 3.2s.2 1.4.8 2a2.9 2.9 0 0 0 2 1c1.6.2 6.8.2 8 .2s5.2 0 7-.2a2.9 2.9 0 0 0 2-1c.6-.6.8-2 .8-2S22 13.3 22 11.7v-1.5C22 8.6 21.8 8 21.8 8zM9.7 14.5V9l5.4 2.8-5.4 2.7z"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><line x1="17.5" y1="6.5" x2="17.5" y2="6.5"/></svg>`,
  website:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  contact:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  whatsapp:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 3.4z"/></svg>`,
  discord:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="4"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/></svg>`,
  link:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
};
const ICON_LABELS = {
  home:"Home", telegram:"Telegram", youtube:"YouTube", instagram:"Instagram",
  website:"Website", contact:"Contact", whatsapp:"WhatsApp", discord:"Discord", link:"Generic Link",
};

let sidebarLinks = [];

async function loadSidebarLinks() {
  const s = await getSettings();
  sidebarLinks = s.sidebar_links || [
    { icon:"home",      label:"Home",       href:"index.html" },
    { icon:"telegram",  label:"Telegram",   href:"#" },
    { icon:"youtube",   label:"YouTube",    href:"#" },
    { icon:"instagram", label:"Instagram",  href:"#" },
    { icon:"website",   label:"Website",    href:"#" },
    { icon:"contact",   label:"Contact Us", href:"#" },
  ];
  sidebarLinks = sidebarLinks.map(l => ({
    ...l,
    icon: ICON_PRESETS[l.icon] ? l.icon : guessIconKey(l.label),
  }));
  renderLinksList();
}

function guessIconKey(label = "") {
  const k = label.toLowerCase();
  if (k.includes("home"))                return "home";
  if (k.includes("telegram"))            return "telegram";
  if (k.includes("youtube"))             return "youtube";
  if (k.includes("insta"))               return "instagram";
  if (k.includes("website") || k.includes("site")) return "website";
  if (k.includes("contact"))             return "contact";
  if (k.includes("whatsapp"))            return "whatsapp";
  if (k.includes("discord"))             return "discord";
  return "link";
}

function renderLinksList() {
  const el = document.getElementById("linksList");
  el.innerHTML = sidebarLinks.map((l, i) => `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <div style="width:38px;height:38px;border-radius:var(--r-sm);background:var(--surface-2);border:1px solid var(--border-default);display:flex;align-items:center;justify-content:center;color:var(--violet-500);flex-shrink:0">
        <span style="width:18px;height:18px;display:block">${ICON_PRESETS[l.icon] || ICON_PRESETS.link}</span>
      </div>
      <select class="form-input" style="width:130px;flex-shrink:0" data-i="${i}" data-f="icon">
        ${Object.keys(ICON_PRESETS).map(k => `<option value="${k}" ${l.icon === k ? "selected" : ""}>${ICON_LABELS[k]}</option>`).join("")}
      </select>
      <input class="form-input" style="flex:1" value="${esc(l.label)}" data-i="${i}" data-f="label" placeholder="Label"/>
      <input class="form-input" style="flex:2" value="${esc(l.href)}" data-i="${i}" data-f="href" placeholder="https://…"/>
      <button class="btn-delete" data-i="${i}" style="padding:6px 10px;border-radius:var(--r-xs);font-size:.8rem">✕</button>
    </div>`).join("");
  el.querySelectorAll("input, select").forEach(inp => {
    inp.addEventListener("input", () => {
      sidebarLinks[+inp.dataset.i][inp.dataset.f] = inp.value;
      if (inp.dataset.f === "icon") renderLinksList();
    });
    inp.addEventListener("change", () => {
      sidebarLinks[+inp.dataset.i][inp.dataset.f] = inp.value;
      if (inp.dataset.f === "icon") renderLinksList();
    });
  });
  el.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", () => {
      sidebarLinks.splice(+btn.dataset.i, 1);
      renderLinksList();
    });
  });
}

document.getElementById("addLinkBtn").addEventListener("click", () => {
  sidebarLinks.push({ icon:"link", label:"New Link", href:"#" });
  renderLinksList();
});
document.getElementById("saveLinksBtn").addEventListener("click", async () => {
  try {
    await saveSettings({ sidebar_links: sidebarLinks });
    showToast("Links saved", "success");
  } catch(e) { showToast("Error: " + e.message, "error"); }
});

// ── JSON Import ───────────────────────────────────────────────
let importData    = null;
let failedRecords = [];
const importDrop          = document.getElementById("importDrop");
const importFile          = document.getElementById("importFile");
const importPreview       = document.getElementById("importPreview");
const importBtn           = document.getElementById("importBtn");
const importResult        = document.getElementById("importResult");
const clearImportBtn      = document.getElementById("clearImportBtn");
const importProgressWrap  = document.getElementById("importProgressWrap");
const importProgressBar   = document.getElementById("importProgressBar");
const importProgressLabel = document.getElementById("importProgressLabel");
const importProgressPct   = document.getElementById("importProgressPct");
const downloadFailedBtn   = document.getElementById("downloadFailedBtn");

importDrop.addEventListener("click", () => importFile.click());
importDrop.addEventListener("dragover", e => { e.preventDefault(); importDrop.style.borderColor = "var(--border-2)"; });
importDrop.addEventListener("dragleave", () => { importDrop.style.borderColor = ""; });
importDrop.addEventListener("drop", e => {
  e.preventDefault(); importDrop.style.borderColor = "";
  const file = e.dataTransfer.files[0];
  if (file) readImportFile(file);
});
importFile.addEventListener("change", () => {
  if (importFile.files[0]) readImportFile(importFile.files[0]);
});

function readImportFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      importData = JSON.parse(e.target.result);
      if (!Array.isArray(importData)) throw new Error("JSON must be an array");
      importPreview.style.display = "block";
      importPreview.textContent   = JSON.stringify(importData.slice(0, 2), null, 2) + (importData.length > 2 ? "\n…" : "");
      importBtn.disabled = false; importBtn.style.opacity = "1";
      const badUrlCount = importData.filter(item => item.study_url && !/^https?:\/\//i.test(item.study_url)).length;
      let msg = `✅ ${importData.length} record(s) ready to import`;
      if (badUrlCount > 0) msg += ` — ⚠ ${badUrlCount} have a non-https study_url`;
      importResult.textContent = msg;
      downloadFailedBtn.style.display = "none";
      importProgressWrap.style.display = "none";
    } catch(err) {
      showToast("Invalid JSON: " + err.message, "error");
      importData = null;
    }
  };
  reader.readAsText(file);
}

function setImportProgress(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  importProgressBar.style.width      = pct + "%";
  importProgressLabel.textContent    = `${done} / ${total}`;
  importProgressPct.textContent      = pct + "%";
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

importBtn.addEventListener("click", async () => {
  if (!importData?.length) return;
  const CHUNK_SIZE = 40;
  const total = importData.length;
  const chunks = chunkArray(importData, CHUNK_SIZE);
  importBtn.disabled = true; importBtn.textContent = "Importing…";
  clearImportBtn.disabled = true;
  failedRecords = [];
  let success = 0; let done = 0;
  importProgressWrap.style.display = "block";
  setImportProgress(0, total);
  for (const chunk of chunks) {
    const results = await Promise.allSettled(chunk.map(item =>
      createBatch({
        app_id:        item.app_id || "",
        batch_name:    item.batch_name || "",
        thumbnail_url: item.thumbnail_url || "",
        study_url:     item.study_url || "",
        description:   item.description || "",
        featured:      item.featured || false,
      })
    ));
    results.forEach((r, i) => {
      if (r.status === "fulfilled") success++;
      else failedRecords.push({ ...chunk[i], _error: r.reason?.message || "Unknown error" });
    });
    done += chunk.length;
    setImportProgress(done, total);
  }
  const fail = failedRecords.length;
  importResult.textContent = `Imported: ${success} success, ${fail} failed (out of ${total})`;
  showToast(fail ? `${success} imported, ${fail} failed` : `${success} batches imported`, fail ? "error" : "success");
  importBtn.textContent = "Import to Firestore"; importBtn.disabled = false;
  clearImportBtn.disabled = false;
  downloadFailedBtn.style.display = fail > 0 ? "inline-block" : "none";
  allBatches_ = await getAllBatches();
});

downloadFailedBtn.addEventListener("click", () => {
  if (!failedRecords.length) return;
  downloadJSON(failedRecords, "edu-prime-failed-import.json");
});

clearImportBtn.addEventListener("click", () => {
  importData = null; importFile.value = ""; failedRecords = [];
  importPreview.style.display = "none"; importPreview.textContent = "";
  importBtn.disabled = true; importBtn.style.opacity = ".5";
  importResult.textContent = ""; importProgressWrap.style.display = "none";
  downloadFailedBtn.style.display = "none";
  setImportProgress(0, 0);
});

// ── Export ────────────────────────────────────────────────────
document.getElementById("exportAppsJson").addEventListener("click", async () => {
  const data = allApps.length ? allApps : await getApps_();
  downloadJSON(data, "edu-prime-apps.json");
});
document.getElementById("exportBatchesJson").addEventListener("click", async () => {
  const data = allBatches_.length ? allBatches_ : await getAllBatches();
  downloadJSON(data, "edu-prime-batches.json");
});
document.getElementById("exportAppsCSV").addEventListener("click", async () => {
  const data = allApps.length ? allApps : await getApps_();
  downloadCSV(data, ["id","app_name","description","cta_label","cta_style","popular","order"], "edu-prime-apps.csv");
});
document.getElementById("exportBatchesCSV").addEventListener("click", async () => {
  const data = allBatches_.length ? allBatches_ : await getAllBatches();
  downloadCSV(data, ["id","app_id","batch_name","description","featured","study_url","thumbnail_url"], "edu-prime-batches.csv");
});

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
  triggerDownload(blob, filename);
  showToast("Downloaded " + filename, "success");
}
function downloadCSV(data, fields, filename) {
  const header = fields.join(",");
  const rows   = data.map(row =>
    fields.map(f => {
      const v = String(row[f] ?? '').replace(/"/g, '""');
      return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v}"` : v;
    }).join(",")
  );
  const csv  = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type:"text/csv" });
  triggerDownload(blob, filename);
  showToast("Downloaded " + filename, "success");
}
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Modal helpers ─────────────────────────────────────────────
function openModal(el)  { el.classList.add("show");    document.body.style.overflow = "hidden"; }
function closeModal(el) { el.classList.remove("show"); document.body.style.overflow = ""; }

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = "") {
  const t = document.createElement("div");
  t.className = `toast${type ? " " + type : ""}`;
  t.textContent = msg;
  toastCont.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 3000);
}

// ── Util ──────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
