// ============================================================
// 🛡️ ADMIN PANEL MODULE — MOTIVE ANALYTICS PRO
// ============================================================
import { getSettings, saveSettings, changePassword, clearAllPerf, clearAllQA, getAllPerf, getAllQA, getMembers, getPods } from "./db.js";

let _adminPanelInjected = false;

// ── Inject Admin Panel HTML ───────────────────────────────────
export function injectAdminPanel() {
  if (_adminPanelInjected) return;
  _adminPanelInjected = true;

  const html = `
  <div id="admin-panel-overlay" style="display:none;position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.88);backdrop-filter:blur(6px);overflow-y:auto;padding:20px 0;">
    <div style="max-width:660px;margin:0 auto;background:#0a0a14;border:1px solid #16162b;border-radius:20px;padding:32px;position:relative;">

      <!-- Close -->
      <button onclick="closeAdminPanel()" style="position:absolute;top:16px;right:16px;background:#111122;border:1px solid #16162b;color:#94a3b8;width:34px;height:34px;border-radius:8px;cursor:pointer;font-size:16px;line-height:1;">✕</button>

      <!-- Header -->
      <div style="margin-bottom:24px;">
        <div style="font-size:10px;font-weight:800;color:#3b82f6;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">🛡️ Admin Control Panel</div>
        <h2 style="margin:0;font-size:20px;font-weight:800;">Dashboard Settings</h2>
        <p id="ap-admin-email" style="margin:4px 0 0 0;font-size:12px;color:#94a3b8;"></p>
      </div>

      <!-- Tabs -->
      <div style="display:flex;gap:4px;background:#07070d;padding:4px;border-radius:10px;border:1px solid #16162b;margin-bottom:22px;flex-wrap:wrap;">
        <button class="ap-tab active" data-tab="branding" onclick="apSwitchTab('branding')">🎨 Branding</button>
        <button class="ap-tab" data-tab="security" onclick="apSwitchTab('security')">🔐 Security</button>
        <button class="ap-tab" data-tab="data" onclick="apSwitchTab('data')">🗄️ Data</button>
        <button class="ap-tab" data-tab="slack" onclick="apSwitchTab('slack')">📱 Slack</button>
      </div>

      <!-- BRANDING TAB -->
      <div id="ap-tab-branding" class="ap-tab-panel">
        <div class="ap-field">
          <label>Logo URL <span style="color:#64748b;font-weight:400;">(optional image link)</span></label>
          <div style="display:flex;gap:8px;">
            <input type="text" id="ap-logo-url" placeholder="https://example.com/logo.png">
            <button onclick="apPreviewLogo()" class="ap-btn-sm">Preview</button>
          </div>
          <div id="ap-logo-preview" style="display:none;margin-top:10px;text-align:center;">
            <img id="ap-logo-img" style="max-height:64px;border-radius:8px;border:1px solid #16162b;padding:8px;background:#07070d;">
          </div>
        </div>
        <div class="ap-field">
          <label>Dashboard Title</label>
          <input type="text" id="ap-title" placeholder="MOTIVE ANALYTICS">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div class="ap-field">
            <label>Primary Color</label>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="color" id="ap-color-primary" value="#3b82f6" style="width:40px;height:36px;border-radius:6px;padding:2px;cursor:pointer;min-width:unset;border:1px solid #16162b;background:#111122;">
              <input type="text" id="ap-color-primary-hex" placeholder="#3b82f6">
            </div>
          </div>
          <div class="ap-field">
            <label>Accent Color</label>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="color" id="ap-color-accent" value="#10b981" style="width:40px;height:36px;border-radius:6px;padding:2px;cursor:pointer;min-width:unset;border:1px solid #16162b;background:#111122;">
              <input type="text" id="ap-color-accent-hex" placeholder="#10b981">
            </div>
          </div>
        </div>
        <button onclick="apSaveBranding()" class="ap-btn-primary">💾 Save Branding</button>
        <div id="ap-status-branding" class="ap-status"></div>
      </div>

      <!-- SECURITY TAB -->
      <div id="ap-tab-security" class="ap-tab-panel" style="display:none;">
        <div style="background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.18);border-radius:10px;padding:14px;margin-bottom:20px;font-size:13px;color:#94a3b8;">
          ℹ️ Passwords are secured via Firebase Authentication — never stored in plain text.
        </div>
        <div class="ap-field"><label>Current Password</label><input type="password" id="ap-pw-current" placeholder="••••••••"></div>
        <div class="ap-field"><label>New Password <span style="color:#64748b;font-weight:400;">(min 8 chars)</span></label><input type="password" id="ap-pw-new" placeholder="••••••••"></div>
        <div class="ap-field"><label>Confirm New Password</label><input type="password" id="ap-pw-confirm" placeholder="••••••••"></div>
        <button onclick="apChangePassword()" class="ap-btn-primary">🔐 Update Password</button>
        <div id="ap-status-security" class="ap-status"></div>
      </div>

      <!-- DATA TAB -->
      <div id="ap-tab-data" class="ap-tab-panel" style="display:none;">
        <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.18);border-radius:10px;padding:14px;margin-bottom:20px;font-size:13px;color:#94a3b8;">
          ⚠️ Data operations are permanent. Export a backup before clearing.
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button onclick="apExportData()" class="ap-btn-secondary" style="width:100%;">📤 Export All Data (JSON Backup)</button>
          <button onclick="apClearPerf()" class="ap-btn-danger" style="width:100%;">🗑️ Clear Performance Data</button>
          <button onclick="apClearQA()" class="ap-btn-danger" style="width:100%;">🗑️ Clear QA Data</button>
          <button onclick="apClearAll()" style="width:100%;background:rgba(239,68,68,0.18);border:1px solid rgba(239,68,68,0.35);color:#ef4444;padding:12px;border-radius:8px;font-weight:800;cursor:pointer;font-size:13px;">⚠️ CLEAR ALL DATA & RESET</button>
        </div>
        <div id="ap-status-data" class="ap-status"></div>
      </div>

      <!-- SLACK TAB -->
      <div id="ap-tab-slack" class="ap-tab-panel" style="display:none;">
        <div class="ap-field">
          <label>Slack Webhook URL <span style="color:#64748b;font-weight:400;">(auto-send)</span></label>
          <div style="display:flex;gap:8px;">
            <input type="password" id="ap-slack-webhook" placeholder="https://hooks.slack.com/services/...">
            <button onclick="document.getElementById('ap-slack-webhook').type=document.getElementById('ap-slack-webhook').type==='password'?'text':'password'" class="ap-btn-sm">👁</button>
          </div>
        </div>
        <div class="ap-field">
          <label>Slack Workspace Link <span style="color:#64748b;font-weight:400;">(manual notify)</span></label>
          <input type="text" id="ap-slack-workspace" placeholder="https://app.slack.com/client/...">
        </div>
        <button onclick="apSaveSlack()" class="ap-btn-primary">💾 Save Slack Settings</button>
        <div id="ap-status-slack" class="ap-status"></div>
      </div>

    </div>
  </div>`;

  document.body.insertAdjacentHTML("beforeend", html);
  _setupColorPickers();
  _loadAdminValues();
}

