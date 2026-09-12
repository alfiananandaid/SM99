let isSyncing = false;

// Monitor koneksi internet
window.addEventListener('online', () => {
  updateOnlineStatus(true);
  triggerAutoSync();
});

window.addEventListener('offline', () => {
  updateOnlineStatus(false);
});

function updateOnlineStatus(isOnline) {
  const badge = document.getElementById('network-badge');
  if (badge) {
    badge.className = `status-pill ${isOnline ? 'online' : ''}`;
    badge.textContent = isOnline ? '🟢 Online' : '⚪ Offline';
  }
}

async function triggerAutoSync() {
  if (isSyncing || !navigator.onLine) return;
  isSyncing = true;

  const pendingList = await getPendingQueue();
  const syncBadge = document.getElementById('pending-count');
  
  if (syncBadge) syncBadge.textContent = pendingList.length > 0 ? `${pendingList.length} Pending` : '';

  if (pendingList.length === 0) {
    isSyncing = false;
    return;
  }

  console.log(`[SYNC] Memulai push ${pendingList.length} transaksi...`);

  for (const record of pendingList) {
    try {
      const res = await sendApiRequest('saveSO', record);
      if (res.success) {
        // Hapus dari IndexedDB HANYA setelah server konfirmasi SUCCESS
        await removeFromLocalQueue(record.idempotency_key);
        console.log(`[SYNC SUCCESS] Key: ${record.idempotency_key}`);
      } else if (res.data && res.data.require_confirmation) {
        // Skrip butuh penanganan manual dari user (Duplicate Conflict)
        console.warn("[SYNC CONFLICT] Butuh interaksi user untuk item:", record);
      }
    } catch (err) {
      console.error("[SYNC ERROR] Gagal sync record:", err);
      break; // Hentikan loop jika koneksi kembali drop
    }
  }

  const remaining = await getPendingQueue();
  if (syncBadge) syncBadge.textContent = remaining.length > 0 ? `${remaining.length} Pending` : '';
  isSyncing = false;
}

// Cek sync otomatis setiap 30 detik jika online
setInterval(() => {
  if (navigator.onLine) triggerAutoSync();
}, 30000);
