/**
 * admin.js
 * Menu admin: tambah user/reset password, approval, logs, toggle qty system.
 */

async function renderMenuAdmin() {
  const view = document.getElementById('view-content');
  view.innerHTML = `
    <div class="p-4 space-y-3 som-fade-in">
      <div class="som-card p-2 flex gap-1 overflow-x-auto">
        <button class="admin-tab flex-1 text-sm font-medium py-2.5 rounded-xl" data-key="users">Pengguna</button>
        <button class="admin-tab flex-1 text-sm font-medium py-2.5 rounded-xl" data-key="approval">Approval</button>
        <button class="admin-tab flex-1 text-sm font-medium py-2.5 rounded-xl" data-key="logs">Logs</button>
        <button class="admin-tab flex-1 text-sm font-medium py-2.5 rounded-xl" data-key="settings">Pengaturan</button>
      </div>
      <div id="admin-content"></div>
    </div>
  `;
  let activeTab = 'users';
  const tabs = document.querySelectorAll('.admin-tab');
  function paint() {
    tabs.forEach(t => {
      const on = t.dataset.key === activeTab;
      t.style.background = on ? 'var(--som-accent)' : 'transparent';
      t.style.color = on ? '#fff' : 'var(--som-text-soft)';
    });
  }
  tabs.forEach(t => t.addEventListener('click', () => { activeTab = t.dataset.key; paint(); loadAdminTab(activeTab); }));
  paint();
  await loadAdminTab(activeTab);
}

async function loadAdminTab(tab) {
  const content = document.getElementById('admin-content');
  content.innerHTML = skeletonRows(3);
  if (tab === 'users') return renderAdminUsers();
  if (tab === 'approval') return renderAdminApproval();
  if (tab === 'logs') return renderAdminLogs();
  if (tab === 'settings') return renderAdminSettings();
}

/* ---------- USERS ---------- */
async function renderAdminUsers() {
  const content = document.getElementById('admin-content');
  const resp = await window.SOM_API.callApi('adminGetUsers', {});
  const users = resp.success ? resp.data : [];

  content.innerHTML = `
    <button id="btn-add-user" class="som-btn som-btn-primary w-full mb-3">+ Tambah pengguna</button>
    <div class="space-y-2">
      ${users.map(u => `
        <div class="som-card p-3 flex items-center justify-between">
          <div>
            <div class="font-medium">${escapeHtml(u.nama_staff)} <span class="text-xs" style="color:var(--som-text-soft);">(${escapeHtml(u.username)})</span></div>
            <div class="text-xs" style="color: var(--som-text-soft);">${escapeHtml(u.role)} · ${u.status === 'active' ? '<span style=\"color:#1F9D45\">aktif</span>' : '<span style=\"color:#D6362A\">diblokir</span>'}</div>
          </div>
          <div class="flex gap-1">
            <button class="som-btn som-btn-secondary text-xs px-2 py-1.5 btn-reset-pw" data-u="${escapeHtml(u.username)}">Reset PW</button>
            <button class="som-btn ${u.status === 'active' ? 'som-btn-danger' : 'som-btn-success'} text-xs px-2 py-1.5 btn-toggle-status" data-u="${escapeHtml(u.username)}" data-status="${u.status}">${u.status === 'active' ? 'Blokir' : 'Aktifkan'}</button>
          </div>
        </div>
      `).join('') || emptyState('Belum ada pengguna', '')}
    </div>
  `;

  document.getElementById('btn-add-user').addEventListener('click', openAddUserSheet);
  content.querySelectorAll('.btn-reset-pw').forEach(b => b.addEventListener('click', () => resetPasswordFlow(b.dataset.u)));
  content.querySelectorAll('.btn-toggle-status').forEach(b => b.addEventListener('click', () => toggleUserStatus(b.dataset.u, b.dataset.status)));
}

function openAddUserSheet() {
  openBottomSheet(`
    <h3 class="font-semibold text-lg mb-3">Tambah pengguna</h3>
    <input id="nu-username" class="som-input mb-2" placeholder="Username" />
    <input id="nu-nama" class="som-input mb-2" placeholder="Nama staff" />
    <input id="nu-password" class="som-input mb-2" placeholder="Password awal (min 6 karakter)" />
    <select id="nu-role" class="som-input mb-3">
      <option value="staff">Staff</option>
      <option value="admin">Admin</option>
    </select>
    <button id="btn-save-user" class="som-btn som-btn-primary w-full">Simpan pengguna</button>
  `);
  document.getElementById('btn-save-user').addEventListener('click', async () => {
    const payload = {
      username: document.getElementById('nu-username').value.trim(),
      nama_staff: document.getElementById('nu-nama').value.trim(),
      password: document.getElementById('nu-password').value,
      role: document.getElementById('nu-role').value
    };
    if (!payload.username || !payload.nama_staff || payload.password.length < 6) {
      showToast('Lengkapi form (password min 6 karakter)', 'error'); return;
    }
    const resp = await window.SOM_API.callApi('adminAddUser', payload);
    if (resp.success) { showToast('Pengguna ditambahkan'); closeBottomSheet(); renderAdminUsers(); }
    else showToast(resp.message, 'error');
  });
}

function resetPasswordFlow(username) {
  openBottomSheet(`
    <h3 class="font-semibold text-lg mb-3">Reset password: ${escapeHtml(username)}</h3>
    <input id="rp-password" class="som-input mb-3" placeholder="Password baru (min 6 karakter)" />
    <button id="btn-do-reset" class="som-btn som-btn-primary w-full">Reset password</button>
  `);
  document.getElementById('btn-do-reset').addEventListener('click', async () => {
    const pw = document.getElementById('rp-password').value;
    if (pw.length < 6) { showToast('Minimal 6 karakter', 'error'); return; }
    const resp = await window.SOM_API.callApi('adminResetPassword', { username, new_password: pw });
    if (resp.success) { showToast('Password direset'); closeBottomSheet(); }
    else showToast(resp.message, 'error');
  });
}

