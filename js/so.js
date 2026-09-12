/**
 * so.js
 * Menu SO: pilih/kelola lokasi -> scan/input barcode -> qty & keterangan -> simpan (offline-first).
 */

let soState = {
  lokasiAktif: null,
  produk: null,
  history: []
};

async function renderMenuSO() {
  const view = document.getElementById('view-content');
  view.innerHTML = `
    <div class="p-4 space-y-4 som-fade-in" id="so-container">
      <div id="so-lokasi-section"></div>
      <div id="so-scan-section" class="hidden"></div>
    </div>
  `;
  await renderLokasiSection();
  syncOfflineQueueIfOnline();
}

/* ---------- LOKASI ---------- */

async function renderLokasiSection() {
  const el = document.getElementById('so-lokasi-section');
  el.innerHTML = `
    <div class="som-card p-4">
      <h2 class="font-semibold text-lg mb-3">Pilih lokasi</h2>
      <div class="flex gap-2 mb-3">
        <input id="lokasi-search" class="som-input" placeholder="Cari lokasi..." />
        <button id="btn-add-lokasi" class="som-btn som-btn-primary px-4">+</button>
      </div>
      <div id="lokasi-list" class="space-y-2"></div>
    </div>
  `;
  await loadLokasiList();

  document.getElementById('lokasi-search').addEventListener('input', (e) => filterLokasiList(e.target.value));
  document.getElementById('btn-add-lokasi').addEventListener('click', openAddLokasiSheet);
}

let allLokasi = [];

async function loadLokasiList() {
  const listEl = document.getElementById('lokasi-list');
  listEl.innerHTML = skeletonRows(3);
  const resp = await window.SOM_API.callApi('getLokasi', {});
  allLokasi = resp.success ? resp.data : [];
  renderLokasiItems(allLokasi);
}

function filterLokasiList(q) {
  q = q.toLowerCase();
  renderLokasiItems(allLokasi.filter(l => String(l.nama_lokasi).toLowerCase().includes(q)));
}

function renderLokasiItems(items) {
  const listEl = document.getElementById('lokasi-list');
  if (!items.length) { listEl.innerHTML = emptyState('Belum ada lokasi', 'Tambahkan lokasi pertama untuk mulai SO.'); return; }
  listEl.innerHTML = items.map(l => `
    <div class="flex items-center justify-between p-3 rounded-2xl" style="background: var(--som-surface-2);">
      <button class="text-left flex-1 lokasi-select" data-id="${l.id_lokasi}" data-nama="${escapeHtml(l.nama_lokasi)}">
        <div class="font-medium">${escapeHtml(l.nama_lokasi)}</div>
        <div class="text-xs" style="color: var(--som-text-soft);">dibuat oleh ${escapeHtml(l.dibuat_oleh)}</div>
      </button>
      ${l.status === 'pending_delete' ? '<span class="som-badge som-badge-warning mr-2">Menunggu approval hapus</span>' : ''}
      <button class="lokasi-delete p-2" data-id="${l.id_lokasi}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" stroke="#FF3B30" stroke-width="1.6" stroke-linecap="round"/></svg>
      </button>
    </div>
  `).join('');

  listEl.querySelectorAll('.lokasi-select').forEach(btn => {
    btn.addEventListener('click', () => selectLokasi(btn.dataset.id, btn.dataset.nama));
  });
  listEl.querySelectorAll('.lokasi-delete').forEach(btn => {
    btn.addEventListener('click', () => confirmDeleteLokasi(btn.dataset.id));
  });
}

function openAddLokasiSheet() {
  openBottomSheet(`
    <h3 class="font-semibold text-lg mb-3">Tambah lokasi baru</h3>
    <input id="new-lokasi-name" class="som-input mb-3" placeholder="Nama lokasi (contoh: Rak A1)" />
    <button id="btn-save-lokasi" class="som-btn som-btn-primary w-full">Simpan lokasi</button>
  `);
  document.getElementById('btn-save-lokasi').addEventListener('click', async () => {
    const nama = document.getElementById('new-lokasi-name').value.trim();
    if (!nama) { showToast('Nama lokasi wajib diisi', 'error'); return; }
    const resp = await window.SOM_API.callApi('addLokasi', { nama_lokasi: nama });
    if (resp.success) {
      showToast('Lokasi ditambahkan');
      closeBottomSheet();
      await loadLokasiList();
    } else {
      showToast(resp.message, 'error');
    }
  });
}

