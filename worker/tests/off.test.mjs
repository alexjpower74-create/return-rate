// The live Open Food Facts step. Runs against `wrangler dev --port 5902 --var OFF_BASE:http://127.0.0.1:5903`
// with `node worker/tests/off-mock.mjs 5903` serving the stand-in. Each barcode below is NOT in the seed.
import { test } from 'node:test'
import assert from 'node:assert/strict'

const API = process.env.API || 'http://localhost:5902'
const MOCK = process.env.OFF_MOCK || 'http://127.0.0.1:5903'
let ipN = 0
const ip = () => `10.1.${Math.floor(Math.random() * 250)}.${++ipN % 250}`
async function call(path) {
  const res = await fetch(API + path, { headers: { 'CF-Connecting-IP': ip() } })
  return { status: res.status, body: await res.json().catch(() => null) }
}
const calls = async () => (await (await fetch(MOCK + '/calls')).json()).calls

test('pop bottle unknown to us but on OFF: answered 5¢, no photo asked for', async () => {
  const { status, body } = await call('/item/069000009109')
  assert.equal(status, 200)
  assert.equal(body.class, 'regular')
  assert.equal(body.refund_cents, 5)
  assert.equal(body.accepted, true)
  assert.match(body.name, /Pepsi/)
  assert.equal(body.source, 'openfoodfacts-live')
})

test('second lookup of the same barcode is served from our list, OFF not asked again', async () => {
  const before = await calls()
  const { body } = await call('/item/069000009109')
  assert.equal(body.refund_cents, 5)
  assert.equal(await calls(), before, 'OFF was called again')
})

test('water with no packaging data still answers 5¢: the refund does not depend on the container', async () => {
  const { status, body } = await call('/item/096619756803')
  assert.equal(status, 200)
  assert.equal(body.refund_cents, 5)
  assert.match(body.name, /Kirkland/)
})

test('milk carton: No, no refund, no photo', async () => {
  const { status, body } = await call('/item/066800003007')
  assert.equal(status, 200)
  assert.equal(body.class, 'none')
  assert.equal(body.refund_cents, 0)
  assert.equal(body.accepted, false)
  assert.match(body.why, /Milk has no deposit/)
})

test('wine with no stated bottle: we know the name but still ask for the label, never guess 10¢', async () => {
  const { status, body } = await call('/item/3760000000001')
  assert.equal(status, 404)
  assert.equal(body.label_photo, true)
  assert.match(body.name, /Red Wine/)
  assert.equal(body.accepted, null)
})

test('not a drink at all (a spread): No, without a photo', async () => {
  const { status, body } = await call('/item/3017620422003')
  assert.equal(status, 200)
  assert.equal(body.accepted, false)
  assert.equal(body.class, 'none')
  assert.match(body.why, /a drink/)
})

test('barcode OFF has never seen: the honest unknown, photo offered', async () => {
  const { status, body } = await call('/item/4000000000009')
  assert.equal(status, 404)
  assert.equal(body.label_photo, true)
  assert.equal(body.accepted, null)
})

test('negative control: OFF answering a pop can does not make a typed nonsense number valid', async () => {
  const { status } = await call('/item/12345')
  assert.equal(status, 400)
})

test('12-digit UPC-A from a phone finds the 13-digit 0-padded row on our list (481 of the seed rows are written that way)', async () => {
  // 0000000000017 is in the seed; the phone reports it as 000000000017
  const { status, body } = await call('/item/000000000017')
  assert.equal(status, 200)
  assert.equal(body.refund_cents, 5)
  assert.equal(body.upc, '0000000000017')
})

test('and the other way: a 13-digit spelling finds a row stored as 12 digits (the live OFF row for Pepsi)', async () => {
  const { status, body } = await call('/item/0069000009109')
  assert.equal(status, 200)
  assert.match(body.name, /Pepsi/)
})
