/**
 * scanner.js
 * Scanner barcode dua engine: html5-qrcode & QuaggaJS.
 * Fitur: senter (torch), tap-to-focus, pilih engine dari admin/user setting.
 */

let currentScannerEngine = localStorage.getItem('som_scanner_engine') || 'html5qrcode';
let html5QrInstance = null;
let quaggaRunning = false;
let currentStreamTrack = null;

function setScannerEngine(engine) {
  currentScannerEngine = engine;
  localStorage.setItem('som_scanner_engine', engine);
}

async function startScanner(containerId, onDetected) {
  const container = document.getElementById(containerId);
  container.innerHTML = `
    <div class="som-scan-box" id="scan-box" style="height: 260px;">
      <div id="scan-video-target" style="width:100%;height:100%;"></div>
      <div class="som-scan-frame"></div>
      <div class="som-scan-laser"></div>
      <div class="som-focus-dot" id="focus-dot"></div>
      <button id="btn-torch" class="absolute bottom-3 right-3 w-11 h-11 rounded-full flex items-center justify-center" style="background: rgba(255,255,255,0.9);">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 18h6M10 21h4M12 3a5 5 0 0 0-3 9c.6.5 1 1.2 1 2h4c0-.8.4-1.5 1-2a5 5 0 0 0-3-9Z" stroke="#1C1C1E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button id="btn-switch-engine" class="absolute bottom-3 left-3 px-3 h-11 rounded-full text-xs font-semibold flex items-center" style="background: rgba(255,255,255,0.9); color:#1C1C1E;">
        ${currentScannerEngine === 'html5qrcode' ? 'HTML5-QR' : 'Quagga'}
      </button>
    </div>
  `;

  document.getElementById('scan-box').addEventListener('click', (e) => {
    if (e.target.closest('#btn-torch') || e.target.closest('#btn-switch-engine')) return;
    showFocusDot(e);
    applyTapFocus(e);
  });

  document.getElementById('btn-switch-engine').addEventListener('click', async () => {
    await stopScanner();
    setScannerEngine(currentScannerEngine === 'html5qrcode' ? 'quagga' : 'html5qrcode');
    startScanner(containerId, onDetected);
  });

  document.getElementById('btn-torch').addEventListener('click', toggleTorch);

  if (currentScannerEngine === 'html5qrcode') {
    await startHtml5Qr(onDetected);
  } else {
    await startQuagga(onDetected);
  }
}

async function startHtml5Qr(onDetected) {
  if (!window.Html5Qrcode) {
    showToast('Modul html5-qrcode belum termuat', 'error');
    return;
  }
  html5QrInstance = new Html5Qrcode('scan-video-target');
  try {
    await html5QrInstance.start(
      { facingMode: 'environment' },
      { fps: 12, qrbox: { width: 240, height: 140 } },
      (decodedText) => onDetected(decodedText),
      () => {}
    );
    captureStreamTrack_(html5QrInstance);
  } catch (err) {
    showToast('Gagal membuka kamera: ' + err.message, 'error');
  }
}

function captureStreamTrack_(instance) {
  try {
    const videoEl = document.querySelector('#scan-video-target video');
    if (videoEl && videoEl.srcObject) {
      currentStreamTrack = videoEl.srcObject.getVideoTracks()[0];
    }
  } catch (e) {}
}

async function startQuagga(onDetected) {
  if (!window.Quagga) {
    showToast('Modul Quagga belum termuat', 'error');
    return;
  }
  Quagga.init({
    inputStream: {
      type: 'LiveStream',
      target: document.getElementById('scan-video-target'),
      constraints: { facingMode: 'environment' }
    },
    decoder: { readers: ['ean_reader', 'code_128_reader', 'upc_reader', 'code_39_reader'] }
  }, (err) => {
    if (err) { showToast('Gagal memulai Quagga: ' + err, 'error'); return; }
    Quagga.start();
    quaggaRunning = true;
    setTimeout(() => {
      const videoEl = document.querySelector('#scan-video-target video');
      if (videoEl && videoEl.srcObject) currentStreamTrack = videoEl.srcObject.getVideoTracks()[0];
    }, 500);
  });
  Quagga.onDetected((result) => {
    if (result && result.codeResult && result.codeResult.code) onDetected(result.codeResult.code);
  });
}

async function stopScanner() {
  if (html5QrInstance) {
    try { await html5QrInstance.stop(); await html5QrInstance.clear(); } catch (e) {}
    html5QrInstance = null;
  }
  if (quaggaRunning && window.Quagga) {
    try { Quagga.stop(); } catch (e) {}
    quaggaRunning = false;
  }
  currentStreamTrack = null;
}

async function toggleTorch() {
  if (!currentStreamTrack) { showToast('Senter tidak didukung perangkat ini', 'error'); return; }
  try {
    const capabilities = currentStreamTrack.getCapabilities ? currentStreamTrack.getCapabilities() : {};
    if (!capabilities.torch) { showToast('Senter tidak didukung kamera ini', 'error'); return; }
    const settings = currentStreamTrack.getSettings ? currentStreamTrack.getSettings() : {};
    await currentStreamTrack.applyConstraints({ advanced: [{ torch: !settings.torch }] });
  } catch (err) {
    showToast('Gagal mengaktifkan senter', 'error');
  }
}

function showFocusDot(e) {
  const dot = document.getElementById('focus-dot');
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  dot.style.left = x + 'px';
  dot.style.top = y + 'px';
  dot.classList.remove('show');
  void dot.offsetWidth;
  dot.classList.add('show');
}

async function applyTapFocus(e) {
  if (!currentStreamTrack || !currentStreamTrack.getCapabilities) return;
  try {
    const capabilities = currentStreamTrack.getCapabilities();
    if (capabilities.focusMode && capabilities.focusMode.includes('manual') && capabilities.focusDistance) {
      const rect = e.currentTarget.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const focusDistance = capabilities.focusDistance.min +
        relX * (capabilities.focusDistance.max - capabilities.focusDistance.min);
      await currentStreamTrack.applyConstraints({ advanced: [{ focusMode: 'manual', focusDistance }] });
    } else if (capabilities.focusMode && capabilities.focusMode.includes('single-shot')) {
      await currentStreamTrack.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] });
    }
  } catch (err) {
    // beberapa perangkat tidak mendukung fokus manual, abaikan diam-diam
  }
}

window.SOM_SCANNER = { startScanner, stopScanner, setScannerEngine };
