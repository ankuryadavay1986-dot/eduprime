// login.js — Edu Prime Login Page
import {
  auth, db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  doc, setDoc, getDoc, serverTimestamp
} from './firebase.js';

/* ══════════════════════════════════════════════
   DARK MODE (apply before render)
══════════════════════════════════════════════ */
const _savedDark = localStorage.getItem('ep_dark_mode');
const isDark = _savedDark !== null
  ? _savedDark === '1'
  : !window.matchMedia('(prefers-color-scheme: light)').matches;
if (!isDark) document.documentElement.classList.add('light-mode');

// Keep following the system theme live if the user hasn't chosen one manually
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
  if (localStorage.getItem('ep_dark_mode') === null) {
    document.documentElement.classList.toggle('light-mode', e.matches);
  }
});

/* ══════════════════════════════════════════════
   WHERE TO GO AFTER LOGIN
══════════════════════════════════════════════ */
const REDIRECT_AFTER_LOGIN = 'index.html';

/* ══════════════════════════════════════════════
   DOM
══════════════════════════════════════════════ */
const tabLogin        = document.getElementById('tabLogin');
const tabRegister     = document.getElementById('tabRegister');
const loginSection    = document.getElementById('loginSection');
const registerSection = document.getElementById('registerSection');
const mainContent     = document.getElementById('mainContent');
const successOverlay  = document.getElementById('successOverlay');
const successTitle    = document.getElementById('successTitle');
const btnSkip         = document.getElementById('btnSkip');
const footerPrivacy   = document.getElementById('footerPrivacy');

// Login inputs
const loginEmail    = document.getElementById('loginEmail');
const loginPass     = document.getElementById('loginPass');
const btnLogin      = document.getElementById('btnLogin');
const btnForgot     = document.getElementById('btnForgot');
const btnGoogle     = document.getElementById('btnGoogle');
const toggleLoginPass = document.getElementById('toggleLoginPass');
const loginPassIcon   = document.getElementById('loginPassIcon');

// Register inputs
const regName       = document.getElementById('regName');
const regEmail      = document.getElementById('regEmail');
const regPass       = document.getElementById('regPass');
const btnRegister   = document.getElementById('btnRegister');
const btnGoogleReg  = document.getElementById('btnGoogleReg');
const toggleRegPass = document.getElementById('toggleRegPass');
const regPassIcon   = document.getElementById('regPassIcon');

// Password strength
const strengthBar   = document.getElementById('strengthBar');
const strengthLabel = document.getElementById('strengthLabel');
const seg1 = document.getElementById('seg1');
const seg2 = document.getElementById('seg2');
const seg3 = document.getElementById('seg3');
const seg4 = document.getElementById('seg4');

// Alerts
const alertError   = document.getElementById('alertError');
const alertSuccess = document.getElementById('alertSuccess');
const alertInfo    = document.getElementById('alertInfo');
const alertErrorText   = document.getElementById('alertErrorText');
const alertSuccessText = document.getElementById('alertSuccessText');
const alertInfoText    = document.getElementById('alertInfoText');

/* ══════════════════════════════════════════════
   AUTH STATE — already logged in → redirect
══════════════════════════════════════════════ */
onAuthStateChanged(auth, user => {
  if (user) {
    showSuccess(user);
  }
});

/* ══════════════════════════════════════════════
   TABS
══════════════════════════════════════════════ */
tabLogin.addEventListener('click', () => switchTab('login'));
tabRegister.addEventListener('click', () => switchTab('register'));

function switchTab(tab) {
  clearAlerts();
  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginSection.style.display    = '';
    registerSection.style.display = 'none';
  } else {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    loginSection.style.display    = 'none';
    registerSection.style.display = '';
  }
}

/* ══════════════════════════════════════════════
   ALERTS
══════════════════════════════════════════════ */
function clearAlerts() {
  alertError.classList.remove('show');
  alertSuccess.classList.remove('show');
  alertInfo.classList.remove('show');
}
function showError(msg) {
  clearAlerts();
  alertErrorText.textContent = msg;
  alertError.classList.add('show');
}
function showSuccess_(msg) {
  clearAlerts();
  alertSuccessText.textContent = msg;
  alertSuccess.classList.add('show');
}
function showInfo(msg) {
  clearAlerts();
  alertInfoText.textContent = msg;
  alertInfo.classList.add('show');
}

