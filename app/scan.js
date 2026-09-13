// Camera + barcode reading. Exposes window.ReturnRateScan.
// Uses the browser's BarcodeDetector when it has one (Chrome, Android),
// otherwise ZXing (pinned UMD build) over getUserMedia.
// ZXing is not on cdnjs (checked 2026-09-13), so it comes from jsDelivr, pinned.
(function () {
  'use strict';

  var ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
  var FORMATS = ['ean_13', 'upc_a', 'upc_e', 'ean_8'];
  var REPEAT_MS = 2500;       // the same code within this window counts as one scan
  var stream = null, timer = null, zxReader = null, lastCode = '', lastAt = 0, active = false;

  function normalise(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (d.length === 8 || d.length === 12 || d.length === 13) return d;
    return '';
  }

  // Fires onCode(upc) once per scan, then stays quiet until start() is called again.
  function fire(raw, onCode) {
    var upc = normalise(raw);
    if (!upc) return;
    var now = Date.now();
    if (upc === lastCode && now - lastAt < REPEAT_MS) return;
    lastCode = upc; lastAt = now;
    stop();
    onCode(upc);
  }

  function loadZXing() {
    if (window.ZXing) return Promise.resolve(window.ZXing);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = ZXING_URL;
      s.onload = function () { window.ZXing ? resolve(window.ZXing) : reject(new Error('no ZXing')); };
      s.onerror = function () { reject(new Error('ZXing failed to load')); };
      document.head.appendChild(s);
    });
  }

  // Returns a promise: resolves {engine} when the camera is running,
  // rejects {reason: 'refused'|'nocamera'|'unsupported'} otherwise.
  function start(video, onCode) {
    stop();
    active = true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject({ reason: 'unsupported' });
    }
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .catch(function (err) {
        var name = err && err.name || '';
        throw { reason: (name === 'NotAllowedError' || name === 'SecurityError') ? 'refused' : 'nocamera', error: err };
      })
      .then(function (s) {
        if (!active) { s.getTracks().forEach(function (t) { t.stop(); }); return { engine: 'stopped' }; }
        stream = s;
        video.srcObject = s;
        return video.play().catch(function () {}).then(function () {
          if ('BarcodeDetector' in window) {
            var det = new window.BarcodeDetector({ formats: FORMATS });
            timer = setInterval(function () {
              if (!active || video.readyState < 2) return;
              det.detect(video).then(function (codes) {
                if (codes && codes.length) fire(codes[0].rawValue, onCode);
              }).catch(function () {});
            }, 250);
            return { engine: 'BarcodeDetector' };
          }
          return loadZXing().then(function (ZXing) {
            var hints = new Map();
            hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
              ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E, ZXing.BarcodeFormat.EAN_8
            ]);
            zxReader = new ZXing.BrowserMultiFormatReader(hints, 250);
            zxReader.decodeFromStream(s, video, function (result) {
              if (result && active) fire(result.getText(), onCode);
            });
            return { engine: 'ZXing' };
          });
        });
      });
  }

  function stop() {
    active = false;
    if (timer) { clearInterval(timer); timer = null; }
    if (zxReader) { try { zxReader.reset(); } catch (e) {} zxReader = null; }
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
  }

  window.ReturnRateScan = { start: start, stop: stop, normalise: normalise };
})();
