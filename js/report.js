/**
 * report.js
 * Menu Report: kategori sesuai/selisih/belum verifikasi/belum SO + export Excel.
 */

const REPORT_CATEGORIES = [
  { key: 'sesuai', label: 'Sesuai', badge: 'som-badge-success' },
  { key: 'selisih', label: 'Selisih', badge: 'som-badge-danger' },
  { key: 'belum_verifikasi', label: 'Belum diverifikasi', badge: 'som-badge-warning' },
  { key: 'belum_so', label: 'Belum di-SO', badge: 'som-badge-neutral' }
];

let activeReportCategory = 'sesuai';

async function renderMenuReport() {
  const view = document.getElementById('view-content');
  view.innerHTML = `
    <div class="p-4 space-y-3 som-fade-in">
      <div class="som-card p-2 flex gap-1 overflow-x-auto">
        ${REPORT_CATEGORIES.map(c => `
          <button class="report-tab flex-1 text-sm font-medium py-2.5 rounded-xl transition" data-key="${c.key}"
            style="white-space:nowrap;">${c.label}</button>
        `).join('')}
      </div>
      <button id="btn-export-excel" class="som-btn som-btn-primary w-full flex items-center justify-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Download Excel
      </button>
      <div id="report-list" class="space-y-2"></div>
    </div>
  `;

  view.querySelectorAll('.report-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeReportCategory = btn.dataset.key;
      updateReportTabs();
      loadReport();
    });
  });
  document.getElementById('btn-export-excel').addEventListener('click', exportExcel);

  updateReportTabs();
  await loadReport();
}

function updateReportTabs() {
  document.querySelectorAll('.report-tab').forEach(btn => {
    if (btn.dataset.key === activeReportCategory) {
      btn.style.background = 'var(--som-accent)';
      btn.style.color = '#fff';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = 'var(--som-text-soft)';
    }
  });
}

async function loadReport() {
  const listEl = document.getElementById('report-list');
  listEl.innerHTML = skeletonRows(4);
  const resp = await window.SOM_API.callApi('getReport', { category: activeReportCategory });
  if (!resp.success) { listEl.innerHTML = emptyState('Gagal memuat laporan', resp.message); return; }
  const rows = resp.data[activeReportCategory] || [];
  if (!rows.length) { listEl.innerHTML = emptyState('Tidak ada data', 'Kategori ini kosong saat ini.'); return; }

  listEl.innerHTML = rows.map(r => `
    <div class="som-card p-3">
      <div class="font-semibold">${escapeHtml(r.kode_upc)}</div>
      <div class="text-xs mb-1.5" style="color: var(--som-text-soft);">${escapeHtml(r.deskripsi || '')} ${r.lokasi ? '· ' + escapeHtml(r.lokasi) : ''}</div>
      <div class="flex gap-4 text-xs">
        ${r.qty_input !== undefined ? `<span>Qty SO: <b>${r.qty_input}</b></span>` : ''}
        ${r.qty_verifikasi !== undefined && r.qty_verifikasi !== '' ? `<span>Qty Verifikasi: <b>${r.qty_verifikasi}</b></span>` : ''}
        ${r.selisih_hasil !== undefined && r.selisih_hasil !== '' ? `<span>Selisih: <b>${r.selisih_hasil}</b></span>` : ''}
      </div>
    </div>
  `).join('');
}

async function exportExcel() {
  const btn = document.getElementById('btn-export-excel');
  setBtnLoading(btn, true);
  const resp = await window.SOM_API.callApi('exportReportExcel', { category: activeReportCategory });
  setBtnLoading(btn, false);
  if (resp.success) {
    window.open(resp.data.downloadUrl, '_blank');
    showToast('File Excel siap diunduh');
  } else {
    showToast(resp.message || 'Gagal export Excel', 'error');
  }
}

window.SOM_REPORT = { renderMenuReport };
