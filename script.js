// ============================================================
// 🚀 MOTIVE ANALYTICS PRO — MAIN SCRIPT (Firebase Upgraded)
// ============================================================

import { FIREBASE_CONFIG } from "firebase-config.js";
import {
  initFirebase, isOnline, loginAdmin, logoutAdmin, watchAuth,
  getPods, addPod, deletePodFromDB,
  getMembers, upsertMember, bulkUpsertMembers, deleteMemberFromDB,
  getAllPerf, bulkUpsertPerf, deletePerfRow,
  getAllQA, saveAllQA,
  getSettings, saveSettings
} from "./db.js";
import { injectAdminPanel, openAdminPanel, applyDashboardSettings } from "./admin.js";

// ── Global State ──────────────────────────────────────────────
window._db_cache_perf    = [];  // performance rows
window._db_cache_qa      = {};  // parsed QA data
window._db_cache_members = [];  // master links
window._db_cache_pods    = ["General"];

let db              = window._db_cache_perf;
let parsedGlobalData= window._db_cache_qa;
let masterLinks     = window._db_cache_members;
let pods            = window._db_cache_pods;
let globalTargets   = {};
let currentResultData = [];

let barChartInstance = null, lineChartInstance = null, pieChartInstance = null;
let qaBarChart = null, qaLineChart = null, qaPieChart = null, qaFactorPieChart = null;

let isLoginMode = true;
let currentAdminUser = null;

// ── Constants ─────────────────────────────────────────────────
const qaCats = [
  "Alert Driving QA","Cellphone QA","Camera Installation Issue QA","Close Following QA",
  "Collision EMS - QA","Collision / Possible Collision QA","DF Cam Obstruction QA","Distraction QA",
  "Driver Eating QA","Drowsiness QA","FCW QA","Forward Parking QA","Invalid Collision - QA",
  "Lane cutoff QA","Lane Swerving QA","Near Collision QA","RF Cam Obstruction QA","Smoking QA",
  "Seatbelt Violation QA","Stop Sign Violation QA","Safe Distancing QA","Traffic Violation QA",
  "Unsafe Lane Change QA","Unsafe Parking QA"
];
const textColor = '#718096';
Chart.register(ChartDataLabels);

// ── Sync Toast ────────────────────────────────────────────────
function showToast(msg, type = "loading") {
  let el = document.getElementById("sync-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "sync-toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = type;
  el.style.display = "block";
  if (type !== "loading") setTimeout(() => { el.style.display = "none"; }, 3500);
}

// ── Firebase Init & Data Load ─────────────────────────────────
async function bootApp() {
  const ready = initFirebase(FIREBASE_CONFIG);
  const pill = document.getElementById("fb-status-pill");
  if (pill) {
    pill.textContent = ready ? "☁️ Cloud Sync ON" : "💾 Local Mode";
    pill.className = ready ? "online" : "offline";
  }

  showToast("⏳ Loading data...", "loading");
  try {
    const [perfRows, qaData, membersList, podsList] = await Promise.all([
      getAllPerf(), getAllQA(), getMembers(), getPods()
    ]);
    db = window._db_cache_perf = perfRows;
    parsedGlobalData = window._db_cache_qa = qaData;
    masterLinks = window._db_cache_members = membersList;
    pods = window._db_cache_pods = podsList.length ? podsList : ["General"];

    // Apply saved dashboard settings
    const dashSettings = await getSettings("dashboardConfig");
    if (dashSettings) applyDashboardSettings(dashSettings);

    // Load saved Slack config into localStorage (for compatibility)
    const slackConf = await getSettings("slackConfig");
    if (slackConf?.webhook)   localStorage.setItem("slack_webhook_url", slackConf.webhook);
    if (slackConf?.workspace) localStorage.setItem("slack_workspace_link", slackConf.workspace);

    showToast("✅ Data loaded!", "success");
  } catch(e) {
    console.error(e);
    showToast("⚠️ Loaded from local cache.", "error");
  }

  updatePodDropdowns();
  filterUsersByPod("userSelector");
  injectAdminPanel();
  setupAdminEntryPoints();
  initDashboard();
}

// ── Admin Entry Points ────────────────────────────────────────
function setupAdminEntryPoints() {
  // Watch Firebase auth state
  watchAuth(user => {
    currentAdminUser = user;
    const adminNavItem = document.getElementById("nav-admin");
    if (adminNavItem) {
      adminNavItem.style.display = user ? "block" : "none";
    }
    // Show/hide logout
    const logoutItem = document.getElementById("nav-logout");
    if (logoutItem) {
      logoutItem.textContent = user ? "🚪 Admin Logout" : "🚪 Account Logout";
    }
  });
}

// ── Auth Screen (Original preserved, upgraded with Firebase) ──
window.toggleAuthState = function() {
  isLoginMode = !isLoginMode;
  const alertBox    = document.getElementById("alert-box");
  const pageTitle   = document.getElementById("page-title");
  const pageSubtitle= document.getElementById("page-subtitle");
  const btnText     = document.getElementById("btn-text");
  if (!pageTitle) return;
  alertBox.className = "alert"; alertBox.style.display = "none";
  if (isLoginMode) {
    pageTitle.innerText = "Login to your account";
    pageSubtitle.innerHTML = `Don't have an account? <button class="toggle-btn" onclick="toggleAuthState()">Sign up</button>`;
    btnText.innerText = "LOG IN";
  } else {
    pageTitle.innerText = "Create an account";
    pageSubtitle.innerHTML = `Already have an account? <button class="toggle-btn" onclick="toggleAuthState()">Login</button>`;
    btnText.innerText = "Sign Up";
  }
};

function showAuthAlert(msg, type) {
  const el = document.getElementById("alert-box");
  if (!el) return;
  el.innerText = msg; el.className = `alert ${type}`; el.style.display = "block";
}

window.handleAuthSubmit = async function(e) {
  e.preventDefault();
  const email    = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  const domain   = "@gomotive.com";
  const localPw  = "#Motive@2026";

  if (!email.endsWith(domain)) { showAuthAlert(`Email must be a ${domain} address`, "error"); return; }

  if (isOnline()) {
    // Firebase auth — try admin login
    try {
      showAuthAlert("⏳ Authenticating...", "success");
      const cred = await loginAdmin(email, password);
      currentAdminUser = cred.user;
      showAuthAlert("✅ Logged in! Welcome back.", "success");
      setTimeout(() => checkAuthSessionState(), 800);
      return;
    } catch(err) {
      // Not an admin account — try local viewer auth
      if (password === localPw) {
        localStorage.setItem("motive_auth_token", "active");
        showAuthAlert("✅ Logged in as viewer!", "success");
        setTimeout(() => checkAuthSessionState(), 800);
        return;
      }
      showAuthAlert("Incorrect password or account not found.", "error");
      return;
    }
  }

  // Offline fallback — local auth
  const dbEmail = localStorage.getItem("motive_registered_email");
  if (!isLoginMode) {
    if (password !== localPw) { showAuthAlert("Incorrect password!", "error"); return; }
    if (dbEmail && dbEmail === email) { showAuthAlert("Email already registered. Login instead.", "error"); return; }
    localStorage.setItem("motive_registered_email", email);
    showAuthAlert("Account created! Switching to login...", "success");
    setTimeout(() => { toggleAuthState(); document.getElementById("password").value = ""; }, 1500);
  } else {
    if (password !== localPw) { showAuthAlert("Incorrect password!", "error"); return; }
    if (!dbEmail || dbEmail !== email) { showAuthAlert("Account not found. Sign up first.", "error"); return; }
    localStorage.setItem("motive_auth_token", "active");
    showAuthAlert("✅ Welcome back!", "success");
    setTimeout(() => checkAuthSessionState(), 900);
  }
};

function checkAuthSessionState() {
  const token    = localStorage.getItem("motive_auth_token");
  const isAdmin  = !!currentAdminUser;
  const authWrap = document.getElementById("auth-screen-wrapper");
  const mainApp  = document.getElementById("main-dashboard-app");
  const loggedIn = token === "active" || isAdmin;

  if (loggedIn) {
    if (authWrap) authWrap.style.display = "none";
    if (mainApp)  mainApp.style.display  = "flex";
    bootApp();
  } else {
    if (authWrap) authWrap.style.display = "flex";
    if (mainApp)  mainApp.style.display  = "none";
  }
}

window.executeSessionLogout = async function() {
  if (!confirm("Log out of Motive Analytics Pro?")) return;
  if (isOnline() && currentAdminUser) await logoutAdmin();
  localStorage.removeItem("motive_auth_token");
  currentAdminUser = null;
  location.reload();
};

// ── Admin Panel Open ──────────────────────────────────────────
window.openAdminSettings = function() {
  if (!currentAdminUser) {
    alert("Admin access required. Please log in with your Firebase admin account.");
    return;
  }
  openAdminPanel(currentAdminUser.email);
};

// ── Page Routing ──────────────────────────────────────────────
window.showPage = function(p) {
  document.querySelectorAll(".page").forEach(pg => pg.classList.add("hidden"));
  const pg = document.getElementById(p); if (pg) pg.classList.remove("hidden");
  document.querySelectorAll(".nav-links li").forEach(l => l.classList.remove("active"));
  const map = { "stats-view":"nav-stats","qa-data-view":"nav-qa-data","leaderboard-view":"nav-leaderboard","manage-members":"nav-manage","import-page":"nav-import" };
  const navEl = document.getElementById(map[p]); if (navEl) navEl.classList.add("active");
  if (p === "manage-members")  { updatePodDropdowns(); renderMemberTable(); }
  if (p === "stats-view")      initDashboard();
  if (p === "qa-data-view")    { updatePodDropdowns(); filterUsersByPod("qaPersonSelect"); }
  if (p === "leaderboard-view"){ updatePodDropdowns(); filterUsersByPod("resultTimeSelectorFrom"); }
};

// ── Pod Dropdowns ─────────────────────────────────────────────
window.updatePodDropdowns = function() {
  const opt = pods.map(p => `<option value="${p}">${p}</option>`).join("");
  ["podSelector","resultPodSelector","assignPod","qaPodSelector"].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = opt;
  });
  const mpf = document.getElementById("memberPodFilter");
  if (mpf) mpf.innerHTML = '<option value="all">🌐 All PODs</option>' + opt;
};

