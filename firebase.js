// ============================================================
// firebase.js — Edu Prime | Firebase SDK v10 (ESM CDN)
// UPDATED: Google Auth + createUser + sendPasswordReset added
// ============================================================

import { initializeApp, getApps, getApp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, getDoc,
  addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot,
  serverTimestamp, Timestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getStorage
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ── Config ──────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBgaQRFgYTIJFMzz3no8WxB-nzhjIMpyWA",
  authDomain: "edu-prime-875a7.firebaseapp.com",
  projectId: "edu-prime-875a7",
  storageBucket: "edu-prime-875a7.firebasestorage.app",
  messagingSenderId: "186796623516",
  appId: "1:186796623516:web:6686cd1c30ff1332d08f59",
};

// ── Singleton ────────────────────────────────────────────────
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);

// ── Re-exports ───────────────────────────────────────────────
export {
  collection, doc, getDocs, getDoc, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, Timestamp, writeBatch,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
};

// ── Admin check ──────────────────────────────────────────────
// Admin = Firebase "admins" collection me UID document exist karta ho
// Ya phir email = ADMIN_EMAIL (backward compat for existing admin.js)
export const ADMIN_EMAIL = "adminstudy@gmail.com";

export async function isAdmin(uid) {
  if (!uid) return false;
  try {
    const snap = await getDoc(doc(db, "admins", uid));
    return snap.exists();
  } catch { return false; }
}

// ── Save user to Firestore on first login ────────────────────
export async function saveUserToFirestore(user, displayName) {
  const name = displayName || user.displayName || "";
  const ref  = doc(db, "users", user.uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid:       user.uid,
        email:     user.email,
        name,
        photoURL:  user.photoURL || "",
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      });
    } else {
      await setDoc(ref, { lastLogin: serverTimestamp() }, { merge: true });
    }
  } catch(e) { console.warn("saveUser:", e); }
}

// ============================================================
// APPS
// ============================================================
export async function getApps_() {
  const snap = await getDocs(query(collection(db, "apps"), orderBy("order","asc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function createApp(data)     { return addDoc(collection(db,"apps"), data); }
export async function updateApp(id, data) { return updateDoc(doc(db,"apps",id), data); }
export async function deleteApp_(id)      { return deleteDoc(doc(db,"apps",id)); }

// ============================================================
// BATCHES
// ============================================================
export async function getBatches(appId) {
  const snap = await getDocs(query(collection(db,"batches"), where("app_id","==",appId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function getAllBatches() {
  const snap = await getDocs(collection(db,"batches"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function createBatch(data)    { return addDoc(collection(db,"batches"), data); }
export async function updateBatch(id,data) { return updateDoc(doc(db,"batches",id), data); }
export async function deleteBatch(id)      { return deleteDoc(doc(db,"batches",id)); }

// ============================================================
// SETTINGS
// ============================================================
export async function getSettings() {
  try {
    const snap = await getDoc(doc(db,"settings","global"));
    return snap.exists() ? snap.data() : {};
  } catch { return {}; }
}
export async function saveSettings(data) {
  return setDoc(doc(db,"settings","global"), data, { merge: true });
}

// ============================================================
// ANALYTICS
// ============================================================
function getDeviceType() {
  return /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop";
}
function getBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes("Chrome"))  return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari"))  return "Safari";
  if (ua.includes("Edge"))    return "Edge";
  return "Other";
}
function getVisitorId() {
  let id = localStorage.getItem("ep_visitor_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("ep_visitor_id", id); }
  return id;
}
export async function trackClick({ app_id, batch_id, batch_name }) {
  try {
    await addDoc(collection(db,"analytics"), {
      visitor_id:  getVisitorId(),
      app_id, batch_id, batch_name,
      timestamp:   serverTimestamp(),
      device_type: getDeviceType(),
      browser:     getBrowser(),
    });
  } catch(e) { console.warn("Analytics error:", e); }
}
export async function getAnalytics() {
  const snap = await getDocs(query(collection(db,"analytics"), orderBy("timestamp","desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
