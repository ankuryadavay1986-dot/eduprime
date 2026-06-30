/**
 * study.js — Edu Prime
 * Cards overlay synced scroll with iframe.
 */

import { trackClick } from './firebase.js';

/* ── DOM ── */
const backBtn        = document.getElementById('backBtn');
const studyTitle     = document.getElementById('studyTitle');
const progressBar    = document.getElementById('progressBar');
const studyLoader    = document.getElementById('studyLoader');
const loaderLabel    = document.getElementById('loaderLabel');
const loaderSlowIcon = document.getElementById('loaderSlowIcon');
const studyFrame     = document.getElementById('studyFrame');
const blockedOverlay = document.getElementById('blockedOverlay');
const openBrowserBtn = document.getElementById('openBrowserBtn');
const waFab          = document.getElementById('waFab');
const cardsLayer     = document.getElementById('cardsLayer');

/* ── PARAMS ── */
const params     = new URLSearchParams(location.search);
const BATCH_ID   = params.get('batchId')   || sessionStorage.getItem('ep_batch_id')   || '';
const BATCH_NAME = params.get('batchName') || sessionStorage.getItem('ep_batch_name') || 'Study';
const RAW_URL    = params.get('studyUrl')  || sessionStorage.getItem('ep_study_url')  || '';
const APP_ID     = params.get('appId')     || sessionStorage.getItem('ep_app_id')     || '';

if (RAW_URL)    sessionStorage.setItem('ep_study_url',  RAW_URL);
if (BATCH_NAME) sessionStorage.setItem('ep_batch_name', BATCH_NAME);
if (APP_ID)     sessionStorage.setItem('ep_app_id',     APP_ID);
if (BATCH_ID)   sessionStorage.setItem('ep_batch_id',   BATCH_ID);