window.filterUsersByPod = function(id) {
  const isQA  = id === "qaPersonSelect" || id === "qaTimeFilterFrom";
  const isLdr = id === "resultTimeSelectorFrom";
  const podDD = isQA ? "qaPodSelector" : (isLdr ? "resultPodSelector" : "podSelector");
  const podEl = document.getElementById(podDD); if (!podEl) return;
  const pod   = podEl.value;
  const members = masterLinks.filter(l => l.pod === pod).map(l => l.name);
  const target  = document.getElementById(id); if (!target) return;

  if (id === "userSelector") {
    target.innerHTML = (members.length > 0 ? '<option value="all">🏆 All Team Members</option>' : "") + members.map(u => `<option value="${u}">${u}</option>`).join("");
    let src = db.filter(r => members.map(normalizeName).includes(normalizeName(r.Clean_Name)));
    if (!src.length) src = db;
    const times = [...new Set(src.map(r => r.Clean_Week))].filter(t => t && String(t).trim().toLowerCase() !== "range" && String(t).trim() !== "");
    times.sort((a,b) => parseWeekToDate(a) - parseWeekToDate(b));
    const optW = times.map(t => `<option value="${t}">${t}</option>`).join("");
    const f = document.getElementById("timeFilterFrom"), t2 = document.getElementById("timeFilterTo");
    if (f) f.innerHTML = optW;
    if (t2) t2.innerHTML = optW;
    initDashboard();
  } else if (id === "qaPersonSelect") {
    target.innerHTML = (members.length > 0 ? '<option value="all">🏆 All Team Members</option>' : "") + members.map(u => `<option value="${u}">${u}</option>`).join("");
    let weeks = new Set();
    members.forEach(n => {
      const k = Object.keys(parsedGlobalData).find(k2 => normalizeName(k2) === normalizeName(n));
      if (k && parsedGlobalData[k]?.weeksData) Object.keys(parsedGlobalData[k].weeksData).forEach(w => weeks.add(w));
    });
    if (!weeks.size && parsedGlobalData.all?.weeksData) Object.keys(parsedGlobalData.all.weeksData).forEach(w => weeks.add(w));
    const sw = [...weeks].sort((a,b) => parseWeekToDate(a) - parseWeekToDate(b));
    const optW = sw.map(w => `<option value="${w}">${w}</option>`).join("");
    const f = document.getElementById("qaTimeFilterFrom"), t2 = document.getElementById("qaTimeFilterTo");
    if (f) f.innerHTML = optW;
    if (t2) t2.innerHTML = optW;
  } else if (id === "resultTimeSelectorFrom") {
    updateResultTimeline();
  }
};

// ── Helpers ───────────────────────────────────────────────────
function normalizeName(s) {
  if (!s) return "";
  let str = String(s).toLowerCase().trim();
  if (str.includes("@")) str = str.split("@")[0];
  return str.replace(/[^a-z0-9]/g, "");
}

function parseWeekToDate(wStr) {
  const mm = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
  try {
    const p = String(wStr).toLowerCase().split("-")[0].trim().split(" ");
    return new Date(2026, mm[p[1]], parseInt(p[0]));
  } catch { return new Date(0); }
}

function getWeeksInRange(all, from, to) {
  if (from === "all" || to === "all" || !from || !to) return all;
  const sorted = [...all].sort((a,b) => parseWeekToDate(a) - parseWeekToDate(b));
  const si = sorted.indexOf(from), ei = sorted.indexOf(to);
  if (si === -1 || ei === -1 || si > ei) return [from];
  return sorted.slice(si, ei + 1);
}

function getTargetBarColor(v) { return v < 100 ? "#ef4444" : v === 100 ? "#3b82f6" : "#10b981"; }

function getDynamicQATarget(row) {
  if (!row) return 96.0;
  const lv = String(row.Level || "L1").trim().toUpperCase();
  const tn = parseFloat(String(row.Tenure || 0)) || 0;
  if (lv.includes("L1")) return tn < 1 ? 96 : tn <= 3 ? 96.5 : 97;
  if (lv.includes("L2")) return tn > 1 ? 97.5 : 97;
  return 96;
}

function getSmartColor(m, row) {
  const def = { dark:"#111122", hex:"#3b82f6" };
  if (!row) return def;
  const val = parseFloat(String(row[m] || 0).replace(/%/g, ""));
  if (isNaN(val)) return def;
  if (m.includes("QA Score")) {
    const t = getDynamicQATarget(row);
    return val > t ? { dark:"#064e3b",hex:"#10b981" } : val === t ? { dark:"#1e3a8a",hex:"#3b82f6" } : { dark:"#7f1d1d",hex:"#ef4444" };
  }
  if (m.toLowerCase().includes("punctuality")) {
    const chk = (val <= 1 && val > 0) ? val * 100 : val;
    return chk < 100 ? { dark:"#7f1d1d",hex:"#ef4444" } : chk === 100 ? { dark:"#1e3a8a",hex:"#3b82f6" } : { dark:"#064e3b",hex:"#10b981" };
  }
  if (m.toLowerCase().includes("loss productive")) return val <= 0 ? { dark:"#064e3b",hex:"#10b981" } : { dark:"#7f1d1d",hex:"#ef4444" };
  if (m.toLowerCase().includes("target ach")) return val < 100 ? { dark:"#7f1d1d",hex:"#ef4444" } : val === 100 ? { dark:"#1e3a8a",hex:"#3b82f6" } : { dark:"#064e3b",hex:"#10b981" };
  if (m.toLowerCase().includes("expected vs actual")) return val < 100 ? { dark:"#7f1d1d",hex:"#ef4444" } : val === 100 ? { dark:"#1e3a8a",hex:"#3b82f6" } : { dark:"#064e3b",hex:"#10b981" };
  return def;
}