function confirmDeleteLokasi(id) {
  openBottomSheet(`
    <h3 class="font-semibold text-lg mb-2">Hapus lokasi?</h3>
    <p class="text-sm mb-4" style="color: var(--som-text-soft);">Lokasi berumur di atas 15 menit membutuhkan approval admin.</p>
    <div class="flex gap-2">
      <button id="btn-cancel-del" class="som-btn som-btn-secondary flex-1">Batal</button>
      <button id="btn-confirm-del" class="som-btn som-btn-danger flex-1">Hapus</button>
    </div>
  `);
  document.getElementById('btn-cancel-del').addEventListener('click', closeBottomSheet);
  document.getElementById('btn-confirm-del').addEventListener('click', async () => {
    const resp = await window.SOM_API.callApi('deleteLokasi', { id_lokasi: id });
    if (resp.success) {
      showToast(resp.data.mode === 'auto' ? 'Lokasi terhapus' : 'Menunggu approval admin');
      closeBottomSheet();
      await loadLokasiList();
    } else {
      showToast(resp.message, 'error');
    }
  });
}

function selectLokasi(id, nama) {
  soState.lokasiAktif = { id, nama };
  document.getElementById('so-scan-section').classList.remove('hidden');
  renderScanSection();
}

/* ---------- SCAN / INPUT BARCODE ---------- */

function renderScanSection() {
  const el = document.getElementById('so-scan-section');
  el.innerHTML = `
    <div class="som-card p-4">
      <div class="flex items-center justify-between mb-3">
        <div>
          <div class="text-xs" style="color: var(--som-text-soft);">Lokasi aktif</div>
          <div class="font-semibold">${escapeHtml(soState.lokasiAktif.nama)}</div>
        </div>
        <button id="btn-ganti-lokasi" class="text-sm" style="color: var(--som-accent);">Ganti</button>
      </div>

      <div class="flex gap-2 mb-3">
        <input id="barcode-input" class="som-input" placeholder="Scan atau ketik Kode UPC" />
        <button id="btn-open-scanner" class="som-btn som-btn-primary px-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="4" stroke="white" stroke-width="1.6"/><path d="M7 8v8M11 8v8M13 8v8M17 8v8" stroke="white" stroke-width="1.6"/></svg>
        </button>
      </div>
      <div id="scanner-holder"></div>

      <div id="produk-form" class="mt-4 hidden"></div>
    </div>
  `;

  document.getElementById('btn-ganti-lokasi').addEventListener('click', () => {
    soState.lokasiAktif = null;
    document.getElementById('so-scan-section').classList.add('hidden');
  });

  document.getElementById('barcode-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleBarcodeInput(e.target.value.trim());
  });

  document.getElementById('btn-open-scanner').addEventListener('click', async () => {
    const holder = document.getElementById('scanner-holder');
    if (holder.dataset.open === '1') {
      await window.SOM_SCANNER.stopScanner();
      holder.innerHTML = '';
      holder.dataset.open = '0';
      return;
    }
    holder.dataset.open = '1';
    await window.SOM_SCANNER.startScanner('scanner-holder', async (code) => {
      await window.SOM_SCANNER.stopScanner();
      holder.innerHTML = '';
      holder.dataset.open = '0';
      document.getElementById('barcode-input').value = code;
      handleBarcodeInput(code);
    });
  });
}

