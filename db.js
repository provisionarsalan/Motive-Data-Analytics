// ============================================================
// 🗄️ DATABASE LAYER — MOTIVE ANALYTICS PRO
// Firebase Firestore + localStorage offline fallback
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs,
  deleteDoc, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, updatePassword,
  EmailAuthProvider, reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let _app, _db, _auth;
let _firebaseReady = false;

// ── Init ──────────────────────────────────────────────────────
export function initFirebase(config) {
  try {
    if (!config || config.apiKey === "PASTE_YOUR_API_KEY_HERE") {
      console.warn("⚠️ Firebase not configured — offline/local mode active.");
      _firebaseReady = false;
      return false;
    }
    _app  = initializeApp(config);
    _db   = getFirestore(_app);
    _auth = getAuth(_app);
    _firebaseReady = true;
    console.log("✅ Firebase connected");
    return true;
  } catch (e) {
    console.warn("⚠️ Firebase init error:", e.message);
    _firebaseReady = false;
    return false;
  }
}

export const isOnline   = () => _firebaseReady;
export const getAuth_   = () => _auth;

// ── Auth ──────────────────────────────────────────────────────
export async function loginAdmin(email, password) {
  if (!_firebaseReady) throw new Error("Firebase not configured. Add your API keys to config/firebase-config.js");
  return signInWithEmailAndPassword(_auth, email, password);
}

export async function logoutAdmin() {
  if (_firebaseReady && _auth) await signOut(_auth);
  sessionStorage.removeItem("ma_admin_session");
}

export function watchAuth(cb) {
  if (!_firebaseReady) { cb(null); return () => {}; }
  return onAuthStateChanged(_auth, cb);
}

export async function changePassword(currentPw, newPw) {
  const user = _auth?.currentUser;
  if (!user) throw new Error("Not authenticated");
  const cred = EmailAuthProvider.credential(user.email, currentPw);
  await reauthenticateWithCredential(user, cred);
  await updatePassword(user, newPw);
}