const hoverLinePlugin = {
  id: "hoverLine",
  afterDatasetsDraw(chart) {
    if (chart.tooltip?._active?.length) {
      const ctx = chart.ctx, x = chart.tooltip._active[0].element.x;
      ctx.save(); ctx.beginPath(); ctx.moveTo(x, chart.scales.y.top); ctx.lineTo(x, chart.scales.y.bottom);
      ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.setLineDash([4,4]); ctx.stroke(); ctx.restore();
    }
  }
};

window.validateDashboardRange = function(side) {
  const f = document.getElementById("timeFilterFrom"), t = document.getElementById("timeFilterTo");
  if (!f || !t || !f.value || !t.value) return;
  const fd = parseWeekToDate(f.value), td = parseWeekToDate(t.value);
  if (side === "from" && fd > td) t.value = f.value;
  if (side === "to"   && fd > td) f.value = t.value;
};
window.validateQaRange = function(side) {
  const f = document.getElementById("qaTimeFilterFrom"), t = document.getElementById("qaTimeFilterTo");
  if (!f || !t) return;
  const fd = parseWeekToDate(f.value), td = parseWeekToDate(t.value);
  if (side === "from" && fd > td) t.value = f.value;
  if (side === "to"   && fd > td) f.value = t.value;
};
window.validateLeaderboardRange = function(side) {
  const f = document.getElementById("resultTimeSelectorFrom"), t = document.getElementById("resultTimeSelectorTo");
  if (!f || !t) return;
  const fd = parseWeekToDate(f.value), td = parseWeekToDate(t.value);
  if (side === "from" && fd > td) t.value = f.value;
  if (side === "to"   && fd > td) f.value = t.value;
};

// ── Dashboard ─────────────────────────────────────────────────
window.initDashboard = function() {
  const pod   = document.getElementById("podSelector")?.value;
  const user  = document.getElementById("userSelector")?.value;
  const fromW = document.getElementById("timeFilterFrom")?.value;
  const toW   = document.getElementById("timeFilterTo")?.value;
  if (!pod) return;

  const podMembers = masterLinks.filter(l => l.pod === pod).map(l => normalizeName(l.name));
  let src = db.filter(r => podMembers.includes(normalizeName(r.Clean_Name)));
  if (!src.length) src = db;
  const times = [...new Set(src.map(r => r.Clean_Week))].filter(t => t && String(t).trim().toLowerCase() !== "range" && String(t).trim() !== "");
  const weeks = getWeeksInRange(times, fromW, toW);

  let subset = user === "all"
    ? db.filter(r => podMembers.includes(normalizeName(r.Clean_Name)) && weeks.includes(r.Clean_Week))
    : db.filter(r => normalizeName(r.Clean_Name) === normalizeName(user) && weeks.includes(r.Clean_Week));

  renderVisuals(subset, user, weeks);
};

function renderVisuals(dataset, selectedUser, weeks) {
  if (barChartInstance)  { barChartInstance.destroy();  barChartInstance  = null; }
  if (lineChartInstance) { lineChartInstance.destroy(); lineChartInstance = null; }
  if (pieChartInstance)  { pieChartInstance.destroy();  pieChartInstance  = null; }

  const kpiIds = ["img-ach-val","img-exp-val","img-lost-val","img-punc-val"];
  const grid = document.getElementById("teamPerformanceDetailsGrid");

  if (!dataset.length) {
    kpiIds.forEach(id => { const el = document.getElementById(id); if(el) el.innerText = id.includes("lost") ? "0" : "0%"; });
    if (grid) grid.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-secondary);">No data for selected filters.</div>`;
    return;
  }

  let achSum=0, expSum=0, lostSum=0, puncSum=0;
  let exceed=0, meet=0, approach=0, improve=0;

  dataset.forEach(row => {
    const ach  = parseFloat(String(row["Target Ach %"] || 0).replace(/%/g,"")) || 0;
    const exp  = parseFloat(String(row["Expected vs Actual VA"] || 0).replace(/%/g,"")) || 0;
    const lost = parseFloat(String(row["Loss Productive Minutes"] || 0)) || 0;
    let punc   = parseFloat(String(row["Punctuality"] || 0).replace(/%/g,"")) || 0;
    if (punc <= 1 && punc > 0) punc *= 100;
    achSum += ach; expSum += exp; lostSum += lost; puncSum += punc;
    if (ach >= 110) exceed++; else if (ach >= 100) meet++; else if (ach >= 90) approach++; else improve++;
  });

  const n = dataset.length;
  const setKpi = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
  setKpi("img-ach-val",  (achSum/n).toFixed(1)  + "%");
  setKpi("img-exp-val",  (expSum/n).toFixed(1)  + "%");
  setKpi("img-lost-val", lostSum.toFixed(0));
  setKpi("img-punc-val", (puncSum/n).toFixed(0) + "%");

  const yAxis = { min:0, max:200, grid:{ color:"#16162b" }, ticks:{ color:textColor, callback: v => v+"%" } };
  const ctxBar  = document.getElementById("targetAchievementBarCanvas")?.getContext("2d");
  const ctxLine = document.getElementById("expectedVsActualLineCanvas")?.getContext("2d");
  if (!ctxBar || !ctxLine) return;

  if (selectedUser === "all") {
    const names = [...new Set(dataset.map(r => r.Clean_Name))];
    const achVals = names.map(nm => { const rows = dataset.filter(r=>r.Clean_Name===nm); return rows.reduce((s,r)=>s+(parseFloat(String(r["Target Ach %"]||0).replace(/%/g,""))||0),0)/rows.length; });
    const expVals = names.map(nm => { const rows = dataset.filter(r=>r.Clean_Name===nm); return rows.reduce((s,r)=>s+(parseFloat(String(r["Expected vs Actual VA"]||0).replace(/%/g,""))||0),0)/rows.length; });

    barChartInstance = new Chart(ctxBar, {
      type:"bar", data:{ labels:names, datasets:[{ data:achVals, backgroundColor:achVals.map(v=>getTargetBarColor(v)), borderRadius:4, barThickness:14 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:false, datalabels:false }, scales:{ x:{ grid:{display:false}, ticks:{color:textColor,rotation:45} }, y:yAxis } }
    });
    lineChartInstance = new Chart(ctxLine, {
      type:"line", data:{ labels:names, datasets:[{ label:"Exp vs Actual", data:expVals, borderColor:"#3b82f6", tension:.1, fill:false },{ label:"Target Ach", data:achVals, borderColor:"#10b981", tension:.1, fill:false }] },
      options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:"index",intersect:false}, plugins:{ legend:{display:true,position:"bottom",labels:{color:"#94a3b8"}}, datalabels:false }, scales:{ x:{grid:{display:false},ticks:{color:textColor,rotation:45}}, y:yAxis } }, plugins:[hoverLinePlugin]
    });
  } else {
    const achW = weeks.map(w => { const r=dataset.find(row=>row.Clean_Week===w); return r?(parseFloat(String(r["Target Ach %"]||0).replace(/%/g,""))||0):0; });
    const expW = weeks.map(w => { const r=dataset.find(row=>row.Clean_Week===w); return r?(parseFloat(String(r["Expected vs Actual VA"]||0).replace(/%/g,""))||0):0; });
    barChartInstance = new Chart(ctxBar, {
      type:"bar", data:{ labels:weeks, datasets:[{ data:achW, backgroundColor:achW.map(v=>getTargetBarColor(v)), borderRadius:4, barThickness:18 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:false, datalabels:false }, scales:{ x:{grid:{display:false},ticks:{color:textColor}}, y:yAxis } }
    });
    lineChartInstance = new Chart(ctxLine, {
      type:"line", data:{ labels:weeks, datasets:[{ label:"Exp vs Actual", data:expW, borderColor:"#3b82f6", tension:.1, pointRadius:4 },{ label:"Target Ach", data:achW, borderColor:"#10b981", tension:.1, pointRadius:4 }] },
      options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:"index",intersect:false}, plugins:{ legend:{display:true,position:"bottom",labels:{color:"#94a3b8"}}, datalabels:false }, scales:{ x:{grid:{display:false},ticks:{color:textColor}}, y:yAxis } }, plugins:[hoverLinePlugin]
    });
  }

  const ctxPie = document.getElementById("performancePieDistributionCanvas")?.getContext("2d");
  if (ctxPie) {
    pieChartInstance = new Chart(ctxPie, {
      type:"doughnut", data:{ labels:["Exceeding","Meeting","Approaching","Needs Improvement"], datasets:[{ data:[exceed,meet,approach,improve], backgroundColor:["#10b981","#3b82f6","#f59e0b","#ef4444"], borderWidth:0 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:false, datalabels:false }, cutout:"75%" }
    });
  }
  renderPerfTable(dataset);
}

