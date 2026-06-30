// ============================================================
// auth.js — Edu Prime Login / Signup Page
// Works with: login.html + firebase.js
// ============================================================

import {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  sendPasswordResetEmail,
  saveUserToFirestore,
} from "./firebase.js";

// ── If already logged in → go home ──────────────────────────
onAuthStateChanged(auth, user => {
  if (user) window.location.replace("index.html");
});

// ── DOM refs ─────────────────────────────────────────────────
const tabLogin    = document.getElementById("tabLogin");
const tabSignup   = document.getElementById("tabSignup");
const formLogin   = document.getElementById("formLogin");
const formSignup  = document.getElementById("formSignup");

// Login fields
const loginEmail  = document.getElementById("loginEmail");
const loginPass   = document.getElementById("loginPass");
const loginBtn    = document.getElementById("loginBtn");
const loginErr    = document.getElementById("loginErr");
const forgotBtn   = document.getElementById("forgotBtn");
const googleLogin = document.getElementById("googleLoginBtn");

// Signup fields
const signupName  = document.getElementById("signupName");
const signupEmail = document.getElementById("signupEmail");
const signupPass  = document.getElementById("signupPass");
const signupPass2 = document.getElementById("signupPass2");
const signupBtn   = document.getElementById("signupBtn");
const signupErr   = document.getElementById("signupErr");
const googleSignup= document.getElementById("googleSignupBtn");

// Password toggle eyes
document.querySelectorAll(".toggle-pass").forEach(btn => {
  btn.addEventListener("click", () => {
    const inp = document.getElementById(btn.dataset.target);
    if (!inp) return;
    const isText = inp.type === "text";
    inp.type = isText ? "password" : "text";
    btn.innerHTML = isText ? EYE_OPEN : EYE_CLOSED;
  });
});

const EYE_OPEN   = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_CLOSED = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

// ── Tab switch ───────────────────────────────────────────────
tabLogin?.addEventListener("click",  () => switchTab("login"));
tabSignup?.addEventListener("click", () => switchTab("signup"));

function switchTab(tab) {
  const isLogin = tab === "login";
  tabLogin?.classList.toggle("active", isLogin);
  tabSignup?.classList.toggle("active", !isLogin);
  formLogin?.classList.toggle("hidden", !isLogin);
  formSignup?.classList.toggle("hidden", isLogin);
  clearErrors();
}

// ── Email/Password LOGIN ─────────────────────────────────────
loginBtn?.addEventListener("click", async () => {
  clearErrors();
  const email = loginEmail?.value.trim() || "";
  const pass  = loginPass?.value         || "";
  if (!email || !pass) { showErr(loginErr, "Please enter your email and password."); return; }
  setLoading(loginBtn, true, "Signing in…");
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    await saveUserToFirestore(cred.user);
    // onAuthStateChanged handles redirect
  } catch(e) {
    showErr(loginErr, friendlyError(e.code));
    setLoading(loginBtn, false, "Sign In");
  }
});

// ── Email/Password SIGNUP ────────────────────────────────────
signupBtn?.addEventListener("click", async () => {
  clearErrors();
  const name  = signupName?.value.trim()  || "";
  const email = signupEmail?.value.trim() || "";
  const pass  = signupPass?.value         || "";
  const pass2 = signupPass2?.value        || "";

  if (!email || !pass)     { showErr(signupErr, "Please fill in all required fields."); return; }
  if (pass !== pass2)      { showErr(signupErr, "Passwords do not match."); return; }
  if (pass.length < 6)     { showErr(signupErr, "Password must be at least 6 characters."); return; }

  setLoading(signupBtn, true, "Creating account…");
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (name) await updateProfile(cred.user, { displayName: name });
    await saveUserToFirestore(cred.user, name);
    // onAuthStateChanged handles redirect
  } catch(e) {
    showErr(signupErr, friendlyError(e.code));
    setLoading(signupBtn, false, "Create Account");
  }
});

// ── Google Sign-In ───────────────────────────────────────────
async function handleGoogle() {
  clearErrors();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const result = await signInWithPopup(auth, provider);
    await saveUserToFirestore(result.user);
    // onAuthStateChanged handles redirect
  } catch(e) {
    if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
      showErr(loginErr,  friendlyError(e.code));
      showErr(signupErr, friendlyError(e.code));
    }
  }
}
googleLogin?.addEventListener("click",  handleGoogle);
googleSignup?.addEventListener("click", handleGoogle);

// ── Forgot Password ──────────────────────────────────────────
forgotBtn?.addEventListener("click", async () => {
  clearErrors();
  const email = loginEmail?.value.trim() || "";
  if (!email) { showErr(loginErr, "Enter your email address first, then tap Forgot password."); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    showErr(loginErr, "✅ Reset link sent! Check your inbox.", true);
  } catch(e) {
    showErr(loginErr, friendlyError(e.code));
  }
});

// ── Enter key submits ────────────────────────────────────────
loginPass?.addEventListener("keydown",  e => { if (e.key === "Enter") loginBtn?.click(); });
signupPass2?.addEventListener("keydown",e => { if (e.key === "Enter") signupBtn?.click(); });

// ── Helpers ──────────────────────────────────────────────────
function showErr(el, msg, success = false) {
  if (!el) return;
  const sp = el.querySelector("span"); if(sp) sp.textContent = msg; else el.textContent = msg;
  el.style.display    = "flex";
  el.style.color      = success ? "#10b981" : "#f87171";
  el.style.background = success ? "rgba(16,185,129,.10)" : "rgba(239,68,68,.10)";
  el.style.borderColor= success ? "rgba(16,185,129,.28)" : "rgba(239,68,68,.28)";
}
function clearErrors() {
  [loginErr, signupErr].forEach(el => {
    if (!el) return;
    el.textContent   = "";
    el.style.display = "none";
  });
}
function setLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled  = loading;
  btn.innerHTML = loading
    ? `<span class="btn-spinner"></span>${label}`
    : label;
}
function friendlyError(code) {
  const map = {
    "auth/user-not-found":        "No account found with this email.",
    "auth/wrong-password":        "Incorrect password. Try again.",
    "auth/invalid-credential":    "Invalid email or password.",
    "auth/email-already-in-use":  "This email is already registered. Try signing in.",
    "auth/invalid-email":         "Please enter a valid email address.",
    "auth/too-many-requests":     "Too many attempts. Please wait a few minutes.",
    "auth/weak-password":         "Password is too weak. Use at least 6 characters.",
    "auth/popup-closed-by-user":  "Google sign-in was cancelled.",
    "auth/network-request-failed":"No internet connection. Please check your network.",
    "auth/user-disabled":         "This account has been disabled.",
  };
  return map[code] || "Something went wrong. Please try again.";
}
