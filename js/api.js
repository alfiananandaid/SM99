// GANTI DENGAN URL DEPLOYMENT WEB APP GAS ANDA
const GAS_API_URL = "https://script.google.com/macros/s/AKfycby7eB9XgfieWIfcBNr6GKnvHCyTZ9fyV7v5MdyzlmLv1ASGRcI-JDE5B5hX-iZaLP9J/exec";

async function sendApiRequest(action, payload = {}) {
  const sessionToken = localStorage.getItem('som_session_token') || '';
  
  const bodyData = {
    action: action,
    session_token: sessionToken,
    payload: payload
  };

  try {
    const response = await fetch(GAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Mengurangi preflight CORS di GAS
      body: JSON.stringify(bodyData)
    });

    const json = await response.json();
    return json;
  } catch (error) {
    console.warn("API Request Failed / Offline mode active:", error);
    return { success: false, offline: true, message: "Koneksi terputus. Menggunakan mode offline." };
  }
}