function renderPerfTable(dataset) {
  const grid = document.getElementById("teamPerformanceDetailsGrid");
  if (!grid) return;
  const seen = {};
  let html = `<table class="premium-dark-table"><thead><tr>
    <th>Name</th><th>Week</th><th>Punctuality</th><th>Loss Min</th>
    <th>Target Ach %</th><th>Exp vs Actual</th><th>Crashes</th><th>QA Score</th><th>Overall</th>
  </tr></thead><tbody>`;

  dataset.forEach(row => {
    const key = `${row.Clean_Name}_${row.Clean_Week}`;
    if (seen[key]) return; seen[key] = true;
    const va  = parseFloat(String(row["Expected vs Actual VA"] || 0).replace(/%/g,"")) || 0;
    const ach = parseFloat(String(row["Target Ach %"] || 0).replace(/%/g,"")) || 0;
    const qa  = parseFloat(String(row["QA Score acc. New Method"] || 0).replace(/%/g,"")) || 0;
    let rawPunc = parseFloat(String(row["Punctuality"] || 0).replace(/%/g,""));
    if (rawPunc <= 1 && rawPunc > 0) rawPunc *= 100;
    const puncDisplay = isNaN(rawPunc) ? "0%" : rawPunc.toFixed(0) + "%";
    let qaDisplay = row["QA Score acc. New Method"] !== undefined ? String(row["QA Score acc. New Method"]) : "0%";
    if (!qaDisplay.includes("%")) { const p = parseFloat(qaDisplay); qaDisplay = isNaN(p) ? "0%" : p.toFixed(1) + "%"; }
    const overall = (((ach + va + qa) / 3).toFixed(1)) + "%";
    const pc = getSmartColor("Punctuality", row);
    const ac = getSmartColor("Target Ach %", row);
    const qc = getSmartColor("QA Score acc. New Method", row);
    html += `<tr>
      <td class="name-cell-bold">${row.Clean_Name || "-"}</td>
      <td style="color:var(--text-secondary);font-size:12.5px;">${row.Clean_Week || "-"}</td>
      <td style="color:${pc.hex};font-weight:600;">${puncDisplay}</td>
      <td>${row["Loss Productive Minutes"] || "0"}</td>
      <td style="color:${ac.hex};font-weight:700;">${ach.toFixed(0)}%</td>
      <td style="color:var(--primary);font-weight:600;">${va.toFixed(0)}%</td>
      <td>${row["Valid Crash Logouts (Only Crash)"] || "0"}</td>
      <td style="color:${qc.hex};font-weight:700;">${qaDisplay}</td>
      <td style="color:var(--warning);font-weight:800;">${overall}</td>
    </tr>`;
  });
  html += "</tbody></table>";
  grid.innerHTML = html;
}

// ── QA Dashboard ──────────────────────────────────────────────
window.triggerQaSearchRequest = function() {
  renderQaDashboard(document.getElementById("qaPersonSelect")?.value);
};