async function handleBarcodeInput(code) {
  if (!code) return;
  let product = null;
  let found = false;

  if (navigator.onLine) {
    const resp = await window.SOM_API.callApi('searchProduct', { kode: code });
    if (resp.success) { product = resp.data.product; found = resp.data.found; }
  } else {
    const offlineHit = await window.SOM_DB.searchMasterOffline(code);
    if (offlineHit) {
      product = {
        'Kode UPC': offlineHit['Kode UPC'],
        'Deskripsi Produk': offlineHit['Deskripsi Produk'],
        'Department': offlineHit['Department'],
        'Vendor Code': offlineHit['Vendor Code'],
        'Vendor Name': offlineHit['Vendor Name'],
        'Qty System': null
      };
      found = true;
    }
  }

  if (!found) {
    product = { 'Kode UPC': code, 'Deskripsi Produk': 'Unknown', 'Department': 'Unknown', 'Vendor Code': 'Unknown', 'Vendor Name': 'Unknown', 'Qty System': null };
    openBottomSheet(`
      <h3 class="font-semibold text-lg mb-2">Barcode tidak terdaftar</h3>
      <p class="text-sm mb-4" style="color: var(--som-text-soft);">Kode <b>${escapeHtml(code)}</b> tidak ditemukan di data master. Pastikan barcode benar, atau hubungi admin. Data tetap bisa disimpan sebagai "unknown".</p>
      <div class="flex gap-2">
        <button id="btn-cancel-unknown" class="som-btn som-btn-secondary flex-1">Batal</button>
        <button id="btn-continue-unknown" class="som-btn som-btn-primary flex-1">Lanjutkan</button>
      </div>
    `);
    document.getElementById('btn-cancel-unknown').addEventListener('click', closeBottomSheet);
    document.getElementById('btn-continue-unknown').addEventListener('click', () => {
      closeBottomSheet();
      soState.produk = { ...product, status_barcode: 'unknown' };
      renderProdukForm();
    });
    return;
  }

  soState.produk = { ...product, status_barcode: 'found' };
  renderProdukForm();
}

async function renderProdukForm() {
  const el = document.getElementById('produk-form');
  el.classList.remove('hidden');
  const p = soState.produk;
  el.innerHTML = `
    <div class="som-fade-in space-y-3">
      <div class="grid grid-cols-2 gap-2 text-sm">
        <div class="col-span-2 p-3 rounded-xl" style="background: var(--som-surface-2);">
          <div class="text-xs" style="color: var(--som-text-soft);">Kode UPC</div>
          <div class="font-semibold">${escapeHtml(p['Kode UPC'])}</div>
        </div>
        <div class="col-span-2 p-3 rounded-xl" style="background: var(--som-surface-2);">
          <div class="text-xs" style="color: var(--som-text-soft);">Deskripsi Produk</div>
          <div class="font-medium">${escapeHtml(p['Deskripsi Produk'])}</div>
        </div>
        <div class="p-3 rounded-xl" style="background: var(--som-surface-2);">
          <div class="text-xs" style="color: var(--som-text-soft);">Department</div>
          <div class="font-medium">${escapeHtml(p['Department'])}</div>
        </div>
        <div class="p-3 rounded-xl" style="background: var(--som-surface-2);">
          <div class="text-xs" style="color: var(--som-text-soft);">Qty System</div>
          <div class="font-medium">${p['Qty System'] === null || p['Qty System'] === undefined ? '-' : p['Qty System']}</div>
        </div>
        <div class="p-3 rounded-xl" style="background: var(--som-surface-2);">
          <div class="text-xs" style="color: var(--som-text-soft);">Vendor Code</div>
          <div class="font-medium">${escapeHtml(p['Vendor Code'])}</div>
        </div>
        <div class="p-3 rounded-xl" style="background: var(--som-surface-2);">
          <div class="text-xs" style="color: var(--som-text-soft);">Vendor Name</div>
          <div class="font-medium">${escapeHtml(p['Vendor Name'])}</div>
        </div>
      </div>

      <div>
        <label class="text-xs font-medium block mb-1.5" style="color: var(--som-text-soft);">Qty *</label>
        <input id="input-qty" type="number" inputmode="numeric" min="0" class="som-input" placeholder="Masukkan qty" />
      </div>
      <div>
        <label class="text-xs font-medium block mb-1.5" style="color: var(--som-text-soft);">Keterangan (opsional)</label>
        <input id="input-keterangan" type="text" class="som-input" placeholder="Catatan tambahan" />
      </div>

      <div id="history-holder"></div>

      <button id="btn-save-so" class="som-btn som-btn-primary w-full">Simpan</button>
    </div>
  `;

  loadHistory(p['Kode UPC']);
  document.getElementById('btn-save-so').addEventListener('click', () => submitSO());
}