// ── Tab Switching ─────────────────────────────────────────────
window.apSwitchTab = function(tab) {
  document.querySelectorAll(".ap-tab-panel").forEach(el => el.style.display = "none");
  document.querySelectorAll(".ap-tab").forEach(btn => btn.classList.remove("active"));
  const panel = document.getElementById(`ap-tab-${tab}`);
  if (panel) panel.style.display = "block";
  document.querySelectorAll(`.ap-tab[data-tab="${tab}"]`).forEach(b => b.classList.add("active"));
};

window.closeAdminPanel = function() {
  const el = document.getElementById("admin-panel-overlay");
  if (el) el.style.display = "none";
};

export function openAdminPanel(adminEmail) {
  if (!_adminPanelInjected) injectAdminPanel();
  const overlay = document.getElementById("admin-panel-overlay");
  if (overlay) overlay.style.display = "block";
  const emailEl = document.getElementById("ap-admin-email");
  if (emailEl && adminEmail) emailEl.textContent = "Logged in as: " + adminEmail;
}

// ── Color Picker Sync ─────────────────────────────────────────
function _setupColorPickers() {
  [["ap-color-primary","ap-color-primary-hex"],["ap-color-accent","ap-color-accent-hex"]].forEach(([cId, hId]) => {
    const c = document.getElementById(cId), h = document.getElementById(hId);
    if (!c || !h) return;
    c.addEventListener("input", () => h.value = c.value);
    h.addEventListener("input", () => { if (/^#[0-9a-fA-F]{6}$/.test(h.value)) c.value = h.value; });
  });
}

// ── Load Saved Values ─────────────────────────────────────────
async function _loadAdminValues() {
  const s = await getSettings("dashboardConfig");
  if (s) {
    if (s.logoUrl)      { const el = document.getElementById("ap-logo-url"); if(el) el.value = s.logoUrl; }
    if (s.title)        { const el = document.getElementById("ap-title"); if(el) el.value = s.title; }
    if (s.primaryColor) {
      const c = document.getElementById("ap-color-primary"); if(c) c.value = s.primaryColor;
      const h = document.getElementById("ap-color-primary-hex"); if(h) h.value = s.primaryColor;
    }
    if (s.accentColor) {
      const c = document.getElementById("ap-color-accent"); if(c) c.value = s.accentColor;
      const h = document.getElementById("ap-color-accent-hex"); if(h) h.value = s.accentColor;
    }
  }
  const slack = await getSettings("slackConfig");
  if (slack) {
    if (slack.webhook)   { const el = document.getElementById("ap-slack-webhook"); if(el) el.value = slack.webhook; }
    if (slack.workspace) { const el = document.getElementById("ap-slack-workspace"); if(el) el.value = slack.workspace; }
  }
}

// ── Apply Settings to UI ──────────────────────────────────────
export function applyDashboardSettings(s) {
  if (!s) return;
  if (s.primaryColor) document.documentElement.style.setProperty("--primary", s.primaryColor);
  if (s.accentColor)  document.documentElement.style.setProperty("--success", s.accentColor);
  if (s.logoUrl) {
    document.querySelectorAll(".logo-img").forEach(img => { img.src = s.logoUrl; img.style.display = "inline-block"; });
    document.querySelectorAll(".logo-text").forEach(el => el.style.display = "none");
  }
  if (s.title) {
    const logoEl = document.querySelector(".logo");
    if (logoEl && !s.logoUrl) logoEl.innerHTML = s.title.replace("ANALYTICS", '<span>ANALYTICS</span>');
  }
}

// ── Preview Logo ──────────────────────────────────────────────
window.apPreviewLogo = function() {
  const url = (document.getElementById("ap-logo-url")?.value || "").trim();
  if (!url) return;
  const box = document.getElementById("ap-logo-preview");
  const img = document.getElementById("ap-logo-img");
  if (box) box.style.display = "block";
  if (img) img.src = url;
};

// ── Save Branding ─────────────────────────────────────────────
window.apSaveBranding = async function() {
  const statusEl = document.getElementById("ap-status-branding");
  try {
    const s = {
      logoUrl:      (document.getElementById("ap-logo-url")?.value || "").trim(),
      title:        (document.getElementById("ap-title")?.value || "").trim(),
      primaryColor: (document.getElementById("ap-color-primary-hex")?.value || "#3b82f6").trim(),
      accentColor:  (document.getElementById("ap-color-accent-hex")?.value || "#10b981").trim(),
    };
    await saveSettings("dashboardConfig", s);
    applyDashboardSettings(s);
    _showStatus(statusEl, "✅ Branding saved & applied!", "success");
  } catch(e) { _showStatus(statusEl, "❌ " + e.message, "error"); }
};

// ── Change Password ───────────────────────────────────────────
window.apChangePassword = async function() {
  const statusEl = document.getElementById("ap-status-security");
  const cur  = document.getElementById("ap-pw-current")?.value;
  const nw   = document.getElementById("ap-pw-new")?.value;
  const conf = document.getElementById("ap-pw-confirm")?.value;
  if (!cur || !nw) return _showStatus(statusEl, "All fields are required.", "error");
  if (nw !== conf)  return _showStatus(statusEl, "New passwords do not match.", "error");
  if (nw.length < 8) return _showStatus(statusEl, "Password must be at least 8 characters.", "error");
  try {
    await changePassword(cur, nw);
    _showStatus(statusEl, "✅ Password updated successfully!", "success");
    ["ap-pw-current","ap-pw-new","ap-pw-confirm"].forEach(id => { const el = document.getElementById(id); if(el) el.value = ""; });
  } catch(e) { _showStatus(statusEl, "❌ " + (e.message || "Wrong current password?"), "error"); }
};

// ── Data Management ───────────────────────────────────────────
window.apExportData = async function() {
  try {
    const [perf, qa, members, pods] = await Promise.all([getAllPerf(), getAllQA(), getMembers(), getPods()]);
    const blob = new Blob([JSON.stringify({ performanceData: perf, qaData: qa, members, pods, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `motive-backup-${Date.now()}.json`; a.click();
    _showStatus(document.getElementById("ap-status-data"), "✅ Backup downloaded!", "success");
  } catch(e) { _showStatus(document.getElementById("ap-status-data"), "❌ " + e.message, "error"); }
};

window.apClearPerf = async function() {
  if (!confirm("Clear ALL performance data? This is permanent.")) return;
  await clearAllPerf();
  window._db_cache_perf = [];
  _showStatus(document.getElementById("ap-status-data"), "✅ Performance data cleared.", "success");
};

window.apClearQA = async function() {
  if (!confirm("Clear ALL QA data?")) return;
  await clearAllQA();
  window._db_cache_qa = {};
  _showStatus(document.getElementById("ap-status-data"), "✅ QA data cleared.", "success");
};

window.apClearAll = async function() {
  if (!confirm("⚠️ CLEAR ALL DATA — members, pods, performance, QA. Are you sure?")) return;
  if (!confirm("Final confirmation. This is irreversible.")) return;
  await clearAllPerf();
  await clearAllQA();
  ["motive_pro_db","motive_qa_parsed_db","motive_master_links","motive_pods"].forEach(k => localStorage.removeItem(k));
  window._db_cache_perf = [];
  window._db_cache_qa = {};
  window._db_cache_members = [];
  _showStatus(document.getElementById("ap-status-data"), "✅ All data cleared. Refresh the page.", "success");
};

// ── Save Slack ────────────────────────────────────────────────
window.apSaveSlack = async function() {
  const statusEl = document.getElementById("ap-status-slack");
  try {
    const webhook   = (document.getElementById("ap-slack-webhook")?.value   || "").trim();
    const workspace = (document.getElementById("ap-slack-workspace")?.value || "").trim();
    await saveSettings("slackConfig", { webhook, workspace });
    if (webhook)   localStorage.setItem("slack_webhook_url", webhook);
    if (workspace) localStorage.setItem("slack_workspace_link", workspace);
    _showStatus(statusEl, "✅ Slack settings saved!", "success");
  } catch(e) { _showStatus(statusEl, "❌ " + e.message, "error"); }
};

// ── Status Helper ─────────────────────────────────────────────
function _showStatus(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className = "ap-status " + type;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 4500);
}