function renderQaDashboard(user) {
  let qKey = String(user || "").trim();
  if (qKey !== "all" && qKey) {
    const match = Object.keys(parsedGlobalData).find(k => normalizeName(k) === normalizeName(qKey));
    if (match) qKey = match;
  }
  const d = parsedGlobalData[qKey];
  const fromW = document.getElementById("qaTimeFilterFrom")?.value;
  const toW   = document.getElementById("qaTimeFilterTo")?.value;
  const curPod = document.getElementById("qaPodSelector")?.value;
  if (!d?.weeksData) { clearQaVisuals(); return; }

  const allWeeks  = Object.keys(d.weeksData);
  const targetW   = getWeeksInRange(allWeeks, fromW, toW);
  let totTags=0, vc=0, nvc=0, oth=0;
  const barCnt=Array(qaCats.length).fill(0), pie=[0,0,0,0], fPie=[0,0];

  targetW.forEach(wk => {
    const w = d.weeksData[wk]; if (!w) return;
    totTags += w.kpi[0]||0; vc += w.kpi[1]||0; nvc += w.kpi[2]||0; oth += w.kpi[3]||0;
    for (let i=0; i<qaCats.length; i++) barCnt[i] += w.bar[i]||0;
    for (let i=0; i<4; i++) pie[i] += w.pie[i]||0;
    for (let i=0; i<2; i++) fPie[i] += w.factorPie[i]||0;
  });

  const setEl = (id, v) => { const el = document.getElementById(id); if(el) el.innerText = v; };
  setEl("c-total", totTags); setEl("c-valid", vc); setEl("c-nonvalid", nvc); setEl("c-others", oth);

  const tp = pie.reduce((a,b)=>a+b,0)||1;
  setEl("p-agree",    Math.round(pie[0]/tp*100) + "%");
  setEl("p-disagree", Math.round(pie[1]/tp*100) + "%");
  setEl("p-noaccess", Math.round(pie[2]/tp*100) + "%");
  setEl("p-doubtful", Math.round(pie[3]/tp*100) + "%");
  const tf = fPie.reduce((a,b)=>a+b,0)||1;
  setEl("p-inattentive", Math.round(fPie[0]/tf*100) + "%");
  setEl("p-conceptual",  Math.round(fPie[1]/tf*100) + "%");

  if (qaBarChart)       qaBarChart.destroy();
  if (qaLineChart)      qaLineChart.destroy();
  if (qaPieChart)       qaPieChart.destroy();
  if (qaFactorPieChart) qaFactorPieChart.destroy();

  const barCtx  = document.getElementById("qaBarChart")?.getContext("2d");
  if (barCtx) qaBarChart = new Chart(barCtx, {
    type:"bar", data:{ labels:qaCats, datasets:[{ data:barCnt, backgroundColor:"#10b981", borderRadius:4 }] },
    options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true,grid:{color:"#16162b"},ticks:{color:textColor}}, x:{grid:{display:false},ticks:{color:textColor,autoSkip:false,maxRotation:90,minRotation:45}} }, plugins:{ legend:{display:false}, datalabels:false } }
  });

  let lineLabels = qKey === "all"
    ? Object.keys(parsedGlobalData).filter(k => { if(k==="all") return false; const l=masterLinks.find(m=>normalizeName(m.name)===normalizeName(k)); return l && l.pod === curPod; })
    : targetW;
  if (!lineLabels.length && qKey === "all") lineLabels = Object.keys(parsedGlobalData).filter(k=>k!=="all");

  let tkD=[], mtD=[], scD=[];
  if (qKey === "all") {
    lineLabels.forEach(uName => {
      const uo = parsedGlobalData[uName]; let tk=0, mt=0, sc=0;
      targetW.forEach(wk => { if(uo?.trend?.[wk]) { tk+=uo.trend[wk].tk||0; mt+=uo.trend[wk].mt||0; sc+=uo.trend[wk].sc||0; } });
      tkD.push(tk); mtD.push(mt); scD.push(sc);
    });
  } else {
    targetW.forEach(wk => {
      const wo = d.trend?.[wk] || {};
      tkD.push(wo.tk||0); mtD.push(wo.mt||0); scD.push(wo.sc||0);
    });
  }
  const lineLabelsClean = qKey === "all" ? lineLabels.map(k => masterLinks.find(l=>normalizeName(l.name)===normalizeName(k))?.name || k) : lineLabels;
  const lineCtx = document.getElementById("qaLineChart")?.getContext("2d");
  if (lineCtx) qaLineChart = new Chart(lineCtx, {
    type:"line", data:{ labels:lineLabelsClean, datasets:[
      { label:"Ticket", data:tkD, borderColor:"#3b82f6", tension:.3, pointRadius:4 },
      { label:"Make Ticket", data:mtD, borderColor:"#10b981", tension:.3, pointRadius:4 },
      { label:"Score Update", data:scD, borderColor:"#f59e0b", tension:.3, pointRadius:4 }
    ]},
    options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:"index",intersect:false}, scales:{ y:{beginAtZero:true,grid:{color:"#16162b"},ticks:{color:textColor}}, x:{grid:{display:false},ticks:{color:textColor}} }, plugins:{ legend:{labels:{color:textColor},position:"top"}, datalabels:false } }, plugins:[hoverLinePlugin]
  });

  const pieCtx = document.getElementById("qaPieChart")?.getContext("2d");
  if (pieCtx) qaPieChart = new Chart(pieCtx, {
    type:"doughnut", data:{ labels:["Agree","Disagree","No Access","Doubtful"], datasets:[{ data:pie, backgroundColor:["#10b981","#f43f5e","#3b82f6","#f59e0b"], borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:false, datalabels:false }, cutout:"75%" }
  });
  const fpCtx = document.getElementById("qaFactorPieChart")?.getContext("2d");
  if (fpCtx) qaFactorPieChart = new Chart(fpCtx, {
    type:"doughnut", data:{ labels:["Inattentiveness","Conceptual Issues"], datasets:[{ data:fPie, backgroundColor:["#3b82f6","#f59e0b"], borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:false, datalabels:false }, cutout:"75%" }
  });

  // QA Table
  const tbody = document.getElementById("qaTableBody");
  if (!tbody) return; tbody.innerHTML = "";
  const users2 = qKey === "all" ? lineLabels : [qKey];
  users2.forEach(uName => {
    if (!parsedGlobalData[uName]?.table) return;
    targetW.forEach(wk => {
      const r = parsedGlobalData[uName].table[wk]; if (!r) return;
      const dLink = masterLinks.find(l => normalizeName(l.name) === normalizeName(uName));
      tbody.innerHTML += `<tr>
        <td class="name-cell-bold">${dLink?.name || uName}</td>
        <td style="color:var(--text-secondary);">${wk}</td>
        <td style="color:var(--danger);font-weight:700;">${r.valid||0}</td>
        <td style="color:var(--warning);font-weight:700;">${r.nv||0}</td>
        <td>${r.ot||0}</td><td>${r.tk||0}</td><td>${r.mt||0}</td>
        <td style="color:#f59e0b;font-weight:700;">${r.sc||0}</td>
      </tr>`;
    });
  });
}

function clearQaVisuals() {
  ["c-total","c-valid","c-nonvalid","c-others"].forEach(id => { const el=document.getElementById(id); if(el) el.innerText="0"; });
  ["p-agree","p-disagree","p-noaccess","p-doubtful","p-inattentive","p-conceptual"].forEach(id => { const el=document.getElementById(id); if(el) el.innerText="0%"; });
  if(qaBarChart) qaBarChart.destroy();
  if(qaLineChart) qaLineChart.destroy();
  if(qaPieChart) qaPieChart.destroy();
  if(qaFactorPieChart) qaFactorPieChart.destroy();
  const tbody = document.getElementById("qaTableBody");
  if(tbody) tbody.innerHTML = `<tr><td colspan="8" style="padding:20px;text-align:center;color:var(--text-secondary);">No data found for selected filters.</td></tr>`;
}

// ── QA Processing ─────────────────────────────────────────────
function getQACat(cat) {
  if (!cat) return "Other QA";
  const lc = cat.toLowerCase();
  for (const c of qaCats) { if (lc.includes(c.toLowerCase())) return c; }
  return "Other QA";
}

function processQaSheet(rows, selectedPod) {
  const initEntry = () => ({ kpi:[0,0,0,0], bar:Array(qaCats.length).fill(0), pie:[0,0,0,0], factorPie:[0,0], trend:{}, table:{}, weeksData:{} });
  const out = { all: initEntry() };
  const membersSet = new Set(), uniqueWeeks = new Set();
  const newLinks = [];

  rows.forEach(row => {
    const keys = Object.keys(row);
    const wk   = String(row[keys.find(k=>k.toLowerCase().trim()==="week")] || "").trim();
    const email= String(row[keys.find(k=>k.toLowerCase().trim()==="email")] || "").trim().toLowerCase();
    const cat  = String(row[keys.find(k=>k.toLowerCase().trim().includes("category"))] || "").trim();
    const stat = String(row[keys.find(k=>k.toLowerCase().trim()==="status")] || "Agree").trim();
    const rev  = String(row[keys.find(k=>k.toLowerCase().trim().includes("review"))] || "").trim();
    const tick = String(row[keys.find(k=>k.toLowerCase().trim().includes("ticket link"))] || "").trim();
    const sc   = String(row[keys.find(k=>k.toLowerCase().trim().includes("ticket status"))] || "").trim().toLowerCase();
    const week = (wk && wk.toLowerCase() !== "range") ? wk : "Unknown Week";
    if (week !== "Unknown Week") uniqueWeeks.add(week);
    const name = email ? email.split("@")[0] : "unknown";
    membersSet.add(name);
    if (!out[name]) out[name] = initEntry();

    const catL = cat.toLowerCase();
    const isVC  = catL.includes("collision") && !catL.includes("near") && !catL.includes("invalid");
    const isNVC = catL.includes("near collision") || catL.includes("invalid collision");
    const mkTick = rev.toLowerCase().includes("make ticket") ? 1 : 0;
    const hasTick = tick ? 1 : 0;
    const hasSc   = (sc.includes("score") || sc.includes("update")) ? 1 : 0;
    const catIdx  = qaCats.indexOf(getQACat(cat));

    const mapTo = (entry) => {
      entry.kpi[0]++;
      if (isVC) entry.kpi[1]++; else if (isNVC) entry.kpi[2]++; else entry.kpi[3]++;
      if (catIdx !== -1) entry.bar[catIdx]++;
      if (stat.includes("Agree") && !stat.includes("Dis")) entry.pie[0]++;
      else if (stat.includes("Disagree")) entry.pie[1]++;
      else if (stat.includes("No Access")) entry.pie[2]++;
      else if (stat.includes("Doubtful")) entry.pie[3]++;
      if (rev.toLowerCase().trim() === "inattentiveness") entry.factorPie[0]++;
      else if (rev.toLowerCase().trim() === "conceptual issues") entry.factorPie[1]++;
      if (!entry.table[week]) entry.table[week] = { valid:0,nv:0,ot:0,tk:0,mt:0,sc:0 };
      if (isVC) entry.table[week].valid++; else if (isNVC) entry.table[week].nv++; else entry.table[week].ot++;
      entry.table[week].tk += hasTick; entry.table[week].mt += mkTick; entry.table[week].sc += hasSc;
      if (!entry.trend[week]) entry.trend[week] = { tk:0,mt:0,sc:0 };
      entry.trend[week].tk += hasTick; entry.trend[week].mt += mkTick; entry.trend[week].sc += hasSc;
      if (!entry.weeksData[week]) entry.weeksData[week] = { kpi:[0,0,0,0], bar:Array(qaCats.length).fill(0), pie:[0,0,0,0], factorPie:[0,0] };
      const wd = entry.weeksData[week];
      wd.kpi[0]++;
      if (isVC) wd.kpi[1]++; else if (isNVC) wd.kpi[2]++; else wd.kpi[3]++;
      if (catIdx !== -1) wd.bar[catIdx]++;
      if (stat.includes("Agree") && !stat.includes("Dis")) wd.pie[0]++;
      else if (stat.includes("Disagree")) wd.pie[1]++;
      else if (stat.includes("No Access")) wd.pie[2]++;
      else if (stat.includes("Doubtful")) wd.pie[3]++;
      if (rev.toLowerCase().trim() === "inattentiveness") wd.factorPie[0]++;
      else if (rev.toLowerCase().trim() === "conceptual issues") wd.factorPie[1]++;
    };
    mapTo(out.all);
    mapTo(out[name]);
    newLinks.push({ name, pod: selectedPod, level: "L1", accuracy: "96.0" });
  });

  parsedGlobalData = window._db_cache_qa = out;
  // Merge new links
  newLinks.forEach(nl => {
    const existing = masterLinks.find(m => normalizeName(m.name) === normalizeName(nl.name));
    if (!existing) masterLinks.push(nl);
  });
  return out;
}

// ── Leaderboard ───────────────────────────────────────────────
window.calculateResults = function() {
  const pod   = document.getElementById("resultPodSelector")?.value;
  const fromW = document.getElementById("resultTimeSelectorFrom")?.value;
  const toW   = document.getElementById("resultTimeSelectorTo")?.value;
  if (!pod || !fromW || !toW) { alert("Select POD and date range!"); return; }

  const members = masterLinks.filter(l => l.pod === pod).map(l => l.name);
  const mNorm   = members.map(normalizeName);
  const allWeeks= [...new Set(db.filter(r=>mNorm.includes(normalizeName(r.Clean_Name))).map(r=>r.Clean_Week))];
  const weeks   = getWeeksInRange(allWeeks, fromW, toW);
  const stats   = [];

  members.forEach(name => {
    const hist = db.filter(r => normalizeName(r.Clean_Name)===normalizeName(name) && weeks.includes(r.Clean_Week));
    if (!hist.length) return;
    let va=0,ach=0,qa=0,punc=0,lost=0;
    const factors = new Set();
    const allForUser = db.filter(r=>normalizeName(r.Clean_Name)===normalizeName(name));
    const baseIdx = allForUser.findIndex(r=>r===hist[0]);
    const prevRow = baseIdx > 0 ? allForUser[baseIdx-1] : null;
    hist.forEach(r => {
      const a = parseFloat(String(r["Target Ach %"]||0).replace(/%/g,""))||0;
      const v = parseFloat(String(r["Expected vs Actual VA"]||0).replace(/%/g,""))||0;
      const q = parseFloat(String(r["QA Score acc. New Method"]||0).replace(/%/g,""))||0;
      let p   = parseFloat(String(r["Punctuality"]||0).replace(/%/g,""))||0;
      if (p<=1&&p>0) p*=100;
      const l = parseFloat(String(r["Loss Productive Minutes"]||0))||0;
      ach+=a; va+=v; qa+=q; punc+=p; lost+=l;
      if (p<100) factors.add("Punctuality");
      if (l>0)   factors.add("Loss Productive Minutes");
      if (a<100) factors.add("Target Ach %");
      if (v<100) factors.add("Expected vs Actual VA");
      if (q<getDynamicQATarget(r)) factors.add("QA Accuracy");
    });
    const len = hist.length;
    const curQA = qa/len;
    const prevQA = prevRow ? (parseFloat(String(prevRow["QA Score acc. New Method"]||0).replace(/%/g,""))||0) : curQA;
    stats.push({ name, va:va/len, qa:curQA, champ:(ach+va+qa)/(3*len), diff:curQA-prevQA, factors:[...factors] });
  });

  if (!stats.length) { alert("No data for selection!"); return; }
  currentResultData = stats;

  const rc = document.getElementById("resultsContent"); if(rc) rc.style.display = "block";
  const ss = document.getElementById("slackSendSection"); if(ss) ss.style.display = "block";

  const mkLI = (p,val,i,unit) => {
    const icons = ["🥇","🥈","🥉"];
    return `<li class="${i===0?"winner-animate":""}"><span>${icons[i]} ${p.name}</span><strong>${val.toFixed(1)}${unit}</strong></li>`;
  };
  const tVA  = document.getElementById("topVA");       if(tVA)  tVA.innerHTML  = [...stats].sort((a,b)=>b.va-a.va).slice(0,3).map((p,i)=>mkLI(p,p.va,i,"%")).join("");
  const tOC  = document.getElementById("overallChampions"); if(tOC) tOC.innerHTML = [...stats].sort((a,b)=>b.champ-a.champ).slice(0,3).map((p,i)=>mkLI(p,p.champ,i,"% Avg")).join("");
  const tQA  = document.getElementById("topQA");       if(tQA)  tQA.innerHTML  = [...stats].sort((a,b)=>b.qa-a.qa).slice(0,3).map((p,i)=>mkLI(p,p.qa,i,"%")).join("");
  const miEl = document.getElementById("mostImproved");
  if (miEl) miEl.innerText = `Range: ${weeks.length} active week(s) — ${members.length} member(s)`;

  filterResultTable("below");
};

window.filterResultTable = function(mode) {
  document.querySelectorAll(".tab-filters .tab-btn").forEach(b => b.classList.remove("active"));
  if (event?.target?.tagName === "BUTTON") event.target.classList.add("active");
  const tbody = document.getElementById("underPerformersBody"); if (!tbody) return;
  tbody.innerHTML = "";
  const filtered = mode==="improved"
    ? currentResultData.filter(p=>p.diff>0)
    : mode==="declined"
    ? currentResultData.filter(p=>p.diff<0)
    : currentResultData.filter(p=>p.factors.length>0);
  if (!filtered.length) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:15px;color:var(--text-secondary);">No items match this filter.</td></tr>`; return; }
  filtered.forEach(p => {
    const status = mode==="below"
      ? p.factors.map(f=>`<span class="factor-tag">${f}</span>`).join("")
      : `<b style="color:${p.diff>0?"var(--success)":"var(--danger)"}">${p.diff>0?"+":""}${p.diff.toFixed(1)}% QA</b>`;
    tbody.innerHTML += `<tr><td class="name-cell-bold">${p.name}</td><td>${p.va.toFixed(1)}%</td><td>${p.qa.toFixed(1)}%</td><td>${status}</td></tr>`;
  });
};

window.updateResultTimeline = function() {
  const pod  = document.getElementById("resultPodSelector")?.value; if(!pod) return;
  const mems = masterLinks.filter(l=>l.pod===pod).map(l=>l.name);
  const weeks= [...new Set(db.filter(r=>mems.map(normalizeName).includes(normalizeName(r.Clean_Name))).map(r=>r.Clean_Week))].filter(t=>t&&String(t).trim().toLowerCase()!=="range");
  weeks.sort((a,b)=>parseWeekToDate(a)-parseWeekToDate(b));
  const optW = weeks.map(t=>`<option value="${t}">${t}</option>`).join("");
  const f = document.getElementById("resultTimeSelectorFrom"); if(f) f.innerHTML = optW;
  const t = document.getElementById("resultTimeSelectorTo");   if(t) t.innerHTML = optW;
};

// ── Member Management ─────────────────────────────────────────
window.renderMemberTable = function() {
  const search  = (document.getElementById("memberSearchInput")?.value || "").toLowerCase();
  const podFilt = document.getElementById("memberPodFilter")?.value;
  let filtered  = masterLinks.filter(m => m.name.toLowerCase().includes(search));
  if (podFilt && podFilt !== "all") filtered = filtered.filter(m => m.pod === podFilt);
  const tbody = document.getElementById("memberTableBody"); if(!tbody) return;
  tbody.innerHTML = filtered.map(m =>
    `<tr><td class="name-cell-bold">${m.name}</td><td>${m.level||"-"}</td><td>${m.accuracy||"96"}%</td><td>${m.pod}</td>
    <td><button class="danger-btn" style="margin:0;padding:4px 10px;width:auto;" onclick="deleteMember('${m.name}')">Del</button></td></tr>`
  ).join("");
};

window.deleteMember = async function(name) {
  if (!confirm(`Delete member: ${name}?`)) return;
  showToast("⏳ Deleting...", "loading");
  try {
    db = db.filter(r => r.Clean_Name !== name);
    masterLinks = masterLinks.filter(l => l.name !== name);
    window._db_cache_perf = db; window._db_cache_members = masterLinks;
    await deleteMemberFromDB(name);
    await bulkUpsertPerf(db);
    showToast("✅ Member deleted!", "success");
    renderMemberTable();
  } catch(e) { showToast("❌ Error: " + e.message, "error"); }
};

window.createNewPod = async function() {
  const input = document.getElementById("newPodName"); if(!input) return;
  const name = input.value.trim();
  if (!name) { alert("Enter a pod name!"); return; }
  if (pods.includes(name)) { alert("POD already exists!"); return; }
  pods.push(name); window._db_cache_pods = pods;
  await addPod(name);
  input.value = "";
  updatePodDropdowns();
  alert(`POD "${name}" created!`);
};

// ── Data Import ───────────────────────────────────────────────
window.handleMasterSheetSaving = async function() {
  const linkVal  = document.getElementById("masterSheetLinkInput")?.value.trim();
  const fileEl   = document.getElementById("fileInput");
  const pod      = document.getElementById("assignPod")?.value || "General";
  const sheetType= document.getElementById("sheetTypeSelect")?.value;
  if (!linkVal && (!fileEl || !fileEl.files.length)) { alert("Paste a link or choose a file!"); return; }

  if (fileEl && fileEl.files.length) {
    const file = fileEl.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type:"array" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:"" });
        showToast("⏳ Processing & syncing...", "loading");
        if (sheetType === "qa") {
          const parsed = processQaSheet(rows, pod);
          await saveAllQA(parsed);
          await bulkUpsertMembers(masterLinks);
          showToast("✅ QA sheet synced to cloud!", "success");
          updatePodDropdowns();
          filterUsersByPod("qaPersonSelect");
          setTimeout(() => showPage("qa-data-view"), 1500);
        } else {
          const newRows = [];
          rows.forEach(row => {
            const ck = {}; Object.keys(row).forEach(k => { ck[k.replace(/\s+/g," ").trim().toLowerCase()] = row[k]; });
            const name  = String(ck["name"] || ck["member name"] || "").trim();
            const week  = String(ck["week range"] || ck["timeline / week"] || ck["week"] || ck["range"] || "").trim();
            if (!name || !week || week.toLowerCase() === "range") return;
            const cr = { ...ck };
            cr.Clean_Name = name; cr.Clean_Week = week; cr.clean_pod = pod;
            cr.email    = String(ck["email"] || ck["work email"] || "").trim().toLowerCase();
            cr["Punctuality"]                   = ck["punctuality score"]  !== undefined ? ck["punctuality score"]  : "0%";
            cr["Loss Productive Minutes"]        = ck["lpm score"]          !== undefined ? ck["lpm score"]          : 0;
            cr["Target Ach %"]                  = ck["va score"]           !== undefined ? ck["va score"]           : "0%";
            cr["Expected vs Actual VA"]         = ck["time on tool score"] !== undefined ? ck["time on tool score"] : "0%";
            cr["Valid Crash Logouts (Only Crash)"]= ck["crash logout score"]!== undefined ? ck["crash logout score"] : 0;
            cr["QA Score acc. New Method"]      = ck["new qa score"]       !== undefined ? ck["new qa score"]       : "0%";
            cr["Tenure"] = ck["tenure"] !== undefined ? ck["tenure"] : 0;
            cr["Level"]  = ck["level"]  !== undefined ? ck["level"]  : "L1";
            newRows.push(cr);
            const li = masterLinks.findIndex(l => normalizeName(l.name) === normalizeName(name));
            if (li > -1) { masterLinks[li].pod = pod; masterLinks[li].level = cr["Level"]; }
            else masterLinks.push({ name, pod, level:cr["Level"], accuracy:"96.0" });
          });
          // Merge with existing
          newRows.forEach(nr => {
            const idx = db.findIndex(r => r.Clean_Name === nr.Clean_Name && r.Clean_Week === nr.Clean_Week);
            if (idx > -1) db[idx] = nr; else db.push(nr);
          });
          window._db_cache_perf = db; window._db_cache_members = masterLinks;
          await bulkUpsertPerf(db);
          await bulkUpsertMembers(masterLinks);
          showToast("✅ Performance sheet synced to cloud!", "success");
          updatePodDropdowns();
          filterUsersByPod("userSelector");
          setTimeout(() => showPage("stats-view"), 1500);
        }
      } catch(err) { console.error(err); showToast("❌ Error: " + err.message, "error"); }
    };
    reader.readAsArrayBuffer(file);
  }
};

