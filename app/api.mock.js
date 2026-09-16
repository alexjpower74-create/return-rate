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
        var item = ITEMS[upc]
        if (item) return resolve({ status: 'known', item: item })
        resolve({
          status: 'unknown',
          message: "We don't have this barcode on our list. Take a photo of the front of it and we'll tell you.",
          verdict: 'Take a photo of it',
        })
      }, 60)
    })
  }

  // The label photo, mocked: a file named *dark* can't be read; anything else is a SYNTHETIC water bottle.
  function label(file) {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (file && /sauce|tums|notdrink/i.test(file.name || ''))
          return resolve({
            status: 'known',
            item: {
              upc: null,
              name: 'Soy sauce (SYNTHETIC)',
              brand: null,
              size_ml: null,
              accepted: false,
              verdict: "No, we don't take this",
              depot_policy: false,
              class: 'none',
              refund_cents: 0,
              material: null,
              why: "Soy sauce isn't a drink. The depot only takes containers that held a beverage.",
              source: 'label',
              note: NOTE,
            },
          })
        if (file && /dark/i.test(file.name || ''))
          return resolve({
            status: 'unknown',
            message: "We couldn't make out what this is. Take another photo closer, with the front label filling the screen.",
            name: '',
            verdict: 'Try another photo',
          })
        resolve({
          status: 'known',
          item: {
            upc: null,
            name: 'Test Spring Water (SYNTHETIC)',
            brand: 'Test',
            size_ml: 500,
            accepted: true,
            verdict: 'Yes, we take this',
            depot_policy: false,
            class: 'regular',
            refund_cents: 5,
            material: 'clear-plastic',
            why: 'Water in a plastic bottle: 5¢. From the label: the label says Return for Refund.',
            source: 'label',
            note: NOTE,
          },
        })
      }, 300)
    })
  }
  window.ReturnRateApi = { lookup: lookup, label: label, base: 'mock', mock: true, items: ITEMS }
})()
