// Talks to the Worker (docs/API.md). Exposes window.ReturnRateApi.
// api.mock.js (loaded with ?mock=1) replaces window.ReturnRateApi with a fake.
(function () {
  'use strict';

  var meta = document.querySelector('meta[name="api-base"]');
  var base = (meta && meta.content || '').replace(/\/+$/, '');

  var UNKNOWN_TEXT = "We don't have this one on our list yet. Look on the label for the words Return for Refund. If they're there and you bought it in Newfoundland and Labrador, we take it: 5¢, or 10¢ for wine and spirits in a glass or plastic bottle. If they're not there, there's no refund.";

  // Result shape: { status: 'known'|'unknown'|'offline'|'busy'|'bad', item?, message? }
  function lookup(upc) {
    if (!/^\d{8}$|^\d{12}$|^\d{13}$/.test(upc)) {
      return Promise.resolve({ status: 'bad', message: "That doesn't look like a barcode number." });
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return Promise.resolve({ status: 'offline' });
    }
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 8000) : null;
    return fetch(base + '/item/' + upc, { signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (res.status === 200 && body && body.class) return { status: 'known', item: body };
          if (res.status === 404) return { status: 'unknown', message: body.error || UNKNOWN_TEXT, name: body.name || '' };
          if (res.status === 429) return { status: 'busy', message: body.error || 'Too many scans in a row, give it a minute.' };
          if (res.status === 400) return { status: 'bad', message: body.error || "That doesn't look like a barcode number." };
          return { status: 'offline', message: 'The checker is having trouble. Try again in a minute, or ask at the counter.' };
        });
      })
      .catch(function () {
        return { status: 'offline' };
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  window.ReturnRateApi = { lookup: lookup, base: base, UNKNOWN_TEXT: UNKNOWN_TEXT };
})();
