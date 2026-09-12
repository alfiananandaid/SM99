/**
 * auth.js
 * Login, show/hide password, forgot password, session timer 12 jam.
 */

let logoutTimer = null;

function scheduleAutoLogout(expiresAt) {
  if (logoutTimer) clearTimeout(logoutTimer);
  const ms = expiresAt - Date.now();
  logoutTimer = setTimeout(async () => {
    await window.SOM_DB.clearSession();
    showToast('Sesi berakhir setelah 12 jam. Silakan login kembali.');
    renderLoginScreen();
  }, Math.max(ms, 0));
}

async function doLogin(username, password) {
  const btn = document.getElementById('btn-login');
  setBtnLoading(btn, true);
  const resp = await window.SOM_API.callApi('login', { username, password });
  setBtnLoading(btn, false);

  if (!resp.success) {
    showToast(resp.message || 'Login gagal', 'error');
    return;
  }

  await window.SOM_DB.saveSession(resp.data);
  scheduleAutoLogout(resp.data.expiresAt);
  showToast('Selamat datang, ' + resp.data.nama);
  await renderDashboard();
}

async function doLogout() {
  const session = await window.SOM_DB.loadSession();
  if (session) await window.SOM_API.callApi('logout', { token: session.token });
  await window.SOM_DB.clearSession();
  if (logoutTimer) clearTimeout(logoutTimer);
  renderLoginScreen();
}

async function doForgotPassword(username) {
  if (!username) { showToast('Isi username terlebih dahulu', 'error'); return; }
  const resp = await window.SOM_API.callApi('forgotPassword', { username });
  showToast(resp.data ? resp.data.message : (resp.message || 'Gagal mengirim permintaan'), resp.success ? 'success' : 'error');
}

function renderLoginScreen() {
  const root = document.getElementById('app-root');
  root.innerHTML = `
    <div class="min-h-screen flex flex-col justify-center px-6 som-safe-top som-safe-bottom" style="background: var(--som-bg);">
      <div class="max-w-sm w-full mx-auto som-fade-in">
        <div class="flex flex-col items-center mb-8">
          <div class="w-16 h-16 rounded-3xl flex items-center justify-center mb-4" style="background: var(--som-accent);">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path d="M4 7L12 3L20 7M4 7L12 11M4 7V17L12 21M20 7L12 11M20 7V17L12 21M12 11V21" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h1 class="text-2xl font-semibold" style="color: var(--som-text);">Stock Opname Mandiri</h1>
          <p class="text-sm mt-1" style="color: var(--som-text-soft);">Masuk untuk mulai stock opname</p>
        </div>

        <div class="som-card p-5 space-y-4">
          <div>
            <label class="text-xs font-medium block mb-1.5" style="color: var(--som-text-soft);">Username</label>
            <input id="input-username" type="text" autocomplete="username" class="som-input" placeholder="Masukkan username" />
          </div>
          <div>
            <label class="text-xs font-medium block mb-1.5" style="color: var(--som-text-soft);">Password</label>
            <div class="som-pw-wrap">
              <input id="input-password" type="password" minlength="6" autocomplete="current-password" class="som-input" placeholder="Minimal 6 karakter" style="padding-right: 44px;" />
              <span class="som-pw-toggle" id="toggle-pw">
                <svg id="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2 12S5.5 5 12 5s10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/></svg>
              </span>
            </div>
          </div>
          <button id="btn-login" class="som-btn som-btn-primary w-full flex items-center justify-center gap-2">
            <span class="btn-label">Masuk</span>
          </button>
          <button id="btn-forgot" class="text-sm w-full text-center py-1" style="color: var(--som-accent);">Lupa password?</button>
        </div>

        <button id="btn-install" class="som-btn som-btn-secondary w-full mt-5 hidden items-center justify-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Instal aplikasi ke perangkat
        </button>
        <p class="text-center text-xs mt-6" style="color: var(--som-text-soft);">v${window.SOM_CONFIG.APP_VERSION} · online &amp; offline ready</p>
      </div>
    </div>
  `;

  document.getElementById('toggle-pw').addEventListener('click', () => {
    const input = document.getElementById('input-password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  document.getElementById('btn-login').addEventListener('click', () => {
    const u = document.getElementById('input-username').value.trim();
    const p = document.getElementById('input-password').value;
    if (!u || p.length < 6) { showToast('Username & password (min 6 karakter) wajib diisi', 'error'); return; }
    doLogin(u, p);
  });
  document.getElementById('btn-forgot').addEventListener('click', () => {
    doForgotPassword(document.getElementById('input-username').value.trim());
  });

  setupInstallPrompt();
}

function setupInstallPrompt() {
  const btn = document.getElementById('btn-install');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__deferredInstallPrompt = e;
    btn.classList.remove('hidden');
    btn.classList.add('flex');
  });
  btn.addEventListener('click', async () => {
    if (!window.__deferredInstallPrompt) return;
    window.__deferredInstallPrompt.prompt();
    await window.__deferredInstallPrompt.userChoice;
    window.__deferredInstallPrompt = null;
    btn.classList.add('hidden');
  });
}

window.addEventListener('som:session-expired', () => {
  showToast('Sesi berakhir. Silakan login kembali.', 'error');
  renderLoginScreen();
});

window.SOM_AUTH = { doLogin, doLogout, renderLoginScreen, scheduleAutoLogout };
