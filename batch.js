/**
 * batch.js — Edu Prime
 * Per-user favourites: saved in Firestore under users/{uid}/favourites
 * Guests: falls back to localStorage (migrated on next login)
 */

'use strict';

import { db, auth, onAuthStateChanged } from './firebase.js';
import {
  collection, query, where, getDocs,
  doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* ═══════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════ */
const IMG_FALLBACK = 'https://i.ibb.co/9k8fbHmZ/empty-state.png';
const PAGE_SIZE    = 35;

/* ═══════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════ */
let allBatches       = [];
let displayedBatches = [];
let currentPage      = 1;
let searchQuery      = '';
let activeFilters    = { classes: [], savedOnly: false };
let favourites       = [];   // array of { id, batch_name, app_id, ... }
let currentUser      = null; // Firebase user or null (guest)
let isSearchOpen     = false;
let favsLoaded       = false;

const urlParams = new URLSearchParams(window.location.search);
const APP_ID    = urlParams.get('appId') || sessionStorage.getItem('ep_app_id') || '';
const APP_NAME  = sessionStorage.getItem('ep_app_name') || 'Batches';

/* ═══════════════════════════════════════════════════════════
   DOM REFS
═══════════════════════════════════════════════════════════ */
const grid              = document.getElementById('batches-grid');
const skeleton          = document.getElementById('loading-skeletons');
const emptyState        = document.getElementById('empty-state');
const loadMoreContainer = document.getElementById('load-more-container');
const batchCount        = document.getElementById('batch-count');
const headerTitle       = document.getElementById('header-title');
const searchContainer   = document.getElementById('search-container');
const searchInput       = document.getElementById('search-input');
const btnSearchToggle   = document.getElementById('btn-search-toggle');
const searchIcon        = document.getElementById('search-icon');
const btnFilter         = document.getElementById('btn-filter');
const filterDropdown    = document.getElementById('filter-dropdown');
const filterCount       = document.getElementById('filter-count');
const btnApplyFilters   = document.getElementById('btn-apply-filters');
const btnClearFilters   = document.getElementById('btn-clear-filters');
const filterOptions     = document.querySelectorAll('.filter-option');
const btnLoadMore       = document.getElementById('btn-load-more');

if (headerTitle) headerTitle.textContent = APP_NAME || 'Batches';
document.title = `${APP_NAME || 'Batches'} — Edu Prime`;

/* ═══════════════════════════════════════════════════════════
   AUTH LISTENER — track current user
═══════════════════════════════════════════════════════════ */
onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) {
    await loadFavsFromFirestore(user.uid);
  } else {
    loadFavsFromLocal();
  }
  favsLoaded = true;
  // Re-render cards to show correct fav state
  if (allBatches.length) {
    applyFiltersAndSearch();
  }
});

/* ═══════════════════════════════════════════════════════════
   LOAD FAVOURITES
═══════════════════════════════════════════════════════════ */

// Firestore — each user's favs under users/{uid}.favourites array
async function loadFavsFromFirestore(uid) {
  try {
    const ref  = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      favourites = snap.data().favourites || [];
    } else {
      favourites = [];
    }
  } catch (e) {
    console.warn('[batch.js] loadFavs Firestore:', e);
    loadFavsFromLocal(); // fallback
  }
}

// Guest — localStorage
function loadFavsFromLocal() {
  try {
    favourites = JSON.parse(localStorage.getItem('ep_favourites') || '[]');
  } catch { favourites = []; }
}

/* ═══════════════════════════════════════════════════════════
   SAVE FAVOURITES
═══════════════════════════════════════════════════════════ */
async function saveFavs() {
  if (currentUser) {
    // Save to Firestore
    try {
      const ref = doc(db, 'users', currentUser.uid);
      await setDoc(ref, { favourites }, { merge: true });
    } catch (e) {
      console.warn('[batch.js] saveFavs Firestore:', e);
      // Fallback to local
      try { localStorage.setItem('ep_favourites', JSON.stringify(favourites)); } catch {}
    }
  } else {
    // Guest — save to localStorage
    try { localStorage.setItem('ep_favourites', JSON.stringify(favourites)); } catch {}
  }
}