window.syncAllMembers = function() { showToast("✅ Cloud sync is active — data auto-syncs on upload.", "success"); };

// ── Slack Integration (Original preserved) ────────────────────
let scheduledSlackTasks = [];

window.switchSlackTab = function(tab) {
  const wh = document.getElementById("webhookTab"), ws = document.getElementById("workspaceTab");
  const tabs = document.querySelectorAll(".slack-tab-btn");
  if (tab === "webhook") {
    wh.style.display="block"; ws.style.display="none";
    tabs[0].classList.add("active"); tabs[1].classList.remove("active");
    tabs[1].style.borderColor="var(--border-dim)"; tabs[1].style.color="var(--text-secondary)";
  } else {
    wh.style.display="none"; ws.style.display="block";
    tabs[0].classList.remove("active"); tabs[1].classList.add("active");
    tabs[0].style.borderColor="var(--border-dim)"; tabs[0].style.color="var(--text-secondary)";
  }
};

window.toggleWebhookVisibility = function() {
  const el = document.getElementById("slackWebhookUrl"); if(el) el.type = el.type==="password"?"text":"password";
};

function showSlackStatus(id, msg, type) {
  const el = document.getElementById(id); if(!el) return;
  el.textContent = msg; el.className = "status-" + type; el.style.display = "block";
  if (type !== "loading") setTimeout(() => el.style.display="none", 3500);
}

