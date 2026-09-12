const DB_NAME = 'SOM_Local_DB';
const DB_VERSION = 1;
let db = null;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      
      // Store 1: Pending Sync Queue
      if (!database.objectStoreNames.contains('sync_queue')) {
        database.createObjectStore('sync_queue', { keyPath: 'idempotency_key' });
      }
      
      // Store 2: Master Data Cache
      if (!database.objectStoreNames.contains('master_cache')) {
        const masterStore = database.createObjectStore('master_cache', { keyPath: 'kode_upc' });
        masterStore.createIndex('artikel_number', 'artikel_number', { unique: false });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = (e) => reject(e.target.error);
  });
}

// Simpan data SO ke Queue Offline
async function saveToLocalQueue(soRecord) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    store.put(soRecord);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

// Ambil semua data pending queue
async function getPendingQueue() {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readonly');
    const store = tx.objectStore('sync_queue');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

// Hapus item queue setelah server kirim konfirmasi SUCCESS
async function removeFromLocalQueue(idempotencyKey) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    store.delete(idempotencyKey);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

// Simpan Data Master ke IndexedDB Cache
async function cacheMasterData(masterList) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('master_cache', 'readwrite');
    const store = tx.objectStore('master_cache');
    masterList.forEach(item => store.put(item));
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

// Cari Produk di Cache Master (Offline Search)
async function searchOfflineMaster(barcode) {
  if (!db) await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction('master_cache', 'readonly');
    const store = tx.objectStore('master_cache');
    
    // 1. Match by Kode UPC
    const upcReq = store.get(barcode);
    upcReq.onsuccess = () => {
      if (upcReq.result) return resolve(upcReq.result);
      
      // 2. Fallback Match by Artikel Number
      const index = store.index('artikel_number');
      const artReq = index.get(barcode);
      artReq.onsuccess = () => resolve(artReq.result || null);
    };
  });
}
