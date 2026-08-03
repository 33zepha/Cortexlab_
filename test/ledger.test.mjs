/**
 * Tests du ledger (event-store) — socle d'observabilite.
 *   node --test test/ledger.test.mjs
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-ledger-'))

let EventStore, readEvents, verifyChain
before(async () => {
  ;({ EventStore, readEvents, verifyChain } = await import(
    path.resolve('runtime/event-store.mjs')
  ))
})

test('emit ecrit des lignes NDJSON chainees', () => {
  const f = path.join(tmp, 'a.ndjson')
  const s = new EventStore(f)
  s.emit('mission.start', { mission: 'm1' })
  s.emit('check.run', { rule: 'CTRL-X', matched: false })
  s.emit('mission.closure', { closure: 'LIVRAISON_AUTONOME' })
  s.close()
  const evs = readEvents(f)
  assert.equal(evs.length, 3)
  // chaque event a ts/type/data/hash/prev
  for (const e of evs) {
    assert.ok(e.ts && e.type && e.hash)
  }
  // chainage: le 2e connait le hash du 1er
  assert.equal(evs[1].prev, evs[0].hash)
  assert.equal(evs[2].prev, evs[1].hash)
})

test('verifyChain valide une chaine intacte', () => {
  const f = path.join(tmp, 'b.ndjson')
  const s = new EventStore(f)
  s.emit('x', {})
  s.emit('y', {})
  s.close()
  assert.equal(verifyChain(readEvents(f)), true)
})

test('verifyChain detecte une alteration', () => {
  const f = path.join(tmp, 'c.ndjson')
  const s = new EventStore(f)
  s.emit('x', { val: 1 })
  s.emit('y', { val: 2 })
  s.close()
  const evs = readEvents(f)
  evs[0].data.val = 999 // on truque une ligne
  assert.equal(verifyChain(evs), false)
})

test('EventStore prolonge la chaine si le fichier existe', () => {
  const f = path.join(tmp, 'd.ndjson')
  const s1 = new EventStore(f)
  s1.emit('x', {})
  s1.close()
  const s2 = new EventStore(f) // reprend le hash precedent
  s2.emit('y', {})
  s2.close()
  const evs = readEvents(f)
  assert.equal(evs.length, 2)
  assert.equal(evs[1].prev, evs[0].hash)
  assert.equal(verifyChain(evs), true)
})

after(() => fs.rmSync(tmp, { recursive: true, force: true }))