/* ── URL VALIDATION ── */
function resolveLoadableUrl(raw) {
  if (!raw) return { url: '', embeddable: false };
  if (/^https?:\/\//i.test(raw)) return { url: raw, embeddable: true };
  const m = raw.match(/browser_fallback_url=([^;]+)/i);
  if (m) {
    const f = decodeURIComponent(m[1]);
    if (/^https?:\/\//i.test(f)) return { url: f, embeddable: true };
  }
  return { url: raw, embeddable: false };
}
const { url: STUDY_URL, embeddable: CAN_EMBED } = resolveLoadableUrl(RAW_URL);

/* ── INIT ── */
studyTitle.textContent = BATCH_NAME;
document.title = `${BATCH_NAME} — Edu Prime`;
if (STUDY_URL && openBrowserBtn) openBrowserBtn.href = STUDY_URL;
if (backBtn) backBtn.addEventListener('click', () => history.back());

if (!STUDY_URL || !CAN_EMBED) {
  showBlocked();
} else {
  startLoad(STUDY_URL);
  trackClick({ app_id: APP_ID, batch_id: BATCH_ID, batch_name: BATCH_NAME }).catch(() => {});
}

/* ── LOAD ── */
function startLoad(url) {
  studyLoader.style.display = 'flex';
  blockedOverlay.classList.remove('show');
  studyFrame.style.visibility = 'hidden';
  setMsg('Loading content…', false);
  animateProgress(0, 60, 1200);

  const t1 = setTimeout(() => { setMsg('Internet slow hai… Please wait ☕', true); animateProgress(60, 85, 8000); }, 8000);
  const t2 = setTimeout(() => { setMsg('Connection slow hai, try kar rahe hain…', true); }, 40000);
  const t3 = setTimeout(() => { clear(); showBlocked(); }, 90000);

  function clear() { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); }

  studyFrame.addEventListener('load',  () => { clear(); showContent(); }, { once: true });
  studyFrame.addEventListener('error', () => { clear(); showBlocked(); },  { once: true });

  try { studyFrame.src = url; }
  catch { clear(); showBlocked(); }
}

function setMsg(text, slow) {
  if (loaderLabel)    { loaderLabel.textContent = text; loaderLabel.style.color = slow ? 'rgba(147,197,253,.75)' : ''; }
  if (loaderSlowIcon)   loaderSlowIcon.style.display = slow ? 'block' : 'none';
}

function showContent() {
  animateProgress(85, 100, 300, () => {
    studyLoader.style.display = 'none';
    studyFrame.style.visibility = 'visible';
    progressBar.classList.add('done');
    setTimeout(() => { progressBar.classList.remove('done'); progressBar.style.width = '0%'; }, 700);

    // Show cards overlay
    if (cardsLayer) cardsLayer.classList.add('show');

    showWaFab();
  });
}

function showBlocked() {
  studyLoader.style.display = 'none';
  studyFrame.style.visibility = 'hidden';
  progressBar.style.width = '0%';
  blockedOverlay.classList.add('show');
}

/* ── PROGRESS BAR ── */
function animateProgress(from, to, duration, onDone) {
  const t0 = performance.now();
  (function step(now) {
    const p = Math.min((now - t0) / duration, 1);
    progressBar.style.width = (from + (to - from) * (1 - Math.pow(1 - p, 3))) + '%';
    if (p < 1) requestAnimationFrame(step);
    else if (onDone) onDone();
  })(t0);
}

/* ── WHATSAPP FLOATING BUTTON ── */
function showWaFab() {
  if (!waFab) return;
  const deleteZone = document.getElementById('waDeleteZone');

  setTimeout(() => waFab.classList.add('show'), 700);

  // ── Drag state ──
  let dragging = false;
  let startX = 0, startY = 0;
  let fabX = 0, fabY = 0;
  let movedEnough = false;
  const DRAG_THRESHOLD = 6; // px moved before drag mode starts

  function getFabInitialPos() {
    const r = waFab.getBoundingClientRect();
    return { x: r.left, y: r.top };
  }

  function onDragStart(clientX, clientY) {
    startX = clientX; startY = clientY;
    const pos = getFabInitialPos();
    fabX = pos.x; fabY = pos.y;
    movedEnough = false;
    dragging = true;
  }

  function onDragMove(clientX, clientY) {
    if (!dragging) return;
    const dx = clientX - startX;
    const dy = clientY - startY;

    if (!movedEnough && Math.sqrt(dx*dx + dy*dy) < DRAG_THRESHOLD) return;

    if (!movedEnough) {
      movedEnough = true;
      waFab.classList.add('dragging');
      waFab.style.transition = 'none';
      waFab.style.position = 'fixed';
      // Show delete zone
      if (deleteZone) deleteZone.classList.add('visible');
    }

    const newX = fabX + dx;
    const newY = fabY + dy;
    waFab.style.left = newX + 'px';
    waFab.style.top  = newY + 'px';
    waFab.style.right  = 'unset';
    waFab.style.bottom = 'unset';

    // Check overlap with delete zone
    if (deleteZone) {
      const dz = deleteZone.getBoundingClientRect();
      const fab = waFab.getBoundingClientRect();
      const fabCX = fab.left + fab.width / 2;
      const fabCY = fab.top + fab.height / 2;
      const dzCX  = dz.left + dz.width / 2;
      const dzCY  = dz.top + dz.height / 2;
      const dist  = Math.sqrt((fabCX - dzCX)**2 + (fabCY - dzCY)**2);
      const isOver = dist < (dz.width / 2 + fab.width / 2) * 0.65;
      deleteZone.classList.toggle('active', isOver);
      waFab.classList.toggle('over-delete', isOver);
    }
  }

  function onDragEnd() {
    if (!dragging) return;
    dragging = false;

    if (!movedEnough) {
      // It was a tap/click — open WhatsApp
      const link = waFab.dataset.waLink;
      if (link) window.open(link, '_blank', 'noopener,noreferrer');
      return;
    }

    // Check if dropped on delete zone
    if (deleteZone && deleteZone.classList.contains('active')) {
      // Remove the button with animation
      deleteZone.classList.remove('visible', 'active');
      waFab.style.transition = 'opacity .3s ease, transform .3s ease';
      waFab.style.opacity = '0';
      waFab.style.transform = 'scale(.3)';
      setTimeout(() => { waFab.remove(); }, 350);
    } else {
      // Snap back to original position
      waFab.style.transition = 'left .35s cubic-bezier(.34,1.56,.64,1), top .35s cubic-bezier(.34,1.56,.64,1), right .35s ease, bottom .35s ease';
      waFab.style.left   = '';
      waFab.style.top    = '';
      waFab.style.right  = '16px';
      waFab.style.bottom = '26px';
      waFab.classList.remove('dragging', 'over-delete');
      if (deleteZone) deleteZone.classList.remove('visible', 'active');
      setTimeout(() => { waFab.style.transition = ''; }, 400);
    }
  }

  // ── Touch events ──
  waFab.addEventListener('touchstart', e => {
    onDragStart(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!dragging) return;
    e.preventDefault();
    onDragMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

  document.addEventListener('touchend', () => onDragEnd());
  document.addEventListener('touchcancel', () => onDragEnd());

  // ── Mouse events (desktop) ──
  waFab.addEventListener('mousedown', e => {
    e.preventDefault();
    onDragStart(e.clientX, e.clientY);
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    onDragMove(e.clientX, e.clientY);
  });

  document.addEventListener('mouseup', () => onDragEnd());
}

/* ── FULLSCREEN TOGGLE ── */
(function () {
  const fsBtn      = document.getElementById('fsBtn');
  const fsIcon     = document.getElementById('fsIcon');
  const fsExitPill = document.getElementById('fsExitPill');
  const studyPage  = document.getElementById('studyPage');

  // SVG paths
  const SVG_EXPAND   = '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>';
  const SVG_COMPRESS = '<path d="M8 3v5H3"/><path d="M21 8h-5V3"/><path d="M3 16h5v5"/><path d="M16 21v-5h5"/>';

  let isFull = false;
  let pillTimer = null;

  function enterFull() {
    isFull = true;
    studyPage.classList.add('fs-mode');
    fsIcon.innerHTML = SVG_COMPRESS;
    fsIcon.setAttribute('viewBox', '0 0 24 24');
    // Show exit pill, auto-hide after 3s
    fsExitPill.classList.add('show');
    clearTimeout(pillTimer);
    pillTimer = setTimeout(() => fsExitPill.classList.remove('show'), 3000);
  }

  function exitFull() {
    isFull = false;
    studyPage.classList.remove('fs-mode');
    fsIcon.innerHTML = SVG_EXPAND;
    fsExitPill.classList.remove('show');
    clearTimeout(pillTimer);
  }

  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      if (isFull) exitFull(); else enterFull();
    });
  }

  if (fsExitPill) {
    fsExitPill.addEventListener('click', exitFull);
  }

  // Tap iframe area while in fullscreen → show pill again briefly
  document.getElementById('frameWrap')?.addEventListener('click', () => {
    if (!isFull) return;
    fsExitPill.classList.add('show');
    clearTimeout(pillTimer);
    pillTimer = setTimeout(() => fsExitPill.classList.remove('show'), 2500);
  });
})();

/* ── OPEN IN BROWSER ── */
if (openBrowserBtn) {
  openBrowserBtn.addEventListener('click', e => {
    e.preventDefault();
    if (STUDY_URL) window.open(STUDY_URL, '_blank', 'noopener,noreferrer');
  });
}

/* ── MISC ── */
document.body.style.overflow = 'hidden';
document.addEventListener('keydown', e => {
  const t = document.activeElement?.tagName;
  if (e.key === 'Backspace' && t !== 'INPUT' && t !== 'TEXTAREA') history.back();
});
