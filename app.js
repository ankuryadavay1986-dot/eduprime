// app.js — Edu Prime Home Page (UPDATED)
// Added: auth-aware header, user avatar, login button, per-user favourites
import { getApps_, getSettings, auth, onAuthStateChanged, signOut, db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {

  // ── DOM ──────────────────────────────────────────────────
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const sidebar      = document.getElementById("sidebar");
  const overlay      = document.getElementById("overlay");
  const sidebarClose = document.getElementById("sidebarClose");
  const sidebarNav   = document.getElementById("sidebarNav");
  const ytBtn        = document.getElementById("ytBtn");
  const annText      = document.getElementById("annText");
  const annText2     = document.getElementById("annText2");
  const appGrid      = document.getElementById("appGrid");
  const emptyState   = document.getElementById("emptyState");
  const toastCont    = document.getElementById("toastContainer");

  // User header elements (we'll inject these)
  let headerUserBtn = null;

  if (!hamburgerBtn || !sidebar || !appGrid) return;

  // ── Inject user button into header ──────────────────────
  const siteHeader = document.querySelector(".site-header");
  if (siteHeader) {
    // Create user avatar/login btn in top-right of header
    const userBtn = document.createElement("button");
    userBtn.id = "headerUserBtn";
    userBtn.setAttribute("aria-label", "Account");
    userBtn.style.cssText = `
      margin-left:auto; margin-right:0;
      width:36px; height:36px; border-radius:50%;
      background:linear-gradient(135deg,#7c3aed,#4f46e5);
      border:2px solid rgba(124,58,237,0.4);
      display:flex; align-items:center; justify-content:center;
      cursor:pointer; color:#fff; font-size:.8rem; font-weight:700;
      overflow:hidden; flex-shrink:0; transition:all .2s ease;
      box-shadow:0 2px 8px rgba(124,58,237,0.3);
    `;
    userBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    siteHeader.appendChild(userBtn);
    headerUserBtn = userBtn;

    userBtn.addEventListener("click", () => {
      const user = auth.currentUser;
      if (user) {
        showUserMenu(userBtn, user);
      } else {
        window.location.href = "login.html";
      }
    });
  }

  // ── User Dropdown Menu ───────────────────────────────────
  let menuEl = null;
  function showUserMenu(anchor, user) {
    removeMenu();
    const name  = user.displayName || user.email?.split("@")[0] || "User";
    const email = user.email || "";

    menuEl = document.createElement("div");
    menuEl.style.cssText = `
      position:fixed; top:60px; right:12px; z-index:500;
      background:#13111e; border:1px solid rgba(124,58,237,0.3);
      border-radius:16px; padding:6px; min-width:200px;
      box-shadow:0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
      animation:menuIn .18s ease;
    `;
    const style = document.createElement("style");
    style.textContent = `@keyframes menuIn { from { opacity:0; transform:translateY(-8px) scale(.95); } to { opacity:1; transform:none; } }`;
    document.head.appendChild(style);

    menuEl.innerHTML = `
      <div style="padding:10px 14px 12px;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:4px">
        <div style="font-size:.88rem;font-weight:700;color:#f0eeff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div>
        <div style="font-size:.72rem;color:#7a7a9a;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(email)}</div>
      </div>
      <button id="menuSettings" style="width:100%;padding:9px 14px;background:none;border:none;color:#c4b5fd;font-size:.82rem;font-weight:600;text-align:left;border-radius:10px;cursor:pointer;display:flex;align-items:center;gap:8px">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        Settings
      </button>
      <button id="menuSaved" style="width:100%;padding:9px 14px;background:none;border:none;color:#c4b5fd;font-size:.82rem;font-weight:600;text-align:left;border-radius:10px;cursor:pointer;display:flex;align-items:center;gap:8px">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        Saved Batches
        <span id="savedCount" style="margin-left:auto;background:rgba(124,58,237,0.2);color:#a78bfa;border-radius:20px;padding:1px 8px;font-size:.7rem">…</span>
      </button>
      <div style="height:1px;background:rgba(255,255,255,0.06);margin:4px 0"></div>
      <button id="menuLogout" style="width:100%;padding:9px 14px;background:none;border:none;color:#f87171;font-size:.82rem;font-weight:600;text-align:left;border-radius:10px;cursor:pointer;display:flex;align-items:center;gap:8px">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Sign Out
      </button>
    `;
    document.body.appendChild(menuEl);

    // Load saved count
    loadSavedCount(user.uid).then(count => {
      const el = document.getElementById("savedCount");
      if (el) el.textContent = count;
    });

    document.getElementById("menuSettings").addEventListener("click", () => {
      removeMenu(); window.location.href = "settings.html";
    });
    document.getElementById("menuSaved").addEventListener("click", () => {
      removeMenu();
      // Go to batch page with saved filter active (user's first app or last visited)
      const lastAppId = sessionStorage.getItem("ep_app_id");
      if (lastAppId) {
        window.location.href = `batch.html?appId=${encodeURIComponent(lastAppId)}&saved=1`;
      } else {
        window.location.href = "settings.html";
      }
    });
    document.getElementById("menuLogout").addEventListener("click", async () => {
      removeMenu();
      await signOut(auth);
      showToast("Signed out successfully", "success");
    });

    // Close on outside click
    setTimeout(() => {
      document.addEventListener("click", removeMenuOnOutside, { once: false });
    }, 10);
  }

  function removeMenuOnOutside(e) {
    if (menuEl && !menuEl.contains(e.target) && e.target !== headerUserBtn) {
      removeMenu();
      document.removeEventListener("click", removeMenuOnOutside);
    }
  }
  function removeMenu() {
    menuEl?.remove();
    menuEl = null;
  }

  // ── Load saved count from Firestore ─────────────────────
  async function loadSavedCount(uid) {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      const favs = snap.data()?.favourites || [];
      return favs.length;
    } catch { return 0; }
  }

  // ── Auth state → update header ───────────────────────────
  onAuthStateChanged(auth, user => {
    if (!headerUserBtn) return;
    if (user) {
      const name  = user.displayName || user.email || "U";
      const photo = user.photoURL;
      const initial = (name[0] || "U").toUpperCase();

      if (photo) {
        headerUserBtn.innerHTML = `<img src="${esc(photo)}" alt="${esc(initial)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.parentElement.textContent='${esc(initial)}'"/>`;
      } else {
        headerUserBtn.textContent = initial;
        headerUserBtn.style.fontSize = ".88rem";
      }
      headerUserBtn.title = name;
    } else {
      headerUserBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
      headerUserBtn.title = "Sign In";
    }
  });

  // ── Sidebar ──────────────────────────────────────────────
  function openSidebar() {
    sidebar.classList.add("open");
    overlay.classList.add("show");
    hamburgerBtn.classList.add("open");
  }
  function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
    hamburgerBtn.classList.remove("open");
  }
  hamburgerBtn.addEventListener("click", openSidebar);
  sidebarClose?.addEventListener("click", closeSidebar);
  overlay?.addEventListener("click", () => { closeSidebar(); removeMenu(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeSidebar(); removeMenu(); }
  });

  // Dark mode
  // ── Theme: system-aware + user override ──────────────────
  const darkToggle = document.getElementById("darkToggle");
  function applyTheme(isDark) {
    document.documentElement.classList.toggle("light-mode", !isDark);
    if (darkToggle) darkToggle.checked = isDark;
  }
  // 1. Check user saved preference
  const savedMode = localStorage.getItem("ep_dark_mode");
  let isDark;
  if (savedMode !== null) {
    isDark = savedMode === "1";
  } else {
    // 2. No preference saved — use system preference
    isDark = !window.matchMedia("(prefers-color-scheme: light)").matches;
  }
  applyTheme(isDark);
  // 3. Listen for system theme changes (if no user override)
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", e => {
    if (localStorage.getItem("ep_dark_mode") === null) {
      applyTheme(!e.matches);
    }
  });
  if (darkToggle) {
    darkToggle.addEventListener("change", () => {
      const d = darkToggle.checked;
      localStorage.setItem("ep_dark_mode", d ? "1" : "0");
      applyTheme(d);
    });
  }

  // ── Sidebar links ────────────────────────────────────────
  const ICONS = {
    home:      `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9.5a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/></svg>`,
    telegram:  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>`,
    youtube:   `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M21.8 8s-.2-1.4-.8-2a2.9 2.9 0 0 0-2-1C17.2 4.8 12 4.8 12 4.8s-5.2 0-7 .2a2.9 2.9 0 0 0-2 1C2.4 6.6 2.2 8 2.2 8S2 9.6 2 11.2v1.5c0 1.6.2 3.2.2 3.2s.2 1.4.8 2a2.9 2.9 0 0 0 2 1c1.6.2 6.8.2 8 .2s5.2 0 7-.2a2.9 2.9 0 0 0 2-1c.6-.6.8-2 .8-2S22 13.3 22 11.7v-1.5C22 8.6 21.8 8 21.8 8zM9.7 14.5V9l5.4 2.8-5.4 2.7z"/></svg>`,
    instagram: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><line x1="17.5" y1="6.5" x2="17.5" y2="6.5"/></svg>`,
    website:   `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    contact:   `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    whatsapp:  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 3.4z"/></svg>`,
    discord:   `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="4"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/></svg>`,
    link:      `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  };
  const DEFAULT_LINKS = [
    { icon: "home",     label: "Home",       href: "index.html" },
    { icon: "telegram", label: "Telegram",   href: "#" },
    { icon: "youtube",  label: "YouTube",    href: "#" },
    { icon: "instagram",label: "Instagram",  href: "#" },
    { icon: "website",  label: "Website",    href: "#" },
    { icon: "contact",  label: "Contact Us", href: "#" },
  ];

  function buildSidebarLinks(links) {
    if (!sidebarNav) return;
    sidebarNav.innerHTML = links.map((l, i) => {
      const iconSvg = ICONS[l.icon] || ICONS.link;
      const isHome = l.href === "index.html" || l.href === "./index.html";
      return `<a href="${esc(l.href)}" ${isHome ? "class='active'" : ""}>
        <span class="nav-icon">${iconSvg}</span>${esc(l.label)}
      </a>`;
    }).join("");
  }

  // ── App Card ─────────────────────────────────────────────
  const FALLBACK_ICON = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;

  function buildAppCard(app) {
    const badge    = app.popular ? `<span class="card-badge">Popular</span>` : "";
    const logo     = app.app_logo
      ? `<img src="${esc(app.app_logo)}" alt="${esc(app.app_name)}" loading="lazy"/>`
      : `<span class="logo-fallback">${FALLBACK_ICON}</span>`;
    const ctaLabel = app.cta_label || "Let's Study";
    const ctaClass = app.cta_style === "primary" ? "btn-study" : "btn-study btn-dark";
    return `
      <div class="app-card" data-id="${esc(app.id)}" data-name="${esc(app.app_name)}" role="button" tabindex="0">
        ${badge}
        <div class="app-logo-wrap">${logo}</div>
        <p class="app-name">${esc(app.app_name)}</p>
        <p class="app-desc">${esc(app.description || "")}</p>
        <button class="${ctaClass}">${esc(ctaLabel)}</button>
      </div>`;
  }

  function renderApps(apps) {
    const valid = (apps || []).filter(a => a && a.id != null && a.id !== "");
    if (!valid.length) {
      appGrid.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      return;
    }
    if (emptyState) emptyState.style.display = "none";
    appGrid.innerHTML = valid.map(buildAppCard).join("");

    appGrid.querySelectorAll(".btn-study").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const card = btn.closest(".app-card");
        navigateToBatch(card.dataset.id, card.dataset.name);
      });
    });
    appGrid.querySelectorAll(".app-card").forEach(card => {
      card.addEventListener("click", () => navigateToBatch(card.dataset.id, card.dataset.name));
      card.addEventListener("keydown", e => {
        if (e.key === "Enter") navigateToBatch(card.dataset.id, card.dataset.name);
      });
    });
  }

  function navigateToBatch(appId, appName) {
    if (!appId) { showToast("This app isn't available right now", "error"); return; }
    sessionStorage.setItem("ep_app_id",   appId);
    sessionStorage.setItem("ep_app_name", appName || "");
    window.location.href = `batch.html?appId=${encodeURIComponent(appId)}`;
  }

  // ── Toast ─────────────────────────────────────────────────
  function showToast(msg, type = "") {
    if (!toastCont) return;
    const t = document.createElement("div");
    t.className = `toast${type ? " " + type : ""}`;
    t.textContent = msg;
    toastCont.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 2800);
  }

  // ── Boot ──────────────────────────────────────────────────
  async function init() {
    // Apply dark mode immediately (respect system preference if user hasn't set one)
    const savedDark = localStorage.getItem("ep_dark_mode");
    const dark = savedDark !== null
      ? savedDark === "1"
      : !window.matchMedia("(prefers-color-scheme: light)").matches;
    document.documentElement.classList.toggle("light-mode", !dark);

    try {
      const [settingsRes, appsRes] = await Promise.allSettled([getSettings(), getApps_()]);
      const settings = settingsRes.status === "fulfilled" ? settingsRes.value : {};
      const apps     = appsRes.status    === "fulfilled" ? appsRes.value    : [];

      if (settings.youtube_url && ytBtn) ytBtn.href = settings.youtube_url;
      if (settings.announcement) {
        if (annText)  annText.textContent  = settings.announcement;
        if (annText2) annText2.textContent = settings.announcement;
      }

      // Build sidebar — support both icon key strings and SVG strings
      const links = settings.sidebar_links?.length ? settings.sidebar_links : DEFAULT_LINKS;
      buildSidebarLinks(links);
      renderApps(apps);

    } catch (err) {
      console.error("[app.js] init error:", err);
      appGrid.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
    }
  }

  init();

}); // end DOMContentLoaded

function esc(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
