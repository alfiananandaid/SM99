document.addEventListener('DOMContentLoaded', async () => {
  await initDB();
  updateOnlineStatus(navigator.onLine);
  registerServiceWorker();

  // Load awal sync jika ada pending
  triggerAutoSync();
});

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then(() => console.log('Service Worker Registered'))
      .catch(err => console.error('SW Reg Error:', err));
  }
}

// Generate Idempotency Key Unik (PRD Bab 36)
function generateIdempotencyKey(username, barcode) {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").substring(0, 14);
  const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `SO-${timestamp}-${username}-${barcode}-${randomStr}`;
}

// Controller logic untuk Form SIMPAN SO
async function processSaveSO(actionType = 'NEW') {
  const barcode = document.getElementById('input-barcode').value.trim();
  const qty = parseFloat(document.getElementById('input-qty').value);
  const lokasi = document.getElementById('input-lokasi').value.trim();
  const keterangan = document.getElementById('input-ket').value.trim();
  const username = localStorage.getItem('som_username') || 'STAFF1';

  if (!barcode || isNaN(qty) || !lokasi) {
    showModal("Peringatan", "Barcode, Lokasi, dan Qty wajib diisi!");
    return;
  }

  // 1. Cari produk dari Master Offline Cache dulu
  const productData = await searchOfflineMaster(barcode);

  // 2. Susun Payload Record
  const payload = {
    idempotency_key: generateIdempotencyKey(username, barcode),
    session_id: `SO-LOC-${lokasi}-${new Date().toISOString().slice(0,10)}`,
    lokasi: lokasi,
    kode_upc: productData ? productData['Kode UPC'] : barcode,
    barcode_input: barcode,
    artikel_number: productData ? productData['Artikel Number'] : 'UNKNOWN',
    deskripsi_produk: productData ? productData['Deskripsi Produk'] : 'UNKNOWN',
    department: productData ? productData['Department'] : 'UNKNOWN',
    brand: productData ? productData['Brand (Description)'] : 'UNKNOWN',
    vendor_code: productData ? productData['Vendor Code'] : 'UNKNOWN',
    vendor_name: productData ? productData['Vendor Name'] : 'UNKNOWN',
    qty_system: productData ? (productData['Qty System'] || 0) : 0,
    qty_so: qty,
    keterangan: keterangan,
    status_master: productData ? 'REGISTERED' : 'UNKNOWN',
    action_type: actionType, // 'NEW', 'REPLACE', atau 'ADD'
    device_id: getDeviceId()
  };

  // 3. Simpan ke Offline Queue (IndexedDB) Terlebih Dahulu (Offline-First)
  await saveToLocalQueue(payload);

  // 4. Jika Online, Langsung Trigger Sync ke GAS
  if (navigator.onLine) {
    triggerAutoSync();
  } else {
    showToast("⚪ Data disimpan di perangkat (Offline Mode)");
  }

  // 5. Reset UI untuk Siap Scan Berikutnya (SCAN -> QTY -> SAVE)
  resetFormForNextScan();
}

function resetFormForNextScan() {
  document.getElementById('input-barcode').value = '';
  document.getElementById('input-qty').value = '';
  document.getElementById('input-ket').value = '';
  document.getElementById('product-info-box').style.display = 'none';
  document.getElementById('input-barcode').focus();
  showToast("✓ Data berhasil disimpan. Siap scan berikutnya!");
}

function getDeviceId() {
  let devId = localStorage.getItem('som_device_id');
  if (!devId) {
    devId = 'DEV-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    localStorage.setItem('som_device_id', devId);
  }
  return devId;
}

// Modal Custom UI Helper
function showModal(title, message, onConfirm = null) {
  const overlay = document.getElementById('custom-modal');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent = message;

  const btnConfirm = document.getElementById('modal-confirm-btn');
  if (onConfirm) {
    btnConfirm.style.display = 'block';
    btnConfirm.onclick = () => {
      onConfirm();
      closeModal();
    };
  } else {
    btnConfirm.style.display = 'none';
  }

  overlay.classList.add('active');
}

function closeModal() {
  document.getElementById('custom-modal').classList.remove('active');
}

function showToast(msg) {
  const toast = document.getElementById('toast-notification');
  if(toast) {
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
  }
}