async function toggleUserStatus(username, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
  const resp = await window.SOM_API.callApi('adminSetUserStatus', { username, status: newStatus });
  if (resp.success) { showToast('Status diperbarui'); renderAdminUsers(); }
  else showToast(resp.message, 'error');
}

/* ---------- APPROVAL ---------- */
async function renderAdminApproval() {
  const content = document.getElementById('admin-content');
  const resp = await window.SOM_API.callApi('adminGetApprovals', {});
  if (!resp.success) { content.innerHTML = emptyState('Gagal memuat', resp.message); return; }
  const { pending_lokasi, pending_reset_password } = resp.data;

  content.innerHTML = `
    <div class="mb-4">
      <h3 class="font-semibold mb-2">Hapus lokasi menunggu approval</h3>
      <div class="space-y-2">
        ${pending_lokasi.map(l => `
          <div class="som-card p-3 flex items-center justify-between">
            <div>
              <div class="font-medium">${escapeHtml(l.nama_lokasi)}</div>
              <div class="text-xs" style="color: var(--som-text-soft);">diminta ${new Date(l.delete_requested_at).toLocaleString('id-ID')}</div>
            </div>
            <div class="flex gap-1">
              <button class="som-btn som-btn-danger text-xs px-2 py-1.5 btn-approve-lokasi" data-id="${l.id_lokasi}" data-approve="1">Setujui</button>
              <button class="som-btn som-btn-secondary text-xs px-2 py-1.5 btn-approve-lokasi" data-id="${l.id_lokasi}" data-approve="0">Tolak</button>
            </div>
          </div>
        `).join('') || emptyState('Tidak ada permintaan', '')}
      </div>
    </div>
    <div>
      <h3 class="font-semibold mb-2">Permintaan reset password</h3>
      <div class="space-y-2">
        ${pending_reset_password.map(r => `
          <div class="som-card p-3">
            <div class="font-medium">${escapeHtml(r.username)}</div>
            <div class="text-xs" style="color: var(--som-text-soft);">${new Date(r.timestamp).toLocaleString('id-ID')}</div>
          </div>
        `).join('') || emptyState('Tidak ada permintaan', '')}
      </div>
    </div>
  `;

  content.querySelectorAll('.btn-approve-lokasi').forEach(b => {
    b.addEventListener('click', async () => {
      const resp2 = await window.SOM_API.callApi('adminApproveLokasi', { id_lokasi: b.dataset.id, approve: b.dataset.approve === '1' });
      if (resp2.success) { showToast('Diperbarui'); renderAdminApproval(); }
      else showToast(resp2.message, 'error');
    });
  });
}

/* ---------- LOGS ---------- */
async function renderAdminLogs() {
  const content = document.getElementById('admin-content');
  const resp = await window.SOM_API.callApi('adminGetLogs', { limit: 100 });
  const rows = resp.success ? resp.data : [];
  content.innerHTML = `
    <div class="space-y-1.5">
      ${rows.map(r => `
        <div class="som-card p-2.5 text-xs">
          <div class="flex justify-between"><b>${escapeHtml(r.action)}</b><span style="color:var(--som-text-soft);">${new Date(r.timestamp).toLocaleString('id-ID')}</span></div>
          <div style="color: var(--som-text-soft);">${escapeHtml(r.username)} — ${escapeHtml(r.detail || '')}</div>
        </div>
      `).join('') || emptyState('Belum ada aktivitas', '')}
    </div>
  `;
}

/* ---------- SETTINGS ---------- */
async function renderAdminSettings() {
  const content = document.getElementById('admin-content');
  const resp = await window.SOM_API.callApi('adminGetSettings', {});
  const enabled = resp.success ? resp.data.enable_qty_system : true;
  content.innerHTML = `
    <div class="som-card p-4 flex items-center justify-between">
      <div>
        <div class="font-medium">Fitur Qty System</div>
        <div class="text-xs" style="color: var(--som-text-soft);">Tampilkan qty system saat scan barcode di menu SO</div>
      </div>
      <button id="toggle-qty-system" class="som-btn ${enabled ? 'som-btn-success' : 'som-btn-secondary'} text-xs px-3 py-2">${enabled ? 'Aktif' : 'Nonaktif'}</button>
    </div>
    <div class="som-card p-4 mt-3">
      <div class="font-medium mb-2">Pilih engine scanner default</div>
      <div class="flex gap-2">
        <button id="engine-html5" class="som-btn som-btn-secondary flex-1 text-sm">HTML5-QR</button>
        <button id="engine-quagga" class="som-btn som-btn-secondary flex-1 text-sm">Quagga</button>
      </div>
    </div>
  `;
  document.getElementById('toggle-qty-system').addEventListener('click', async () => {
    const r = await window.SOM_API.callApi('adminToggleQtySystem', { enabled: !enabled });
    if (r.success) { showToast('Pengaturan diperbarui'); renderAdminSettings(); }
  });
  document.getElementById('engine-html5').addEventListener('click', () => { window.SOM_SCANNER.setScannerEngine('html5qrcode'); showToast('Engine default: HTML5-QR'); });
  document.getElementById('engine-quagga').addEventListener('click', () => { window.SOM_SCANNER.setScannerEngine('quagga'); showToast('Engine default: Quagga'); });
}

window.SOM_ADMIN = { renderMenuAdmin };
