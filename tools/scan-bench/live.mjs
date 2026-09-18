// Live-camera gate: Chromium is given a fake camera that plays a video of a barcode (or of nothing), the real app
// runs with the mock API, and we assert the scanning loop reaches the answer screen with the right number.
// Chromium on Linux has no native BarcodeDetector, so this is the iPhone-Safari (polyfill) path.
import { chromium } from '@playwright/test'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
const S = path.dirname(fileURLToPath(import.meta.url))
const APP = path.join(S, '..', '..', 'app')
const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' }
const srv = http.createServer((q, r) => {
  const rel = q.url.split('?')[0]
  const f = [S, APP].map((d) => path.join(d, rel === '/' ? 'index.html' : rel)).find((p) => fs.existsSync(p))
  if (!f) { r.statusCode = 404; return r.end() }
  r.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f))
}).listen(5992)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-live-'))
const UPC = '0000000000017' // pop can in the mock API
const br0 = await chromium.launch(); const pg0 = await br0.newPage(); await pg0.goto('http://127.0.0.1:5992/bench.html')
// Write a Y4M (raw YUV 4:2:0) clip straight from the rendered pixels: no codec, nothing to decode.
async function frame(name, opts) {
  const W = 1280, H = 960
  const b64 = await pg0.evaluate(async ([d, o, W, H]) => {
    const b = await render(d, { ...o, bg: '#d8d3c8' })
    const bmp = await createImageBitmap(b)
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const x = c.getContext('2d'); x.drawImage(bmp, 0, 0)
    const px = x.getImageData(0, 0, W, H).data
    let out = ''
    for (let i = 0; i < px.length; i += 0x8000) out += String.fromCharCode.apply(null, px.subarray(i, i + 0x8000))
    return btoa(out)
  }, [UPC, opts, W, H])
  const rgba = Buffer.from(b64, 'base64')
  const Y = Buffer.alloc(W * H), U = Buffer.alloc((W * H) / 4), V = Buffer.alloc((W * H) / 4)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, r = rgba[i], g = rgba[i + 1], b = rgba[i + 2]
    Y[y * W + x] = Math.round(0.257 * r + 0.504 * g + 0.098 * b + 16)
    if (y % 2 === 0 && x % 2 === 0) {
      const j = (y / 2) * (W / 2) + x / 2
      U[j] = Math.round(-0.148 * r - 0.291 * g + 0.439 * b + 128)
      V[j] = Math.round(0.439 * r - 0.368 * g - 0.071 * b + 128)
    }
  }
  const y4m = path.join(tmp, name + '.y4m')
  const fd = fs.openSync(y4m, 'w')
  fs.writeSync(fd, `YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`)
  for (let f = 0; f < 20; f++) { fs.writeSync(fd, 'FRAME\n'); fs.writeSync(fd, Y); fs.writeSync(fd, U); fs.writeSync(fd, V) }
  fs.closeSync(fd)
  return y4m
}
const good = await frame('good', { module: 1.6, height: 70 })
const none = await frame('none', { module: 0.4, height: 6, dx: 9999 }) // barcode pushed off-frame: a plain wall
await br0.close()

async function run(y4m) {
  const br = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`] })
  const ctx = await br.newContext({ permissions: ['camera'] }); const pg = await ctx.newPage()
  await pg.goto('http://127.0.0.1:5992/index.html?mock=1')
  let screen = 'start', upc = ''
  const t0 = Date.now()
  while (Date.now() - t0 < 12000) {
    screen = await pg.evaluate(() => document.body.dataset.screen)
    if (screen === 'answer') { upc = await pg.evaluate(() => document.getElementById('upc').value); break }
    await pg.waitForTimeout(150)
  }
  const ms = Date.now() - t0
  await br.close()
  return { screen, upc, ms }
}
const a = await run(good), b = await run(none)
srv.close()
console.log('barcode video  →', a)
console.log('blank video    →', b)
const pass = a.screen === 'answer' && (a.upc === UPC || '0' + a.upc === UPC) && b.screen === 'start' // the phone reports UPC-A as 12 digits
console.log(pass ? 'LIVE GATE PASS' : 'LIVE GATE FAIL')
process.exit(pass ? 0 : 1)