/* ═══════════════════════════════════════════════════════════
   FETCH BATCHES FROM FIREBASE
═══════════════════════════════════════════════════════════ */
async function fetchBatches() {
  showSkeleton(true);
  grid.innerHTML = '';

  try {
    if (!APP_ID) throw new Error('No app selected. Go back and choose an app.');

    const q    = query(
      collection(db, 'batches'),
      where('app_id', '==', APP_ID)
    );
    const snap = await getDocs(q);
    allBatches = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    allBatches.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      const ao = a.order ?? 999;
      const bo = b.order ?? 999;
      if (ao !== bo) return ao - bo;
      return (a.batch_name || '').localeCompare(b.batch_name || '');
    });

  } catch (err) {
    console.error('[batch.js] fetchBatches:', err);
    showToast(err.message || 'Failed to load batches. Please refresh.', 'error');
  }

  showSkeleton(false);
  applyFiltersAndSearch();
}

/* ═══════════════════════════════════════════════════════════
   FILTER + SEARCH
═══════════════════════════════════════════════════════════ */
function applyFiltersAndSearch() {
  const q = searchQuery.toLowerCase();

  displayedBatches = allBatches.filter(b => {
    const name = (b.batch_name || '').toLowerCase();
    const desc = (b.description || '').toLowerCase();

    if (q && !name.includes(q) && !desc.includes(q)) return false;

    if (activeFilters.savedOnly) {
      if (!favourites.some(f => f.id === b.id)) return false;
    }

    if (activeFilters.classes.length) {
      const nameUp = (b.batch_name || '').toUpperCase();
      const cls    = String(b.class || b.standard || '');
      const matched = activeFilters.classes.some(f => {
        if (f === '11')  return nameUp.includes('11') || cls.includes('11');
        if (f === '12')  return (nameUp.includes('12') || cls.includes('12'))
                                && !nameUp.includes('12+') && !/DROPPER/i.test(nameUp);
        if (f === '12+') return nameUp.includes('12+') || /DROPPER/i.test(nameUp);
        return false;
      });
      if (!matched) return false;
    }

    return true;
  });

  const n = displayedBatches.length;
  if (batchCount) batchCount.textContent = `${n} batch${n !== 1 ? 'es' : ''} found`;

  currentPage = 1;
  grid.innerHTML = '';
  renderPage();
}

/* ═══════════════════════════════════════════════════════════
   RENDER PAGE
═══════════════════════════════════════════════════════════ */
function renderPage() {
  const start = (currentPage - 1) * PAGE_SIZE;
  const end   = start + PAGE_SIZE;
  const slice = displayedBatches.slice(start, end);

  if (!slice.length && currentPage === 1) {
    emptyState.classList.remove('hidden');
    loadMoreContainer.classList.add('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  const fragment = document.createDocumentFragment();
  slice.forEach((batch, idx) => fragment.appendChild(buildCard(batch, idx)));
  grid.appendChild(fragment);

  loadMoreContainer.classList.toggle('hidden', end >= displayedBatches.length);
}

/* ═══════════════════════════════════════════════════════════
   BUILD CARD
═══════════════════════════════════════════════════════════ */
function buildCard(batch, idx) {
  const isFav      = favourites.some(f => f.id === batch.id);
  const isFeatured = !!batch.featured;
  const thumb      = batch.thumbnail_url || IMG_FALLBACK;
  const name       = batch.batch_name   || 'Untitled Batch';
  const desc       = batch.description  || '';
  const cls        = batch.class        || batch.standard || '';

  let badges = '';
  if (isFeatured) {
    badges += `<div class="badge badge-trending">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>Featured</div>`;
  }
  if (isFav) {
    badges += `<div class="badge badge-enrolled">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>Saved</div>`;
  }

  let metaHtml = '';
  if (cls) {
    metaHtml += `<span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>Class ${esc(cls)}</span>`;
  }
  if (desc) {
    metaHtml += `<span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
        <line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>${esc(desc.length > 40 ? desc.slice(0, 40) + '…' : desc)}</span>`;
  }
  if (!metaHtml) {
    metaHtml = `<span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>Interactive Batch</span>`;
  }

  const safeId   = esc(batch.id   || '');
  const safeName = esc(name);

  const card = document.createElement('div');
  card.className = 'card animate-fadeSlideUp';
  card.style.animationDelay = `${Math.min(idx, 8) * 45}ms`;

  card.innerHTML = `
    <div class="card-image-wrap">
      ${badges}
      <img src="${esc(thumb)}" alt="${safeName}" loading="lazy" decoding="async"
           onerror="this.onerror=null;this.src='${IMG_FALLBACK}'"/>
      <div class="card-image-overlay"></div>
    </div>
    <div class="card-body">
      <p class="card-title">${safeName}</p>
      <div class="card-meta">${metaHtml}</div>
      <div class="card-actions">
        <button class="btn btn-primary" data-action="study"
          data-id="${safeId}" data-name="${safeName}"
          data-url="${esc(batch.study_url || '')}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Let's Study
        </button>
        <button class="btn ${isFav ? 'btn-danger' : 'btn-secondary'}" data-action="fav"
          data-id="${safeId}" data-name="${safeName}"
          data-url="${esc(batch.study_url || '')}"
          data-thumb="${esc(batch.thumbnail_url || '')}"
          aria-label="${isFav ? 'Remove from saved' : 'Save batch'}">
          <svg width="14" height="14" viewBox="0 0 24 24"
               fill="${isFav ? 'currentColor' : 'none'}"
               stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          ${isFav ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>`;

  return card;
}

/* ═══════════════════════════════════════════════════════════
   EVENT DELEGATION — card buttons
═══════════════════════════════════════════════════════════ */
grid.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id, name, url, thumb } = btn.dataset;
  if (action === 'study') handleStudy(id, name, url);
  if (action === 'fav')   handleFav(btn, id, name, url, thumb);
});

