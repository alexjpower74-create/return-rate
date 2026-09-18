// A stand-in Open Food Facts for the Worker tests: `node worker/tests/off-mock.mjs 5903`.
// Real-shaped answers for a few barcodes, 404 for the rest, and /calls reports how many lookups it served.
import http from 'node:http'
const PRODUCTS = {
  // Pepsi 591 mL, plastic bottle: pop → 5¢ even though the material is a bottle
  '069000009109': {
    code: '069000009109',
    product_name: 'Pepsi',
    brands: 'Pepsi',
    quantity: '591 ml',
    categories_tags: ['en:beverages', 'en:carbonated-drinks', 'en:sodas', 'en:colas'],
    packaging_materials_tags: ['en:plastic'],
  },
  // Kirkland water, no packaging data at all: water → 5¢, material unknown is fine
  '096619756803': {
    code: '096619756803',
    product_name: 'Kirkland Signature Purified Water',
    brands: 'Kirkland Signature',
    quantity: '500 mL',
    categories_tags: ['en:beverages', 'en:waters'],
  },
  // Neilson 2% milk carton: milk → no refund, no photo needed
  '066800003007': {
    code: '066800003007',
    product_name: 'Neilson 2% Partly Skimmed Milk',
    brands: 'Neilson',
    quantity: '2 L',
    categories_tags: ['en:dairies', 'en:milks'],
    packaging_tags: ['en:carton'],
  },
  // Red wine, packaging unknown: liquor needs the material → not enough, ask for a photo
  3760000000001: {
    code: '3760000000001',
    product_name: 'Some Red Wine',
    brands: 'Cave',
    quantity: '750 ml',
    categories_tags: ['en:alcoholic-beverages', 'en:wines'],
  },
  // Nutella: not a drink at all
  3017620422003: {
    code: '3017620422003',
    product_name: 'Nutella',
    brands: 'Ferrero',
    quantity: '400 g',
    categories_tags: ['en:spreads', 'en:sweet-spreads'],
  },
}
let calls = 0
http
  .createServer((req, res) => {
    if (req.url === '/calls') return res.end(JSON.stringify({ calls }))
    const m = req.url.match(/\/api\/v2\/product\/(\d+)\.json/)
    if (!m) return (res.statusCode = 404), res.end('{}')
    calls++
    const code = m[1].length === 13 && m[1][0] === '0' ? m[1].slice(1) : m[1] // OFF treats 0-padded UPC-A as the same code
    const p = PRODUCTS[code] || PRODUCTS[m[1]]
    res.setHeader('content-type', 'application/json')
    if (!p) return (res.statusCode = 404), res.end(JSON.stringify({ status: 0, status_verbose: 'product not found' }))
    res.end(JSON.stringify({ status: 1, product: p }))
  })
  .listen(Number(process.argv[2] || 5903), () => console.log('off-mock on', process.argv[2] || 5903))
