// settings.js — Edu Prime (CLEAN — no auth modal, login.html se login hoga)
import {
  auth, db,
  onAuthStateChanged,
  signOut,
  updateProfile,
  updatePassword,
  getSettings,
  doc, setDoc, getDoc, serverTimestamp
} from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {

  // ── DOM ───────────────────────────────────────────────────
  const sidebar           = document.getElementById('sidebar');
  const overlay           = document.getElementById('overlay');
  const sidebarClose      = document.getElementById('sidebarClose');
  const backBtn           = document.getElementById('backBtn');
  const toastCont         = document.getElementById('toastContainer');
  const darkToggle        = document.getElementById('darkToggle');
  const darkToggleSidebar = document.getElementById('darkToggleSidebar');
  const notifToggle       = document.getElementById('notifToggle');
  const clearCacheItem    = document.getElementById('clearCacheItem');
  const shareItem         = document.getElementById('shareItem');
  const rateItem          = document.getElementById('rateItem');
  const versionItem       = document.getElementById('versionItem');
  const versionLabel      = document.getElementById('versionLabel');
  const telegramLink      = document.getElementById('telegramLink');
  const instaLink         = document.getElementById('instaLink');
  const youtubeLink       = document.getElementById('youtubeLink');
  const privacyItem       = document.getElementById('privacyItem');
  const contactItem       = document.getElementById('contactItem');
  const contactMeta       = document.getElementById('contactMeta');
  const telegramMeta      = document.getElementById('telegramMeta');

  // Profile DOM
  const profileLoggedIn    = document.getElementById('profileLoggedIn');
  const profileLoggedOut   = document.getElementById('profileLoggedOut');
  const profileAvatar      = document.getElementById('profileAvatar');
  const profileName        = document.getElementById('profileName');
  const profileEmailDisplay= document.getElementById('profileEmailDisplay');
  const goLoginBtn         = document.getElementById('goLoginBtn');
  const logoutBtn          = document.getElementById('logoutBtn');
  const editProfileBtn     = document.getElementById('editProfileBtn');

  // Edit Profile Modal DOM
  const editProfileOverlay = document.getElementById('editProfileOverlay');
  const editProfileClose   = document.getElementById('editProfileClose');
  const editAvatarDisplay  = document.getElementById('editAvatarDisplay');
  const editName           = document.getElementById('editName');
  const editPass           = document.getElementById('editPass');
  const saveProfileBtn     = document.getElementById('saveProfileBtn');
  const editError          = document.getElementById('editError');
  const editSuccess        = document.getElementById('editSuccess');

  // ── Sidebar ───────────────────────────────────────────────
  sidebarClose?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('show');
  });
  overlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('show');
    closeEditModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      sidebar?.classList.remove('open');
      overlay?.classList.remove('show');
      closeEditModal();
    }
  });

  // ── Back Button ───────────────────────────────────────────
  backBtn?.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = 'index.html';
  });

  // ── Toast ─────────────────────────────────────────────────
  function showToast(msg, type = '') {
    if (!toastCont) return;
    const t = document.createElement('div');
    t.className = `toast${type ? ' ' + type : ''}`;
    t.textContent = msg;
    toastCont.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 400);
    }, 2600);
  }

  // ── Dark Mode ─────────────────────────────────────────────
  const DARK_KEY = 'ep_dark_mode';
  function applyDark(on) {
    document.documentElement.classList.toggle('light-mode', !on);
    if (darkToggle)        darkToggle.checked        = on;
    if (darkToggleSidebar) darkToggleSidebar.checked = on;
    if (window.__epSetThemeColor) window.__epSetThemeColor(!on);
    window.dispatchEvent(new CustomEvent('ep-theme-change', { detail: { dark: on } }));
  }
  const savedDark = localStorage.getItem(DARK_KEY);
  // Use system preference if no user override saved
  const systemDark = !window.matchMedia("(prefers-color-scheme: light)").matches;
  applyDark(savedDark === null ? systemDark : savedDark === '1');
  // Also listen for system changes when no preference saved
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", e => {
    if (localStorage.getItem(DARK_KEY) === null) applyDark(!e.matches);
  });

  const onDarkChange = e => {
    const on = e.target.checked;
    localStorage.setItem(DARK_KEY, on ? '1' : '0');
    applyDark(on);
  };
  darkToggle?.addEventListener('change', onDarkChange);
  darkToggleSidebar?.addEventListener('change', onDarkChange);

  // ── Notifications ─────────────────────────────────────────
  const NOTIF_KEY = 'ep_notifications';
  if (notifToggle) {
    notifToggle.checked = localStorage.getItem(NOTIF_KEY) !== '0';
    notifToggle.addEventListener('change', () => {
      localStorage.setItem(NOTIF_KEY, notifToggle.checked ? '1' : '0');
      showToast(notifToggle.checked ? 'Notifications enabled' : 'Notifications turned off');
    });
  }

  // ── Clear Cache ───────────────────────────────────────────
  clearCacheItem?.addEventListener('click', async () => {
    try {
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      sessionStorage.clear();
      showToast('Cache cleared ✓', 'success');
    } catch {
      showToast('Could not clear cache', 'error');
    }
  });

  // ── Share App ─────────────────────────────────────────────
  shareItem?.addEventListener('click', async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Edu Prime',
          text: 'Check out Edu Prime — your study companion!',
          url: window.location.origin,
        });
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        showToast('Link copied to clipboard', 'success');
      }
    } catch { /* cancelled */ }
  });

  // ── Rate Us ───────────────────────────────────────────────
  rateItem?.addEventListener('click', () => {
    if (navigator.share) {
      navigator.share({
        title: 'Rate Edu Prime',
        text: 'I love Edu Prime! Check it out.',
        url: window.location.origin,
      }).catch(() => {});
    } else {
      showToast('Thank you for your support! ⭐', 'success');
    }
  });

  // ── Load Firebase Settings → apply links ──────────────────
  async function loadFirebaseSettings() {
    try {
      const s = await getSettings();
      if (s.telegram_url  && telegramLink) { telegramLink.href = s.telegram_url; if (telegramMeta) telegramMeta.textContent = 'Join our Telegram channel'; }
      if (s.instagram_url && instaLink)    { instaLink.href    = s.instagram_url; }
      if (s.youtube_url   && youtubeLink)  { youtubeLink.href  = s.youtube_url; }
      if (s.privacy_url   && privacyItem)  { privacyItem.href  = s.privacy_url; }
      if (s.contact_email && contactItem)  { contactItem.dataset.email = s.contact_email; if (contactMeta) contactMeta.textContent = s.contact_email; }
      else if (s.contact_url && contactItem) { contactItem.dataset.url = s.contact_url; }
    } catch (e) {
      console.warn('Settings load:', e);
    }
  }
  loadFirebaseSettings();

  // ── Contact Us ────────────────────────────────────────────
  contactItem?.addEventListener('click', () => {
    const email = contactItem.dataset.email;
    const url   = contactItem.dataset.url;
    if (email)    window.location.href = `mailto:${email}`;
    else if (url) window.open(url, '_blank', 'noopener');
    else          showToast('Contact info coming soon', '');
  });

  // ── Privacy Policy fallback ───────────────────────────────
  privacyItem?.addEventListener('click', e => {
    if (privacyItem.getAttribute('href') === '#') {
      e.preventDefault();
      showToast('Privacy policy coming soon', '');
    }
  });

  // ── Hidden Admin (version × 5 taps in 3s) ────────────────
  let tapCount = 0, tapTimer = null;
  versionItem?.addEventListener('click', () => {
    tapCount++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { tapCount = 0; }, 3000);
    if (tapCount >= 5) {
      tapCount = 0;
      clearTimeout(tapTimer);
      window.location.href = 'admin.html';
    }
  });

  // ══════════════════════════════════════════════════════════
  // PROFILE — Auth State
  // ══════════════════════════════════════════════════════════

  function getInitial(name, email) {
    if (name?.trim()) return name.trim()[0].toUpperCase();
    if (email)        return email[0].toUpperCase();
    return 'U';
  }

  function renderProfile(user) {
    if (user) {
      profileLoggedOut.style.display = 'none';
      profileLoggedIn.style.display  = 'block';

      const name  = user.displayName || '';
      const email = user.email       || '';
      const photo = user.photoURL    || '';

      if (profileName)         profileName.textContent         = name || email.split('@')[0] || 'User';
      if (profileEmailDisplay) profileEmailDisplay.textContent = email;

      if (profileAvatar) {
        if (photo) {
          profileAvatar.innerHTML = `<img src="${photo}" alt="avatar" onerror="this.parentElement.textContent='${getInitial(name,email)}'"/>`;
        } else {
          profileAvatar.textContent = getInitial(name, email);
        }
      }
    } else {
      profileLoggedOut.style.display = 'block';
      profileLoggedIn.style.display  = 'none';
    }
  }

  onAuthStateChanged(auth, user => renderProfile(user));

  // ── Sign In → go to login.html ────────────────────────────
  goLoginBtn?.addEventListener('click', () => {
    window.location.href = 'login.html';
  });

  // ── Sign Out ──────────────────────────────────────────────
  logoutBtn?.addEventListener('click', async () => {
    try {
      await signOut(auth);
      showToast('Signed out successfully', 'success');
    } catch {
      showToast('Sign out failed', 'error');
    }
  });

  // ══════════════════════════════════════════════════════════
  // EDIT PROFILE MODAL
  // ══════════════════════════════════════════════════════════

  function openEditModal() {
    const user = auth.currentUser;
    if (!user) return;

    editError.style.display   = 'none';
    editSuccess.style.display = 'none';
    editError.textContent     = '';
    editSuccess.textContent   = '';
    editName.value = user.displayName || '';
    editPass.value = '';

    // Avatar
    const name  = user.displayName || '';
    const email = user.email       || '';
    const photo = user.photoURL    || '';
    if (editAvatarDisplay) {
      editAvatarDisplay.textContent = '';
      if (photo) {
        editAvatarDisplay.innerHTML = `<img src="${photo}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
      } else {
        editAvatarDisplay.textContent = getInitial(name, email);
      }
    }

    editProfileOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeEditModal() {
    editProfileOverlay?.classList.remove('show');
    document.body.style.overflow = '';
  }

  editProfileBtn?.addEventListener('click', openEditModal);
  editProfileClose?.addEventListener('click', closeEditModal);
  editProfileOverlay?.addEventListener('click', e => {
    if (e.target === editProfileOverlay) closeEditModal();
  });

  // ── Save Profile Changes ──────────────────────────────────
  saveProfileBtn?.addEventListener('click', async () => {
    const user    = auth.currentUser;
    if (!user) return;

    const newName = editName.value.trim();
    const newPass = editPass.value;

    editError.style.display   = 'none';
    editSuccess.style.display = 'none';

    if (!newName) {
      editError.textContent   = 'Name cannot be empty.';
      editError.style.display = 'block';
      return;
    }
    if (newPass && newPass.length < 6) {
      editError.textContent   = 'Password must be at least 6 characters.';
      editError.style.display = 'block';
      return;
    }

    saveProfileBtn.disabled   = true;
    saveProfileBtn.textContent = 'Saving…';

    try {
      // Update display name
      if (newName !== user.displayName) {
        await updateProfile(user, { displayName: newName });
      }

      // Update password
      if (newPass) {
        await updatePassword(user, newPass);
      }

      // Sync to Firestore users collection
      try {
        await setDoc(doc(db, 'users', user.uid), { name: newName, lastLogin: serverTimestamp() }, { merge: true });
      } catch (fe) { console.warn('Firestore sync:', fe); }

      editSuccess.textContent   = 'Profile updated successfully!';
      editSuccess.style.display = 'block';
      renderProfile(auth.currentUser);
      showToast('Profile updated ✓', 'success');
      setTimeout(() => closeEditModal(), 1300);

    } catch (e) {
      const msgs = {
        'auth/requires-recent-login': 'Please sign out and sign back in before changing your password.',
        'auth/weak-password':         'Password must be at least 6 characters.',
      };
      editError.textContent   = msgs[e.code] || e.message || 'Something went wrong.';
      editError.style.display = 'block';
    } finally {
      saveProfileBtn.disabled   = false;
      saveProfileBtn.textContent = 'Save Changes';
    }
  });

}); // end DOMContentLoaded