/* ── Study ── */
function handleStudy(id, name, url) {
  sessionStorage.setItem('ep_batch_id',   id);
  sessionStorage.setItem('ep_batch_name', name);
  sessionStorage.setItem('ep_study_url',  url || '');
  sessionStorage.setItem('ep_app_id',     APP_ID);
  sessionStorage.setItem('ep_app_name',   APP_NAME);
  window.location.href = `study.html?batchId=${encodeURIComponent(id)}`;
}

/* ── Favourite Toggle ── */
const SVG_HEART_EMPTY  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
const SVG_HEART_FILLED = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

async function handleFav(btn, id, name, url, thumb) {
  // If guest, prompt to login
  if (!currentUser) {
    showToast('Sign in to save your favourites across devices! 💡', 'info');
    // Still allow local save for guests
  }

  const idx = favourites.findIndex(f => f.id === id);

  if (idx > -1) {
    // REMOVE
    favourites.splice(idx, 1);
    btn.className = 'btn btn-secondary';
    btn.setAttribute('aria-label', 'Save batch');
    btn.innerHTML = `${SVG_HEART_EMPTY} Save`;
    btn.closest('.card')?.querySelector('.badge-enrolled')?.remove();
    showToast('Removed from saved', 'error');
  } else {
    // ADD
    const favObj = {
      id,
      batch_name:    name,
      app_id:        APP_ID,
      app_name:      APP_NAME,
      study_url:     url   || allBatches.find(b => b.id === id)?.study_url     || '',
      thumbnail_url: thumb || allBatches.find(b => b.id === id)?.thumbnail_url || '',
      savedAt:       new Date().toISOString(),
    };
    favourites.push(favObj);

    btn.className = 'btn btn-danger';
    btn.setAttribute('aria-label', 'Remove from saved');
    btn.innerHTML = `${SVG_HEART_FILLED} Saved`;

    const wrap = btn.closest('.card')?.querySelector('.card-image-wrap');
    if (wrap && !wrap.querySelector('.badge-enrolled')) {
      wrap.insertAdjacentHTML('beforeend', `
        <div class="badge badge-enrolled">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>Saved
        </div>`);
    }
    showToast('Saved! ❤️', 'success');
  }

  // Save to Firestore or localStorage
  await saveFavs();

  // If saved-only filter is active, re-apply
  if (activeFilters.savedOnly) applyFiltersAndSearch();
}

/* ═══════════════════════════════════════════════════════════
   SEARCH
═══════════════════════════════════════════════════════════ */
const SVG_SEARCH = `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`;
const SVG_CLOSE  = `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`;

