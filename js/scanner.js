let currentEngine = 'HTML5'; // Default Engine
let html5QrScanner = null;

function initScanner(engineType, elementId, onScanSuccess) {
  currentEngine = engineType;
  
  if (currentEngine === 'HTML5') {
    if (typeof Html5Qrcode === 'undefined') {
      alert("Library HTML5-QRCode belum dimuat.");
      return;
    }
    
    if (html5QrScanner) html5QrScanner.clear();
    
    html5QrScanner = new Html5Qrcode(elementId);
    html5QrScanner.start(
      { facingMode: "environment" },
      { fps: 15, qrbox: { width: 250, height: 150 } },
      (decodedText) => {
        triggerVibration();
        onScanSuccess(decodedText);
      },
      (errorMessage) => { /* scanning failures */ }
    ).catch(err => console.error("Error starting HTML5 Scanner", err));

  } else if (currentEngine === 'Quagga') {
    if (typeof Quagga === 'undefined') {
      alert("Library QuaggaJS belum dimuat.");
      return;
    }
    
    Quagga.init({
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: document.querySelector(`#${elementId}`),
        constraints: { facingMode: "environment" }
      },
      decoder: {
        readers: ["code_128_reader", "ean_reader", "upc_reader", "code_39_reader"]
      }
    }, function(err) {
      if (err) {
        console.error("Quagga Init Error:", err);
        return;
      }
      Quagga.start();
    });

    Quagga.onDetected((result) => {
      const code = result.codeResult.code;
      triggerVibration();
      onScanSuccess(code);
    });
  }
}

function stopScanner() {
  if (html5QrScanner) {
    html5QrScanner.stop().then(() => html5QrScanner.clear()).catch(() => {});
  }
  if (typeof Quagga !== 'undefined') {
    Quagga.stop();
  }
}

function triggerVibration() {
  if (navigator.vibrate) {
    navigator.vibrate(100);
  }
}
