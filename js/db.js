/**
 * db.js
 * Wrapper IndexedDB: 'so_queue' (antrian offline SO), 'master_cache', 'session', 'lokasi_cache'
 */

const SOM_DB_NAME = 'som_db';
const SOM_DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SOM_DB_NAME, SOM_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('so_queue')) {
        db.createObjectStore('so_queue', { keyPath: 'client_uuid' });
      }
      if (!db.objectStoreNames.contains('master_cache')) {
        db.createObjectStore('master_cache', { keyPath: 'Kode UPC' });
      }
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function idbPut(storeName, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function idbDelete(storeName, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function idbGetAll(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function idbGet(storeName, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function idbClear(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

/* ---------- Session (local, dipakai untuk auto-logout timer) ---------- */
async function saveSession(session) { return idbPut('kv', { key: 'session', value: session }); }
async function loadSession() {
  const rec = await idbGet('kv', 'session');
  return rec ? rec.value : null;
}
async function clearSession() { return idbDelete('kv', 'session'); }

/* ---------- Master data cache (untuk pencarian barcode offline) ---------- */
async function cacheMasterData(rows) {
  await idbClear('master_cache');
  for (const row of rows) await idbPut('master_cache', row);
}
async function searchMasterOffline(kode) {
  const rows = await idbGetAll('master_cache');
  return rows.find(r =>
    String(r['Kode UPC']) === kode ||
    String(r['Artikel Number']) === kode ||
    String(r['Article Manufacturer Part Number']) === kode
  ) || null;
}

/* ---------- Offline SO queue ---------- */
async function queueSO(record) { return idbPut('so_queue', record); }
async function getQueuedSO() { return idbGetAll('so_queue'); }
async function removeQueuedSO(clientUuid) { return idbDelete('so_queue', clientUuid); }

window.SOM_DB = {
  saveSession, loadSession, clearSession,
  cacheMasterData, searchMasterOffline,
  queueSO, getQueuedSO, removeQueuedSO
};
