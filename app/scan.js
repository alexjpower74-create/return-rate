// Camera + barcode reading. Exposes window.ReturnRateScan.
// Uses the browser's BarcodeDetector when it has one (Chrome, Android); on iPhone Safari (no BarcodeDetector)
// a pinned polyfill (zxing-wasm) provides the same API. A still photo of the barcode can also be decoded.
//
// 2026-09-18 rework (the live scanner "didn't work that well"):
//  - ask the camera for its full resolution and continuous focus; a 640x480 default feed cannot resolve a can barcode
//  - decode a centre crop at native pixels (the detector downsamples a full frame), full frame every few passes
//  - the same code must be read twice in a row before we answer, so a single misread never shows a wrong refund
//  - torch on phones that have one; still photos also get upscaled centre-crop and contrast-stretched retries
;(() => {
  var POLYFILL_URL = 'https://cdn.jsdelivr.net/npm/barcode-detector@2.3.1/dist/iife/side-effects.min.js'
  var FORMATS = ['ean_13', 'upc_a', 'upc_e', 'ean_8']
  var REPEAT_MS = 2500 // the same code within this window counts as one scan
  var CONFIRM_MS = 1500 // two reads of the same code inside this window = confirmed
  var stream = null,
    track = null,
    timer = null,
    lastCode = '',
    lastAt = 0,
    active = false,
    canvas = null

  function normalise(raw) {
    var d = String(raw || '').replace(/\D/g, '')
    if (d.length === 8 || d.length === 12 || d.length === 13) return d
    return ''
  }

  // EAN/UPC check digit. The detectors validate it already; this guards the typed path and any odd polyfill build.
  function checksumOk(d) {
    var sum = 0,
      i,
      w
    for (i = 0; i < d.length - 1; i++) {
      w = (d.length - 1 - i) % 2 === 0 ? 1 : 3 // weights 3,1,3,1... from the right, excluding the check digit
      sum += Number(d[i]) * w
    }
    return (10 - (sum % 10)) % 10 === Number(d[d.length - 1])
  }

  // Fires onCode(upc) once per scan, then stays quiet until start() is called again.
  var pending = '',
    pendingAt = 0
  function fire(raw, onCode) {
    var upc = normalise(raw)
    if (!upc) return
    if (upc.length !== 8 && !checksumOk(upc)) return // UPC-E is compressed; leave its check to the detector
    var now = Date.now()
    if (upc === lastCode && now - lastAt < REPEAT_MS) return
    if (!(upc === pending && now - pendingAt < CONFIRM_MS)) {
      pending = upc
      pendingAt = now
      return // first sighting: wait for a second matching read
    }
    pending = ''
    lastCode = upc
    lastAt = now
    stop()
    onCode(upc)
  }

  var detPromise = null
  function detector() {
    if (detPromise) return detPromise
    if ('BarcodeDetector' in window) {
      detPromise = Promise.resolve(new window.BarcodeDetector({ formats: FORMATS }))
      return detPromise
    }
    detPromise = new Promise((resolve, reject) => {
      var s = document.createElement('script')
      s.src = POLYFILL_URL
      s.onload = () => {
        'BarcodeDetector' in window ? resolve(new window.BarcodeDetector({ formats: FORMATS })) : reject(new Error('no detector'))
      }
      s.onerror = () => {
        detPromise = null
        reject(new Error('detector failed to load'))
      }
      document.head.appendChild(s)
    })
    return detPromise
  }

  function ctx() {
    if (!canvas) canvas = document.createElement('canvas')
    return canvas.getContext('2d', { willReadFrequently: true })
  }

  // Draw a region of a video/bitmap into the work canvas at `scale` x its native pixels.
  function crop(src, sw, sh, fx, fy, fw, fh, scale) {
    var x = Math.round(sw * fx),
      y = Math.round(sh * fy),
      w = Math.round(sw * fw),
      h = Math.round(sh * fh)
    var c = ctx()
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    c.imageSmoothingEnabled = scale > 1
    c.imageSmoothingQuality = 'high'
    c.drawImage(src, x, y, w, h, 0, 0, canvas.width, canvas.height)
    return canvas
  }

  // Stretch the work canvas's contrast so a grey barcode on a dark label reads like black on white.
  function stretch() {
    var c = ctx()
    var img = c.getImageData(0, 0, canvas.width, canvas.height)
    var d = img.data,
      lo = 255,
      hi = 0,
      i,
      v
    for (i = 0; i < d.length; i += 16) {
      v = d[i]
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    if (hi - lo < 8 || (lo === 0 && hi === 255)) return canvas
    var k = 255 / (hi - lo)
    for (i = 0; i < d.length; i += 4) {
      v = (d[i] - lo) * k
      d[i] = d[i + 1] = d[i + 2] = v < 0 ? 0 : v > 255 ? 255 : v
    }
    c.putImageData(img, 0, 0)
    return canvas
  }

  function firstCode(codes) {
    return codes?.length ? codes[0].rawValue : ''
  }

  // Decode a still photo (a file from the camera). Resolves the barcode number or ''.
  // Passes: the whole photo, then the centre 60% at 2x (small barcode far away), then the centre 35% at 3x.
  function decodeImage(file) {
    return detector()
      .then((det) =>
        createImageBitmap(file).then((bmp) => {
          var w = bmp.width,
            h = bmp.height
          var passes = [
            () => det.detect(bmp),
            () => det.detect(crop(bmp, w, h, 0.2, 0.2, 0.6, 0.6, 2)),
            () => det.detect(crop(bmp, w, h, 0.325, 0.325, 0.35, 0.35, 3)),
            () => det.detect((crop(bmp, w, h, 0, 0, 1, 1, 1), stretch())),
            () => det.detect((crop(bmp, w, h, 0.2, 0.2, 0.6, 0.6, 2), stretch())),
          ]
          var i = 0
          function next() {
            if (i >= passes.length) return ''
            return passes[i++]().then((codes) => normalise(firstCode(codes)) || next(), next)
          }
          return next()
        }),
      )
      .catch(() => '')
  }

  function applyFocus(t) {
    var caps, adv
    try {
      caps = t.getCapabilities ? t.getCapabilities() : {}
      adv = []
      if (caps.focusMode && caps.focusMode.indexOf('continuous') >= 0) adv.push({ focusMode: 'continuous' })
      if (adv.length) return t.applyConstraints({ advanced: adv }).catch(() => {})
    } catch (_e) {}
    return Promise.resolve()
  }

  function hasTorch() {
    try {
      return !!track?.getCapabilities?.().torch
    } catch (_e) {
      return false
    }
  }
  var torchOn = false
  function torch(on) {
    torchOn = !!on
    if (!hasTorch()) return Promise.resolve(false)
    return track
      .applyConstraints({ advanced: [{ torch: torchOn }] })
      .then(() => torchOn)
      .catch(() => false)
  }

  // Returns a promise: resolves {engine} when the camera is running,
  // rejects {reason: 'refused'|'nocamera'|'unsupported'} otherwise.
  function start(video, onCode, opts) {
    stop()
    active = true
    pending = ''
    if (!navigator.mediaDevices?.getUserMedia) {
      return Promise.reject({ reason: 'unsupported' })
    }
    var constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    }
    return navigator.mediaDevices
      .getUserMedia(constraints)
      .catch((err) => {
        var name = err?.name || ''
        if (name === 'OverconstrainedError')
          return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        throw err
      })
      .catch((err) => {
        var name = err?.name || ''
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
        track = s.getVideoTracks()[0] || null
        video.srcObject = s
        return video
          .play()
          .catch(() => {})
          .then(() => (track ? applyFocus(track) : null))
          .then(() => detector())
          .then((det) => {
            if (opts?.onReady) {
              try {
                opts.onReady({ torch: hasTorch() })
              } catch (_e) {}
            }
            var pass = 0
            function loop() {
              if (!active) return
              if (video.readyState < 2 || !video.videoWidth) {
                timer = setTimeout(loop, 100)
                return
              }
              var vw = video.videoWidth,
                vh = video.videoHeight
              pass++
              // Every 4th pass the whole frame (barcode held off-centre); otherwise the centre 70% x 70% at native pixels,
              // which is where the guide draws the eye and where the lens is sharpest.
              var src = pass % 4 === 0 ? video : crop(video, vw, vh, 0.15, 0.15, 0.7, 0.7, 1)
              if (pass % 4 === 2) stretch() // every other centre pass with the contrast stretched (dark cans, grey labels)
              det
                .detect(src)
                .then((codes) => {
                  if (codes?.length) fire(codes[0].rawValue, onCode)
                })
                .catch(() => {})
                .then(() => {
                  if (active) timer = setTimeout(loop, 60)
                })
            }
            loop()
            return { engine: 'BarcodeDetector', width: vw(), height: vh() }
            function vw() {
              return video.videoWidth
            }
            function vh() {
              return video.videoHeight
            }
          })
      })
  }

  function stop() {
    active = false
    pending = ''
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (stream) {
      stream.getTracks().forEach((t) => {
        t.stop()
      })
      stream = null
      track = null
    }
    torchOn = false
  }

  window.ReturnRateScan = {
    start: start,
    stop: stop,
    normalise: normalise,
    decodeImage: decodeImage,
    torch: torch,
    hasTorch: hasTorch,
    checksumOk: checksumOk,
  }
})()