window.saveSlackWebhook = async function() {
  const url = document.getElementById("slackWebhookUrl")?.value.trim();
  if (!url) { showSlackStatus("webhookStatusBox","Enter a Webhook URL!","error"); return; }
  if (!url.includes("hooks.slack.com")) { showSlackStatus("webhookStatusBox","Invalid Slack Webhook URL!","error"); return; }
  localStorage.setItem("slack_webhook_url", url);
  await saveSettings("slackConfig", { webhook: url });
  showSlackStatus("webhookStatusBox","✅ Webhook saved!","success");
  const cb = document.getElementById("webhookConfiguredBox"); if(cb) cb.style.display="block";
  document.getElementById("slackWebhookUrl").value = "";
};

window.removeSlackWebhook = function() {
  if (!confirm("Remove webhook?")) return;
  localStorage.removeItem("slack_webhook_url");
  const cb = document.getElementById("webhookConfiguredBox"); if(cb) cb.style.display="none";
  showSlackStatus("webhookStatusBox","✅ Webhook removed!","success");
};

window.saveSlackWorkspaceLink = async function() {
  const link = document.getElementById("slackWorkspaceLink")?.value.trim();
  if (!link || !link.includes("slack.com")) { showSlackStatus("workspaceStatusBox","Invalid Slack link!","error"); return; }
  localStorage.setItem("slack_workspace_link", link);
  await saveSettings("slackConfig", { workspace: link });
  showSlackStatus("workspaceStatusBox","✅ Workspace link saved!","success");
  const cb = document.getElementById("workspaceConfiguredBox"); if(cb) cb.style.display="block";
};