// ── Settings ──────────────────────────────────────────────────
export async function getSettings(key) {
  if (!_firebaseReady) return JSON.parse(localStorage.getItem("ma_settings_" + key) || "null");
  try {
    const snap = await getDoc(doc(_db, "settings", key));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

export async function saveSettings(key, data) {
  if (!_firebaseReady) { localStorage.setItem("ma_settings_" + key, JSON.stringify(data)); return; }
  await setDoc(doc(_db, "settings", key), { ...data, _ts: serverTimestamp() }, { merge: true });
}

// ── Pods ──────────────────────────────────────────────────────
export async function getPods() {
  if (!_firebaseReady) return JSON.parse(localStorage.getItem("motive_pods") || '["General"]');
  try {
    const snap = await getDocs(collection(_db, "pods"));
    return snap.empty ? ["General"] : snap.docs.map(d => d.data().name).filter(Boolean);
  } catch { return ["General"]; }
}

export async function addPod(name) {
  const pods = await getPods();
  if (pods.includes(name)) return;
  if (!_firebaseReady) { pods.push(name); localStorage.setItem("motive_pods", JSON.stringify(pods)); return; }
  await setDoc(doc(_db, "pods", name.replace(/\s/g, "_")), { name, _ts: serverTimestamp() });
}

export async function deletePodFromDB(name) {
  if (!_firebaseReady) {
    const pods = (await getPods()).filter(p => p !== name);
    localStorage.setItem("motive_pods", JSON.stringify(pods));
    return;
  }
  await deleteDoc(doc(_db, "pods", name.replace(/\s/g, "_")));
}

// ── Members ───────────────────────────────────────────────────
export async function getMembers() {
  if (!_firebaseReady) return JSON.parse(localStorage.getItem("motive_master_links") || "[]");
  try {
    const snap = await getDocs(collection(_db, "members"));
    return snap.docs.map(d => d.data());
  } catch { return []; }
}

export async function upsertMember(member) {
  const id = member.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  if (!_firebaseReady) {
    const list = await getMembers();
    const i = list.findIndex(m => m.name === member.name);
    if (i > -1) list[i] = member; else list.push(member);
    localStorage.setItem("motive_master_links", JSON.stringify(list));
    return;
  }
  await setDoc(doc(_db, "members", id), { ...member, _ts: serverTimestamp() }, { merge: true });
}

export async function bulkUpsertMembers(list) {
  if (!_firebaseReady) { localStorage.setItem("motive_master_links", JSON.stringify(list)); return; }
  const batch = writeBatch(_db);
  list.forEach(m => {
    const id = m.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    batch.set(doc(_db, "members", id), { ...m, _ts: serverTimestamp() }, { merge: true });
  });
  await batch.commit();
}

export async function deleteMemberFromDB(name) {
  const id = name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  if (!_firebaseReady) {
    const list = (await getMembers()).filter(m => m.name !== name);
    localStorage.setItem("motive_master_links", JSON.stringify(list));
    return;
  }
  await deleteDoc(doc(_db, "members", id));
}

// ── Performance Data ──────────────────────────────────────────
export async function getAllPerf() {
  if (!_firebaseReady) return JSON.parse(localStorage.getItem("motive_pro_db") || "[]");
  try {
    const snap = await getDocs(collection(_db, "performanceData"));
    return snap.docs.map(d => d.data());
  } catch { return []; }
}

export async function bulkUpsertPerf(rows) {
  if (!_firebaseReady) { localStorage.setItem("motive_pro_db", JSON.stringify(rows)); return; }
  // Firestore batch max 500 ops — chunk it
  const chunkSize = 400;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const batch = writeBatch(_db);
    rows.slice(i, i + chunkSize).forEach(row => {
      const id = `${row.Clean_Name}_${row.Clean_Week}`.replace(/[^a-zA-Z0-9_\-]/g, "_");
      batch.set(doc(_db, "performanceData", id), { ...row, _ts: serverTimestamp() }, { merge: true });
    });
    await batch.commit();
  }
}

export async function deletePerfRow(name, week) {
  const id = `${name}_${week}`.replace(/[^a-zA-Z0-9_\-]/g, "_");
  if (!_firebaseReady) {
    const rows = (await getAllPerf()).filter(r => !(r.Clean_Name === name && r.Clean_Week === week));
    localStorage.setItem("motive_pro_db", JSON.stringify(rows));
    return;
  }
  await deleteDoc(doc(_db, "performanceData", id));
}

export async function clearAllPerf() {
  if (!_firebaseReady) { localStorage.removeItem("motive_pro_db"); return; }
  const snap = await getDocs(collection(_db, "performanceData"));
  const batch = writeBatch(_db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

// ── QA Data ───────────────────────────────────────────────────
export async function getAllQA() {
  if (!_firebaseReady) return JSON.parse(localStorage.getItem("motive_qa_parsed_db") || "{}");
  try {
    const snap = await getDocs(collection(_db, "qaData"));
    const out = {};
    snap.docs.forEach(d => { const { key, data } = d.data(); if (key) out[key] = data; });
    return out;
  } catch { return {}; }
}

export async function saveAllQA(parsed) {
  if (!_firebaseReady) { localStorage.setItem("motive_qa_parsed_db", JSON.stringify(parsed)); return; }
  const batch = writeBatch(_db);
  Object.keys(parsed).forEach(key => {
    const id = key.replace(/[^a-zA-Z0-9_\-]/g, "_") || "all";
    batch.set(doc(_db, "qaData", id), { key, data: parsed[key], _ts: serverTimestamp() }, { merge: true });
  });
  await batch.commit();
}

export async function clearAllQA() {
  if (!_firebaseReady) { localStorage.removeItem("motive_qa_parsed_db"); return; }
  const snap = await getDocs(collection(_db, "qaData"));
  const batch = writeBatch(_db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}
