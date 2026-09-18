// Camera + barcode reading. Exposes window.ReturnRateScan.
// Uses the browser's BarcodeDetector when it has one (Chrome, Android); on iPhone Safari (no BarcodeDetector)
// a pinned polyfill (zxing-wasm) provides the same API. A still photo of the barcode can also be decoded.
;(() => {
  var POLYFILL_URL = 'https://cdn.jsdelivr.net/npm/barcode-detector@2.3.1/dist/iife/side-effects.min.js'
  var FORMATS = ['ean_13', 'upc_a', 'upc_e', 'ean_8']
  var REPEAT_MS = 2500 // the same code within this window counts as one scan
  var stream = null,
    timer = null,
    lastCode = '',
    lastAt = 0,
    active = false

  function normalise(raw) {
    var d = String(raw || '').replace(/\D/g, '')
    if (d.length === 8 || d.length === 12 || d.length === 13) return d
    return ''
  }

  // Fires onCode(upc) once per scan, then stays quiet until start() is called again.
  function fire(raw, onCode) {
    var upc = normalise(raw)
    if (!upc) return
    var now = Date.now()
    if (upc === lastCode && now - lastAt < REPEAT_MS) return
    lastCode = upc
    lastAt = now
    stop()
    onCode(upc)
  }

  function detector() {
    if ('BarcodeDetector' in window) return Promise.resolve(new window.BarcodeDetector({ formats: FORMATS }))
    return new Promise((resolve, reject) => {
      var s = document.createElement('script')
      s.src = POLYFILL_URL
      s.onload = () => {
        'BarcodeDetector' in window ? resolve(new window.BarcodeDetector({ formats: FORMATS })) : reject(new Error('no detector'))
      }
      s.onerror = () => {
        reject(new Error('detector failed to load'))
      }
      document.head.appendChild(s)
    })
  }

  // Decode a still photo (a file from the camera). Resolves the barcode number or ''.
  function decodeImage(file) {
    return detector()
      .then((det) =>
        createImageBitmap(file).then((bmp) => det.detect(bmp).then((codes) => (codes && codes.length ? normalise(codes[0].rawValue) : ''))),
      )
      .catch(() => '')
  }

  // Returns a promise: resolves {engine} when the camera is running,
  // rejects {reason: 'refused'|'nocamera'|'unsupported'} otherwise.
  function start(video, onCode) {
    stop()
    active = true
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject({ reason: 'unsupported' })
    }
    return navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .catch((err) => {
        var name = (err && err.name) || ''
        throw { reason: name === 'NotAllowedError' || name === 'SecurityError' ? 'refused' : 'nocamera', error: err }
      })
      .then((s) => {
        if (!active) {
          s.getTracks().forEach((t) => {
            t.stop()
          })
          return { engine: 'stopped' }
        }
        stream = s
        video.srcObject = s
        return video
          .play()
          .catch(() => {})
          .then(() =>
            detector().then((det) => {
              var native = !window.BarcodeDetector.toString().indexOf('native') ? 'BarcodeDetector' : 'BarcodeDetector'
              var busy = false
              timer = setInterval(() => {
                if (!active || busy || video.readyState < 2) return
                busy = true
                det
                  .detect(video)
                  .then((codes) => {
                    busy = false
                    if (codes && codes.length) fire(codes[0].rawValue, onCode)
                  })
                  .catch(() => {
                    busy = false
                  })
              }, 200)
              return { engine: native }
            }),
          )
      })
  }

  function stop() {
    active = false
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    if (stream) {
      stream.getTracks().forEach((t) => {
        t.stop()
      })
      stream = null
    }
  }

  window.ReturnRateScan = { start: start, stop: stop, normalise: normalise, decodeImage: decodeImage }
})()