window.removeSlackWorkspaceLink = function() {
  if(!confirm("Remove workspace link?")) return;
  localStorage.removeItem("slack_workspace_link");
  const el = document.getElementById("slackWorkspaceLink"); if(el) { el.value=""; el.readOnly=false; }
  const cb = document.getElementById("workspaceConfiguredBox"); if(cb) cb.style.display="none";
};

window.prepareSlackMessage = async function() {
  const webhookUrl  = localStorage.getItem("slack_webhook_url");
  const workspaceUrl= localStorage.getItem("slack_workspace_link");
  const sendOption  = document.querySelector('input[name="slackSendOption"]:checked')?.value;
  const timing      = document.getElementById("slackSendTiming")?.value;
  const statusEl    = document.getElementById("slackSendStatus");
  if (!webhookUrl && !workspaceUrl) { showSlackStatus("slackSendStatus","❌ No Slack config. Set up Webhook or Workspace link first.","error"); return; }
  if (!currentResultData.length)   { showSlackStatus("slackSendStatus","❌ No results! Click Check Rankings first.","error"); return; }
  showSlackStatus("slackSendStatus","📸 Preparing...","loading");
  try {
    const content = document.getElementById("resultsContent");
    const canvas  = await html2canvas(content, { backgroundColor:"#050508", scale:2, useCORS:true });
    const img     = canvas.toDataURL("image/png");
    const payload = buildSlackPayload(currentResultData, sendOption, img);
    if (webhookUrl) {
      if (timing === "now") await sendSlack(webhookUrl, payload, "slackSendStatus");
      else scheduleSlack(webhookUrl, payload, timing, "slackSendStatus");
    } else { window.open(workspaceUrl,"_blank"); showSlackStatus("slackSendStatus","✅ Slack workspace opened!","success"); }
  } catch(err) {
    const payload = buildSlackPayload(currentResultData, sendOption, null);
    if (webhookUrl) await sendSlack(webhookUrl, payload, "slackSendStatus");
    else showSlackStatus("slackSendStatus","⚠️ Screenshot failed — check console.","error");
  }
};

function buildSlackPayload(stats, option, img) {
  const top3 = (arr) => arr.slice(0,3);
  const byChamp = [...stats].sort((a,b)=>b.champ-a.champ);
  const byVA    = [...stats].sort((a,b)=>b.va-a.va);
  const byQA    = [...stats].sort((a,b)=>b.qa-a.qa);
  const low     = stats.filter(p=>p.factors.length>0);
  const icons   = ["🥇","🥈","🥉"];
  let txt = "🏆 *LEADERBOARD RESULTS* 🏆\n\n";
  if (option==="top"||option==="both") {
    txt += "✨ *TOP PERFORMERS*\n";
    top3(byChamp).forEach((p,i) => txt += `${icons[i]} *${p.name}* — ${p.champ.toFixed(1)}% Overall | VA: ${p.va.toFixed(1)}% | QA: ${p.qa.toFixed(1)}%\n`);
    txt += `\n_"Exceptional work — keep it up! 💪"_\n\n`;
    txt += "📊 *TOP VA*\n"; top3(byVA).forEach((p,i) => txt += `${icons[i]} ${p.name} — ${p.va.toFixed(1)}%\n`);
    txt += "\n📈 *TOP QA*\n"; top3(byQA).forEach((p,i) => txt += `${icons[i]} ${p.name} — ${p.qa.toFixed(1)}%\n`);
  }
  if (option==="low"||option==="both") {
    txt += "\n⚠️ *NEEDS ENCOURAGEMENT*\n";
    low.slice(0,3).forEach(p => { txt += `• *${p.name}* — QA: ${p.qa.toFixed(1)}%\n  Focus: ${p.factors.join(", ")}\n`; });
    txt += `\n_"We believe in you! 🚀"_`;
  }
  const blocks = [{ type:"section", text:{ type:"mrkdwn", text:txt } }];
  if (img) blocks.push({ type:"image", image_url:img, alt_text:"Leaderboard" });
  blocks.push({ type:"context", elements:[{ type:"mrkdwn", text:`📊 ${new Date().toLocaleString()} | Motive Analytics Pro` }] });
  return { blocks };
}

async function sendSlack(url, payload, statusId) {
  showSlackStatus(statusId,"📤 Sending...","loading");
  try {
    const res = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
    if (res.ok) showSlackStatus(statusId,"✅ Sent to Slack! 🎉","success");
    else showSlackStatus(statusId,"❌ Failed. Check webhook URL.","error");
  } catch { showSlackStatus(statusId,"❌ Network error.","error"); }
}

function scheduleSlack(url, payload, timing, statusId) {
  const delays = { "30min":30*60000, "1hour":60*60000 };
  let ms = delays[timing];
  if (timing === "custom") {
    const cv = document.getElementById("customSendTime")?.value;
    if (!cv) { showSlackStatus(statusId,"❌ Select a time!","error"); return; }
    ms = new Date(cv) - new Date();
    if (ms <= 0) { showSlackStatus(statusId,"❌ Time must be in future!","error"); return; }
  }
  setTimeout(() => sendSlack(url, payload, statusId), ms);
  showSlackStatus(statusId,`⏰ Scheduled! (${timing})`, "success");
}

function loadSlackConfig() {
  const wh = localStorage.getItem("slack_webhook_url");
  const ws = localStorage.getItem("slack_workspace_link");
  const whBox = document.getElementById("webhookConfiguredBox"); if(whBox && wh) whBox.style.display="block";
  if (ws) {
    const wsInput = document.getElementById("slackWorkspaceLink");
    const wsBox   = document.getElementById("workspaceConfiguredBox");
    if (wsInput) { wsInput.value=ws; wsInput.readOnly=true; }
    if (wsBox) wsBox.style.display="block";
  }
}

// ── DOM Ready ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Slack timing toggle
  const timingEl = document.getElementById("slackSendTiming");
  if (timingEl) timingEl.addEventListener("change", e => {
    const cb = document.getElementById("customTimeBox"); if(cb) cb.style.display = e.target.value==="custom"?"block":"none";
  });
  loadSlackConfig();
});

window.onload = () => {
  // Check if already logged in (Firebase restores session automatically)
  watchAuth(user => {
    currentAdminUser = user;
    const token = localStorage.getItem("motive_auth_token");
    if (user || token === "active") {
      const authWrap = document.getElementById("auth-screen-wrapper");
      const mainApp  = document.getElementById("main-dashboard-app");
      if (authWrap) authWrap.style.display = "none";
      if (mainApp)  mainApp.style.display  = "flex";
      bootApp();
    } else {
      const authWrap = document.getElementById("auth-screen-wrapper");
      const mainApp  = document.getElementById("main-dashboard-app");
      if (authWrap) authWrap.style.display = "flex";
      if (mainApp)  mainApp.style.display  = "none";
    }
  });
};
