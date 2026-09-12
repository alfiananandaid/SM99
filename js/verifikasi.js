/**
 * verifikasi.js
 * List data SO utk diverifikasi, searchable & sortable, form verifikasi dengan konfirmasi.
 */

let verifikasiFilter = { search: '', department: '', sortBy: '' };

async function renderMenuVerifikasi() {
  const view = document.getElementById('view-content');
  view.innerHTML = `
    <div class="p-4 space-y-3 som-fade-in">
      <div class="som-card p-4">
        <h2 class="font-semibold text-lg mb-3">Verifikasi stok</h2>
        <div class="flex gap-2 mb-2">
          <input id="veri-search" class="som-input" placeholder="Cari Kode UPC / deskripsi..." />
        </div>
        <div class="flex gap-2 overflow-x-auto pb-1">
          <select id="veri-sort" class="som-input" style="width:auto;">
            <option value="">Urutkan</option>
            <option value="qty_desc">Qty SO tertinggi</option>
            <option value="qty_asc">Qty SO terendah</option>
            <option value="selisih_desc">Selisih terbesar</option>
          </select>
        </div>
      </div>
      <div id="veri-list" class="space-y-2"></div>
    </div>
  `;

  document.getElementById('veri-search').addEventListener('input', debounce((e) => {
    verifikasiFilter.search = e.target.value;
    loadVerifikasiList();
  }, 300));
  document.getElementById('veri-sort').addEventListener('change', (e) => {
    verifikasiFilter.sortBy = e.target.value;
    loadVerifikasiList();
  });

  await loadVerifikasiList();
}

async function loadVerifikasiList() {
  const listEl = document.getElementById('veri-list');
  listEl.innerHTML = skeletonRows(4);
  const resp = await window.SOM_API.callApi('getVerifikasiList', verifikasiFilter);
  if (!resp.success) { listEl.innerHTML = emptyState('Gagal memuat data', resp.message); return; }
  renderVerifikasiItems(resp.data);
}

function renderVerifikasiItems(items) {
  const listEl = document.getElementById('veri-list');
  if (!items.length) { listEl.innerHTML = emptyState('Tidak ada data', 'Semua data sudah diverifikasi dan sesuai.'); return; }

  listEl.innerHTML = items.map(item => {
    const isSelisih = item.status === 'selisih';
    const badge = isSelisih
      ? `<span class="som-badge som-badge-danger">Selisih ${item.selisih}</span>`
      : `<span class="som-badge som-badge-neutral">Belum diverifikasi</span>`;
    return `
      <button class="som-card p-3 w-full text-left veri-item" data-id="${item.id_so}">
        <div class="flex justify-between items-start">
          <div>
            <div class="font-semibold">${escapeHtml(item.kode_upc)}</div>
            <div class="text-xs" style="color: var(--som-text-soft);">${escapeHtml(item.deskripsi)} · ${escapeHtml(item.lokasi)}</div>
          </div>
          ${badge}
        </div>
        <div class="flex justify-between text-xs mt-2" style="color: var(--som-text-soft);">
          <span>Qty SO: <b style="color:var(--som-text);">${item.qty_so}</b></span>
          <span>Qty System: <b style="color:var(--som-text);">${item.qty_system ?? '-'}</b></span>
        </div>
        ${item.verified_by ? `<div class="text-xs mt-1.5" style="color:#B26A00;">Diverifikasi oleh ${escapeHtml(item.verified_by)} pukul ${new Date(item.verified_at).toLocaleTimeString('id-ID')}</div>` : ''}
      </button>
    `;
  }).join('');

  listEl.querySelectorAll('.veri-item').forEach(btn => {
    const item = items.find(i => i.id_so === btn.dataset.id);
    btn.addEventListener('click', () => openVerifikasiForm(item));
  });
}

function openVerifikasiForm(item) {
  openBottomSheet(`
    <h3 class="font-semibold text-lg mb-1">${escapeHtml(item.kode_upc)}</h3>
    <p class="text-sm mb-4" style="color: var(--som-text-soft);">${escapeHtml(item.deskripsi)} · ${escapeHtml(item.lokasi)}</p>
    <div class="grid grid-cols-2 gap-2 mb-4 text-sm">
      <div class="p-3 rounded-xl" style="background: var(--som-surface-2);"><div class="text-xs" style="color:var(--som-text-soft);">Qty SO</div><div class="font-semibold">${item.qty_so}</div></div>
      <div class="p-3 rounded-xl" style="background: var(--som-surface-2);"><div class="text-xs" style="color:var(--som-text-soft);">Qty System</div><div class="font-semibold">${item.qty_system ?? '-'}</div></div>
    </div>
    <label class="text-xs font-medium block mb-1.5" style="color: var(--som-text-soft);">Qty Verifikasi *</label>
    <input id="input-qty-verifikasi" type="number" class="som-input mb-3" value="${item.qty_so}" />
    <label class="text-xs font-medium block mb-1.5" style="color: var(--som-text-soft);">Keterangan (opsional)</label>
    <input id="input-ket-verifikasi" type="text" class="som-input mb-4" placeholder="Catatan verifikasi" />
    <button id="btn-save-verifikasi" class="som-btn som-btn-primary w-full">Simpan verifikasi</button>
  `);

  document.getElementById('btn-save-verifikasi').addEventListener('click', () => {
    const qtyVerifikasi = document.getElementById('input-qty-verifikasi').value;
    const keterangan = document.getElementById('input-ket-verifikasi').value;
    confirmSaveVerifikasi(item.id_so, qtyVerifikasi, keterangan);
  });
}

function confirmSaveVerifikasi(idSo, qtyVerifikasi, keterangan) {
  openBottomSheet(`
    <h3 class="font-semibold text-lg mb-2">Konfirmasi verifikasi</h3>
    <p class="text-sm mb-4" style="color: var(--som-text-soft);">Data akan disimpan dan menimpa hasil verifikasi sebelumnya (jika ada). Yakin ingin melanjutkan?</p>
    <div class="flex gap-2">
      <button id="btn-cancel-veri" class="som-btn som-btn-secondary flex-1">Batal</button>
      <button id="btn-yes-veri" class="som-btn som-btn-primary flex-1">Ya, simpan</button>
    </div>
  `);
  document.getElementById('btn-cancel-veri').addEventListener('click', closeBottomSheet);
  document.getElementById('btn-yes-veri').addEventListener('click', async () => {
    const resp = await window.SOM_API.callApi('saveVerifikasi', { id_so: idSo, qty_verifikasi: qtyVerifikasi, keterangan });
    closeBottomSheet();
    if (resp.success) {
      showToast(resp.data.status === 'sesuai' ? 'Data sesuai — dihapus dari antrian' : 'Verifikasi disimpan, masih ada selisih');
      loadVerifikasiList();
    } else {
      showToast(resp.message, 'error');
    }
  });
}

window.SOM_VERIFIKASI = { renderMenuVerifikasi };
