#!/usr/bin/env node
// A stand-in for the Worker that serves data/products.json per docs/API.md, so the
// eval runner can be exercised (and its negative control shown) without wrangler or D1.
// It is NOT the Worker: it does not log lookups, rate-limit, or take POSTs.
//   node evals/mock-api.mjs [--port 5912] [--products data/products.json]
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opt = (n, d) => {
  const i = args.indexOf(n)
  return i >= 0 ? args[i + 1] : d
}
const port = Number(opt('--port', 5912))
const rows = JSON.parse(fs.readFileSync(path.resolve(opt('--products', path.join(HERE, '../data/products.json'))), 'utf8'))
const byUpc = new Map(rows.map((r) => [r.upc, r]))
const NOTE = "The counter's count is the one that pays."

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' })
  res.end(JSON.stringify(body))
}
http
  .createServer((req, res) => {
    const m = req.url.match(/^\/item\/([^/?]+)/)
    if (req.url === '/health') return send(res, 200, { ok: true, items: rows.length })
    if (!m) return send(res, 404, { error: 'Not found.' })
    const upc = decodeURIComponent(m[1])
    if (!/^(\d{8}|\d{12}|\d{13})$/.test(upc)) return send(res, 400, { error: "That doesn't look like a barcode number." })
    const r = byUpc.get(upc)
    if (!r) return send(res, 404, { error: "We don't know this one yet. Show it at the counter and we'll add it.", upc })
    send(res, 200, {
      upc: r.upc,
      name: r.name,
      brand: r.brand,
      size_ml: r.size_ml,
      class: r.class,
      refund_cents: r.refund_cents,
      material: r.material,
      why: '(mock)',
      source: r.source,
      note: NOTE,
    })
  })
  .listen(port, '127.0.0.1', () => console.log(`mock api on http://127.0.0.1:${port} with ${rows.length} items`))
