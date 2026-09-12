/**
 * api.js
 * Wrapper request ke GAS Web App. Menggunakan Content-Type: text/plain
 * agar tidak memicu CORS preflight (khas keterbatasan GAS Web App).
 */

async function callApi(action, payload) {
  const session = await window.SOM_DB.loadSession();
  const token = session ? session.token : null;

  try {
    const res = await fetch(window.SOM_CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token, payload: payload || {} })
    });
    const json = await res.json();
    if (!json.success && json.code === 'UNAUTHORIZED') {
      await window.SOM_DB.clearSession();
      window.dispatchEvent(new CustomEvent('som:session-expired'));
    }
    return json;
  } catch (err) {
    return { success: false, message: 'Tidak ada koneksi internet.', code: 'OFFLINE', offline: true };
  }
}

window.SOM_API = { callApi };