function openSearch() {
  isSearchOpen = true;
  headerTitle.classList.add('fade-out');
  searchContainer.classList.add('open');
  btnSearchToggle.classList.add('is-active');
  if (searchIcon) searchIcon.innerHTML = SVG_CLOSE;
  btnSearchToggle.setAttribute('aria-label', 'Close search');
  // Wait for the container to finish expanding before focusing,
  // so the keyboard/caret doesn't jump in mid-animation.
  setTimeout(() => searchInput.focus(), 200);
}
function closeSearch() {
  isSearchOpen = false;
  headerTitle.classList.remove('fade-out');
  searchContainer.classList.remove('open');
  btnSearchToggle.classList.remove('is-active');
  if (searchIcon) searchIcon.innerHTML = SVG_SEARCH;
  btnSearchToggle.setAttribute('aria-label', 'Open search');
  if (searchQuery) { searchInput.value = ''; searchQuery = ''; applyFiltersAndSearch(); }
}

btnSearchToggle?.addEventListener('click', () => isSearchOpen ? closeSearch() : openSearch());
searchInput?.addEventListener('input', e => { searchQuery = e.target.value.trim(); applyFiltersAndSearch(); });
searchInput?.addEventListener('search', () => { if (!searchInput.value) { searchQuery = ''; applyFiltersAndSearch(); } });

/* ═══════════════════════════════════════════════════════════
   FILTER
═══════════════════════════════════════════════════════════ */
const openFilter  = () => { filterDropdown.classList.add('open');    btnFilter.setAttribute('aria-expanded','true');  };
const closeFilter = () => { filterDropdown.classList.remove('open'); btnFilter.setAttribute('aria-expanded','false'); };

btnFilter?.addEventListener('click', e => {
  e.stopPropagation();
  filterDropdown.classList.contains('open') ? closeFilter() : openFilter();
});
document.addEventListener('click', e => {
  if (btnFilter && filterDropdown && !btnFilter.contains(e.target) && !filterDropdown.contains(e.target)) closeFilter();
});

filterOptions.forEach(opt => {
  const doToggle = () => {
    const sel = opt.classList.toggle('selected');
    opt.setAttribute('aria-checked', sel);
    opt.querySelector('.filter-checkbox svg').setAttribute('stroke', sel ? 'white' : 'transparent');
  };
  opt.addEventListener('click', doToggle);
  opt.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doToggle(); } });
});

btnApplyFilters?.addEventListener('click', () => {
  activeFilters.classes = [];
  if (document.getElementById('opt-11')?.classList.contains('selected'))   activeFilters.classes.push('11');
  if (document.getElementById('opt-12')?.classList.contains('selected'))   activeFilters.classes.push('12');
  if (document.getElementById('opt-12p')?.classList.contains('selected'))  activeFilters.classes.push('12+');
  activeFilters.savedOnly = !!document.getElementById('opt-saved')?.classList.contains('selected');
  const n = activeFilters.classes.length + (activeFilters.savedOnly ? 1 : 0);
  if (filterCount) { filterCount.textContent = n; filterCount.classList.toggle('hidden', n === 0); }
  btnFilter.classList.toggle('active', n > 0);
  closeFilter();
  applyFiltersAndSearch();
});

btnClearFilters?.addEventListener('click', () => {
  filterOptions.forEach(opt => {
    opt.classList.remove('selected');
    opt.setAttribute('aria-checked','false');
    opt.querySelector('.filter-checkbox svg').setAttribute('stroke','transparent');
  });
  activeFilters.classes = [];
  activeFilters.savedOnly = false;
  if (filterCount) filterCount.classList.add('hidden');
  btnFilter?.classList.remove('active');
  closeFilter();
  applyFiltersAndSearch();
});

/* ═══════════════════════════════════════════════════════════
   LOAD MORE
═══════════════════════════════════════════════════════════ */
btnLoadMore?.addEventListener('click', () => {
  currentPage++;
  renderPage();
  requestAnimationFrame(() => {
    const cards = grid.querySelectorAll('.card');
    cards[cards.length - PAGE_SIZE]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
});

/* ═══════════════════════════════════════════════════════════
   ESCAPE KEY
═══════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (filterDropdown?.classList.contains('open')) { closeFilter(); return; }
  if (isSearchOpen) closeSearch();
});

/* ═══════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════ */
function showToast(msg, type = 'success') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icons = {
    success: '<polyline points="20 6 9 17 4 12"/>',
    error:   '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    info:    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  };
  t.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5">${icons[type] || icons.success}</svg>
    ${esc(msg)}`;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity 280ms ease, transform 280ms ease';
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(-10px)';
    setTimeout(() => t.remove(), 280);
  }, 3000);
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function showSkeleton(show) { skeleton?.classList.toggle('hidden', !show); }

function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ═══════════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════════ */
fetchBatches();
