// Fake Worker for local work and tests. Loaded only with ?mock=1 (see app.js).
// Every barcode here is SYNTHETIC: these numbers are not on any real product.
// Refund cents mirror docs/RULES.md; the real answer always comes from the Worker.
;(() => {
  var NOTE = "The counter's count is the one that pays."

  var ITEMS = {
    // SYNTHETIC 5¢: a pop bottle (regular).
    '0000000000017': {
      upc: '0000000000017',
      name: 'Test Cola (SYNTHETIC)',
      brand: 'Test',
      size_ml: 750,
      accepted: true,
      verdict: 'Yes, we take this',
      depot_policy: false,
      class: 'regular',
      refund_cents: 5,
      material: 'clear-plastic',
      why: 'Pop in a plastic bottle: 5¢.',
      source: 'synthetic',
      note: NOTE,
    },
    // SYNTHETIC 10¢: wine in glass (liquor).
    '0000000000024': {
      upc: '0000000000024',
      name: 'Test Red Wine (SYNTHETIC)',
      brand: 'Test',
      size_ml: 750,
      accepted: true,
      verdict: 'Yes, we take this',
      depot_policy: false,
      class: 'liquor',
      refund_cents: 10,
      material: 'glass',
      why: 'Wine in a glass bottle: 10¢.',
      source: 'synthetic',
      note: NOTE,
    },
    // SYNTHETIC no refund: milk.
    '0000000000048': {
      upc: '0000000000048',
      name: 'Test 2% Milk (SYNTHETIC)',
      brand: 'Test',
      size_ml: 2000,
      accepted: false,
      verdict: "No, we don't take this",
      depot_policy: false,
      class: 'none',
      refund_cents: 0,
      material: 'other-plastic',
      why: "Milk has no deposit, so there's no refund.",
      source: 'synthetic',
      note: NOTE,
    },
    // SYNTHETIC brewer: a local refillable beer bottle.
    '0000000000055': {
      upc: '0000000000055',
      name: 'Test Lager refillable bottle (SYNTHETIC)',
      brand: 'Test',
      size_ml: 341,
      accepted: true,
      verdict: 'Yes, we take this',
      depot_policy: true,
      class: 'brewer',
      refund_cents: 5,
      material: 'glass',
      why: "A local brewer's refillable bottle (including Quidi Vidi Iceberg blue) is not part of the MMSB program. APCO Recycling takes it and pays 5¢; some other depots don't.",
      source: 'synthetic',
      note: NOTE,
    },
  }
  // Hook for the QA harness (c4): which SYNTHETIC numbers mean what. Never real products.
  window.RR_MOCK = {
    regular: '0000000000017',
    liquor: '0000000000024',
    unknown: '0000000000031',
    none: '0000000000048',
    brewer: '0000000000055',
    offline: '0000000000062',
  }
  // SYNTHETIC unknown: 0000000000031 (not in the list, so a 404).
  // SYNTHETIC offline: 0000000000062 pretends the network is down.

  function lookup(upc) {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (!/^\d{8}$|^\d{12}$|^\d{13}$/.test(upc)) {
          return resolve({ status: 'bad', message: "That doesn't look like a barcode number." })
        }
        if (upc === '0000000000062') return resolve({ status: 'offline' })
        var twin = upc.length === 12 ? '0' + upc : upc.length === 13 && upc[0] === '0' ? upc.slice(1) : upc
        var item = ITEMS[upc] || ITEMS[twin] // 12-digit UPC-A and 13-digit 0-padded EAN-13 are the same product, as in the Worker
        if (item) return resolve({ status: 'known', item: item })
        resolve({
          status: 'unknown',
          message: "We don't have this barcode on our list yet. Ask at the counter and they'll tell you.",
          verdict: 'Ask at the counter',
        })
      }, 60)
    })
  }

  window.ReturnRateApi = { lookup: lookup, base: 'mock', mock: true, items: ITEMS }
})()