/* ══════════════════════════════════════════════
   SHOW SUCCESS SCREEN → then redirect
══════════════════════════════════════════════ */
function showSuccess(user) {
  const name = user.displayName?.split(' ')[0] || 'back';
  successTitle.textContent = `Welcome, ${name}! 🎉`;
  mainContent.style.display  = 'none';
  btnSkip.style.display      = 'none';
  successOverlay.classList.add('show');

  // Redirect after short delay
  setTimeout(() => {
    window.location.href = REDIRECT_AFTER_LOGIN;
  }, 1200);
}

/* ══════════════════════════════════════════════
   TOGGLE PASSWORD VISIBILITY
══════════════════════════════════════════════ */
const EYE_OPEN = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
const EYE_OFF  = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;

toggleLoginPass?.addEventListener('click', () => {
  const isPass = loginPass.type === 'password';
  loginPass.type = isPass ? 'text' : 'password';
  loginPassIcon.innerHTML = isPass ? EYE_OFF : EYE_OPEN;
});

toggleRegPass?.addEventListener('click', () => {
  const isPass = regPass.type === 'password';
  regPass.type = isPass ? 'text' : 'password';
  regPassIcon.innerHTML = isPass ? EYE_OFF : EYE_OPEN;
});

/* ══════════════════════════════════════════════
   PASSWORD STRENGTH
══════════════════════════════════════════════ */
regPass?.addEventListener('input', () => {
  const val = regPass.value;
  if (!val) {
    strengthBar.classList.remove('show');
    strengthLabel.textContent = '';
    return;
  }
  strengthBar.classList.add('show');

  let score = 0;
  if (val.length >= 6)  score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
  if (/\d/.test(val) && /[^A-Za-z0-9]/.test(val)) score++;

  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  const segs   = [seg1, seg2, seg3, seg4];

  segs.forEach((s, i) => {
    s.style.background = i < score ? colors[score - 1] : 'rgba(255,255,255,0.1)';
  });
  strengthLabel.textContent = labels[score - 1] || '';
  strengthLabel.style.color = colors[score - 1] || '';
});

/* ══════════════════════════════════════════════
   SAVE USER TO FIRESTORE
══════════════════════════════════════════════ */
async function saveUserToFirestore(user, displayName) {
  try {
    const ref  = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      // New user — create document
      await setDoc(ref, {
        uid:        user.uid,
        email:      user.email,
        name:       displayName || user.displayName || '',
        photoURL:   user.photoURL || '',
        createdAt:  serverTimestamp(),
        lastLogin:  serverTimestamp(),
        favourites: [],   // start with empty favourites
      });
    } else {
      // Existing user — update lastLogin
      await setDoc(ref, { lastLogin: serverTimestamp() }, { merge: true });
    }
  } catch (e) {
    console.warn('Firestore user save:', e);
  }
}

/* ══════════════════════════════════════════════
   MIGRATE localStorage FAVOURITES → Firestore
   (one-time, for users who had local favs)
══════════════════════════════════════════════ */
async function migrateLocalFavs(uid) {
  try {
    const raw = localStorage.getItem('ep_favourites');
    if (!raw) return;
    const localFavs = JSON.parse(raw);
    if (!Array.isArray(localFavs) || localFavs.length === 0) return;

    const ref  = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    const firestoreFavs = snap.data()?.favourites || [];

    // Merge: add local favs that are not already in Firestore
    const merged = [...firestoreFavs];
    localFavs.forEach(lf => {
      if (!merged.some(ff => ff.id === lf.id)) merged.push(lf);
    });

    await setDoc(ref, { favourites: merged }, { merge: true });
    localStorage.removeItem('ep_favourites'); // clear local copy
  } catch (e) {
    console.warn('Migrate favs:', e);
  }
}

/* ══════════════════════════════════════════════
   LOGIN WITH EMAIL
══════════════════════════════════════════════ */
btnLogin.addEventListener('click', handleLogin);
loginPass.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
loginEmail.addEventListener('keydown', e => { if (e.key === 'Enter') loginPass.focus(); });