async function loadHistory(kodeUpc) {
  const holder = document.getElementById('history-holder');
  holder.innerHTML = skeletonRows(2);
  const resp = await window.SOM_API.callApi('getSOHistory', { kode_upc: kodeUpc, lokasi: soState.lokasiAktif.nama });
  if (!resp.success || !resp.data.length) { holder.innerHTML = ''; return; }
  holder.innerHTML = `
    <div class="text-xs font-medium mb-1.5" style="color: var(--som-text-soft);">Riwayat di lokasi ini</div>
    <div class="space-y-1.5">
      ${resp.data.slice(0, 5).map(h => `
        <div class="flex justify-between text-xs p-2 rounded-lg" style="background: var(--som-surface-2);">
          <span>${new Date(h.timestamp).toLocaleString('id-ID')} · ${escapeHtml(h.staff)}</span>
          <span class="font-semibold">Qty: ${h.qty_input}</span>
        </div>
      `).join('')}
    </div>
  `;
}

async function submitSO(mode) {
  const qty = document.getElementById('input-qty').value;
  const keterangan = document.getElementById('input-keterangan').value;
  if (qty === '' || Number(qty) < 0) { showToast('Qty wajib diisi', 'error'); return; }

  const record = {
    client_uuid: mode ? soState.pendingRecord.client_uuid : (crypto.randomUUID ? crypto.randomUUID() : 'c-' + Date.now()),
    kode_upc: soState.produk['Kode UPC'],
    deskripsi: soState.produk['Deskripsi Produk'],
    department: soState.produk['Department'],
    vendor_code: soState.produk['Vendor Code'],
    vendor_name: soState.produk['Vendor Name'],
    qty_input: Number(qty),
    qty_system: soState.produk['Qty System'],
    lokasi: soState.lokasiAktif.nama,
    keterangan: keterangan,
    status_barcode: soState.produk.status_barcode,
    mode: mode || 'new'
  };

  if (!navigator.onLine) {
    await window.SOM_DB.queueSO(record);
    showToast('Offline: data disimpan di perangkat, akan diupload otomatis saat online.');
    resetProdukForm();
    return;
  }

  const resp = await window.SOM_API.callApi('saveSO', record);
  if (!resp.success) { showToast(resp.message, 'error'); return; }

  if (resp.data.duplicate) {
    soState.pendingRecord = record;
    openBottomSheet(`
      <h3 class="font-semibold text-lg mb-2">Data sudah pernah diinput</h3>
      <p class="text-sm mb-4" style="color: var(--som-text-soft);">
        Kode <b>${escapeHtml(record.kode_upc)}</b> di lokasi ini sudah tercatat qty <b>${resp.data.existing.qty_input}</b> oleh ${escapeHtml(resp.data.existing.staff)}.
      </p>
      <div class="flex flex-col gap-2">
        <button id="btn-replace" class="som-btn som-btn-primary w-full">Timpa (Replace)</button>
        <button id="btn-add" class="som-btn som-btn-secondary w-full">Tambahkan (Add)</button>
        <button id="btn-cancel-dup" class="som-btn som-btn-danger w-full">Batal</button>
      </div>
    `);
    document.getElementById('btn-replace').addEventListener('click', () => { closeBottomSheet(); submitSO('replace'); });
    document.getElementById('btn-add').addEventListener('click', () => { closeBottomSheet(); submitSO('add'); });
    document.getElementById('btn-cancel-dup').addEventListener('click', closeBottomSheet);
    return;
  }

  showToast('Data SO tersimpan');
  resetProdukForm();
}

function resetProdukForm() {
  soState.produk = null;
  soState.pendingRecord = null;
  const el = document.getElementById('produk-form');
  el.classList.add('hidden');
  el.innerHTML = '';
  document.getElementById('barcode-input').value = '';
}

/* ---------- SYNC OFFLINE QUEUE ---------- */

async function syncOfflineQueueIfOnline() {
  if (!navigator.onLine) return;
  const items = await window.SOM_DB.getQueuedSO();
  if (!items.length) return;
  const resp = await window.SOM_API.callApi('syncBatch', { items });
  if (resp.success) {
    for (const r of resp.data) {
      if (r.result && r.result.success) await window.SOM_DB.removeQueuedSO(r.client_uuid);
    }
    showToast(items.length + ' data offline berhasil disinkronkan');
  }
}

window.addEventListener('online', syncOfflineQueueIfOnline);

window.SOM_SO = { renderMenuSO, syncOfflineQueueIfOnline };
