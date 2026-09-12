/**
 * app.js
 * Inisialisasi aplikasi, dashboard, bottom navigation, helper UI global.
 */

/* ---------- Helper UI global ---------- */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function showToast(message, type) {
  let container = document.getElementById('som-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'som-toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'som-toast';
  if (type === 'error') toast.style.background = 'rgba(255,59,48,0.94)';
  if (type === 'success') toast.style.background = 'rgba(52,199,89,0.94)';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity .3s'; setTimeout(() => toast.remove(), 300); }, 2600);
}

function setBtnLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="som-spinner" style="border-color: rgba(255,255,255,0.3); border-top-color:#fff;"></span>';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.originalHtml || btn.innerHTML;
    btn.disabled = false;
  }
}

function skeletonRows(n) {
  return Array.from({ length: n }).map(() => `
    <div class="som-card p-3">
      <div class="som-skeleton h-4 w-2/3 mb-2"></div>
      <div class="som-skeleton h-3 w-1/3"></div>
    </div>
  `).join('');
}

function emptyState(title, subtitle) {
  return `
    <div class="flex flex-col items-center justify-center text-center py-10 px-4">
      <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style="background: var(--som-surface-2);">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h10" stroke="#8E8E93" stroke-width="1.6" stroke-linecap="round"/></svg>
      </div>
      <div class="font-medium">${escapeHtml(title)}</div>
      <div class="text-sm mt-1" style="color: var(--som-text-soft); max-width: 240px;">${escapeHtml(subtitle || '')}</div>
    </div>
  `;
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ---------- Bottom sheet ---------- */

function openBottomSheet(html) {
  closeBottomSheet();
  const backdrop = document.createElement('div');
  backdrop.className = 'som-sheet-backdrop';
  backdrop.id = 'som-sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'som-sheet p-5 som-safe-bottom';
  sheet.id = 'som-sheet';
  sheet.innerHTML = `<div class="som-sheet-handle"></div>${html}`;
  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
  backdrop.addEventListener('click', closeBottomSheet);
  requestAnimationFrame(() => { backdrop.classList.add('show'); sheet.classList.add('show'); });
}

function closeBottomSheet() {
  const backdrop = document.getElementById('som-sheet-backdrop');
  const sheet = document.getElementById('som-sheet');
  if (backdrop) { backdrop.classList.remove('show'); setTimeout(() => backdrop.remove(), 250); }
  if (sheet) { sheet.classList.remove('show'); setTimeout(() => sheet.remove(), 250); }
}

/* ---------- Dashboard / navigasi ---------- */

const MENUS = {
  so: { label: 'SO', icon: 'M4 7h16M4 12h16M4 17h10', render: () => window.SOM_SO.renderMenuSO() },
  verifikasi: { label: 'Verifikasi', icon: 'M5 13l4 4L19 7', render: () => window.SOM_VERIFIKASI.renderMenuVerifikasi() },
  report: { label: 'Report', icon: 'M4 19V5m6 14V9m6 10V13', render: () => window.SOM_REPORT.renderMenuReport() },
  admin: { label: 'Admin', icon: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-7 16a7 7 0 0 1 14 0', render: () => window.SOM_ADMIN.renderMenuAdmin() }
};

let currentMenu = 'so';

async function renderDashboard() {
  const session = await window.SOM_DB.loadSession();
  if (!session) { window.SOM_AUTH.renderLoginScreen(); return; }
  window.SOM_AUTH.scheduleAutoLogout(session.expiresAt);

  const isAdmin = session.role === 'admin';
  const tabs = ['so', 'verifikasi', 'report'].concat(isAdmin ? ['admin'] : []);

  const root = document.getElementById('app-root');
  root.innerHTML = `
    <div class="min-h-screen flex flex-col" style="background: var(--som-bg);">
      <div class="som-navbar som-safe-top px-4 py-3 flex items-center justify-between">
        <div>
          <div class="text-xs" style="color: var(--som-text-soft);">Halo,</div>
          <div class="font-semibold">${escapeHtml(session.nama)}</div>
        </div>
        <button id="btn-logout" class="w-9 h-9 rounded-full flex items-center justify-center" style="background: var(--som-surface-2);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m6 4 5 5-5 5M20 12H9" stroke="#1C1C1E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>

      <div id="view-content" class="flex-1 pb-24"></div>

      <div class="som-tabbar som-safe-bottom px-2 py-1.5">
        <div class="grid" style="grid-template-columns: repeat(${tabs.length}, 1fr);">
          ${tabs.map(key => `
            <button class="som-tab-item tab-btn" data-key="${key}">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="${MENUS[key].icon}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>${MENUS[key].label}</span>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-logout').addEventListener('click', () => confirmLogout());
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchMenu(btn.dataset.key));
  });

  switchMenu(tabs.includes(currentMenu) ? currentMenu : tabs[0]);
  primeMasterCache();
}

function confirmLogout() {
  openBottomSheet(`
    <h3 class="font-semibold text-lg mb-2">Keluar dari aplikasi?</h3>
    <div class="flex gap-2">
      <button id="btn-cancel-logout" class="som-btn som-btn-secondary flex-1">Batal</button>
      <button id="btn-yes-logout" class="som-btn som-btn-danger flex-1">Keluar</button>
    </div>
  `);
  document.getElementById('btn-cancel-logout').addEventListener('click', closeBottomSheet);
  document.getElementById('btn-yes-logout').addEventListener('click', () => { closeBottomSheet(); window.SOM_AUTH.doLogout(); });
}

function switchMenu(key) {
  currentMenu = key;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.key === key));
  MENUS[key].render();
}

async function primeMasterCache() {
  if (!navigator.onLine) return;
  const resp = await window.SOM_API.callApi('getMasterData', {});
  if (resp.success) await window.SOM_DB.cacheMasterData(resp.data);
}

/* ---------- Bootstrap ---------- */

async function bootstrap() {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('./sw.js'); } catch (e) { /* abaikan */ }
  }
  const session = await window.SOM_DB.loadSession();
  if (session && session.expiresAt > Date.now()) {
    window.SOM_AUTH.scheduleAutoLogout(session.expiresAt);
    await renderDashboard();
  } else {
    window.SOM_AUTH.renderLoginScreen();
  }
}

window.addEventListener('DOMContentLoaded', bootstrap);
window.renderDashboard = renderDashboard;