async function handleLogin() {
  const email = loginEmail.value.trim();
  const pass  = loginPass.value;
  clearAlerts();

  if (!email) { showError('Please enter your email address.'); loginEmail.focus(); return; }
  if (!pass)  { showError('Please enter your password.'); loginPass.focus(); return; }

  setLoading(btnLogin, true);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    await saveUserToFirestore(cred.user, '');
    await migrateLocalFavs(cred.user.uid);
    // onAuthStateChanged → showSuccess → redirect
  } catch (e) {
    showError(friendlyError(e.code));
    setLoading(btnLogin, false);
  }
}

/* ══════════════════════════════════════════════
   REGISTER WITH EMAIL
══════════════════════════════════════════════ */
btnRegister.addEventListener('click', handleRegister);
regPass.addEventListener('keydown', e => { if (e.key === 'Enter') handleRegister(); });

async function handleRegister() {
  const name  = regName.value.trim();
  const email = regEmail.value.trim();
  const pass  = regPass.value;
  clearAlerts();

  if (!name)  { showError('Please enter your full name.'); regName.focus(); return; }
  if (!email) { showError('Please enter your email address.'); regEmail.focus(); return; }
  if (!pass)  { showError('Please enter a password.'); regPass.focus(); return; }
  if (pass.length < 6) { showError('Password must be at least 6 characters.'); regPass.focus(); return; }

  setLoading(btnRegister, true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    await saveUserToFirestore(cred.user, name);
    await migrateLocalFavs(cred.user.uid);
    // onAuthStateChanged → showSuccess → redirect
  } catch (e) {
    showError(friendlyError(e.code));
    setLoading(btnRegister, false);
  }
}

/* ══════════════════════════════════════════════
   GOOGLE SIGN IN
══════════════════════════════════════════════ */
async function handleGoogle() {
  clearAlerts();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await signInWithPopup(auth, provider);
    await saveUserToFirestore(result.user, result.user.displayName || '');
    await migrateLocalFavs(result.user.uid);
    // onAuthStateChanged → showSuccess → redirect
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user') {
      showError(friendlyError(e.code));
    }
  }
}
btnGoogle?.addEventListener('click', handleGoogle);
btnGoogleReg?.addEventListener('click', handleGoogle);

/* ══════════════════════════════════════════════
   FORGOT PASSWORD
══════════════════════════════════════════════ */
btnForgot.addEventListener('click', async () => {
  const email = loginEmail.value.trim();
  if (!email) {
    showInfo('Enter your email above, then click "Forgot password?"');
    loginEmail.focus();
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showSuccess_('Password reset email sent! Check your inbox (and spam folder).');
  } catch (e) {
    showError(friendlyError(e.code));
  }
});

/* ══════════════════════════════════════════════
   GUEST / SKIP
══════════════════════════════════════════════ */
btnSkip.addEventListener('click', () => {
  window.location.href = REDIRECT_AFTER_LOGIN;
});

/* ══════════════════════════════════════════════
   PRIVACY POLICY
══════════════════════════════════════════════ */
footerPrivacy.addEventListener('click', async e => {
  e.preventDefault();
  try {
    const { getSettings } = await import('./firebase.js');
    const s = await getSettings();
    if (s.privacy_url) window.open(s.privacy_url, '_blank', 'noopener');
    else showInfo('Privacy policy coming soon.');
  } catch { showInfo('Privacy policy coming soon.'); }
});

/* ══════════════════════════════════════════════
   LOADING STATE
══════════════════════════════════════════════ */
function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
}

/* ══════════════════════════════════════════════
   ERROR MESSAGES
══════════════════════════════════════════════ */
function friendlyError(code) {
  const map = {
    'auth/user-not-found':        'No account found with this email. Please register.',
    'auth/wrong-password':        'Incorrect password. Try again or reset it.',
    'auth/invalid-email':         'Invalid email address format.',
    'auth/too-many-requests':     'Too many failed attempts. Try again in a few minutes.',
    'auth/invalid-credential':    'Invalid email or password. Please try again.',
    'auth/email-already-in-use':  'This email is already registered. Please sign in instead.',
    'auth/weak-password':         'Password is too weak. Use at least 6 characters.',
    'auth/network-request-failed':'Network error. Please check your connection.',
    'auth/popup-blocked':         'Popup was blocked. Please allow popups and try again.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled.',
    'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}
