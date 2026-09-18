// Talks to the Worker (docs/API.md). Exposes window.ReturnRateApi.
// api.mock.js (loaded with ?mock=1) replaces window.ReturnRateApi with a fake.
;(() => {
  var meta = document.querySelector('meta[name="api-base"]')
  var base = (meta?.content || '').replace(/\/+$/, '')

  var UNKNOWN_TEXT = "We don't have this barcode on our list. Ask at the counter and they'll tell you."

  // Result shape: { status: 'known'|'unknown'|'offline'|'busy'|'bad', item?, message? }
  function lookup(upc) {
    if (!/^\d{8}$|^\d{12}$|^\d{13}$/.test(upc)) {
      return Promise.resolve({ status: 'bad', message: "That doesn't look like a barcode number." })
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return Promise.resolve({ status: 'offline' })
    }
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null
    var timer = ctrl
      ? setTimeout(() => {
          ctrl.abort()
        }, 8000)
      : null
    return fetch(base + '/item/' + upc, { signal: ctrl ? ctrl.signal : undefined })
      .then((res) =>
        res
          .json()
          .catch(() => ({}))
          .then((body) => {
            if (res.status === 200 && body && body.class) return { status: 'known', item: body }
            if (res.status === 404)
              return { status: 'unknown', message: body.error || UNKNOWN_TEXT, name: body.name || '', verdict: body.verdict || '' }
            if (res.status === 429) return { status: 'busy', message: body.error || 'Too many scans in a row, give it a minute.' }
            if (res.status === 400) return { status: 'bad', message: body.error || "That doesn't look like a barcode number." }
            return { status: 'offline', message: 'The checker is having trouble. Try again in a minute, or ask at the counter.' }
          }),
      )
      .catch(() => ({ status: 'offline' }))
      .finally(() => {
        if (timer) clearTimeout(timer)
      })
  }

  window.ReturnRateApi = { lookup: lookup, base: base, UNKNOWN_TEXT: UNKNOWN_TEXT }
})()
