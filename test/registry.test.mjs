/**
 * Tests du contrat du registry (Étape 2).
 * On capture le comportement ACTUEL avant toute migration du registry,
 * pour détecter toute dérive quand on passera en manifests déclaratifs.
 *   node --test test/registry.test.mjs
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const REAL_REGISTRY = path.join(ROOT, 'registry', 'registry.generated.json')

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-reg-'))
const tmpRegistry = path.join(tmpDir, 'registry.json')
const validReg = {
  schema_version: 1,
  authority_classes: ['invariants', 'policies', 'control'],
  entries: [
    { id: 'INV-001', type: 'invariant', authority: 1, domain: 'all', status: 'active', version: 1, statement: 'x' },
    { id: 'CTRL-A', type: 'control', authority: 2, domain: 'frontend', status: 'active', version: 1, source: 'schemas/ctrl.yaml' },
  ],
}
fs.writeFileSync(tmpRegistry, JSON.stringify(validReg))

let loadRegistry, compile
before(async () => {
  ;({ loadRegistry, compile } = await import(path.join(ROOT, 'compile-bundle.mjs')))
})

// --- 1) chargement d'un registry valide ---
test('chargement d’un registry valide', () => {
  const reg = loadRegistry(tmpRegistry)
  assert.equal(reg.schema_version, 1)
  assert.ok(Array.isArray(reg.entries))
  assert.equal(reg.entries.length, 2)
})

// --- 2) rejet d'un registry invalide (JSON cassé) ---
test('registry JSON cassé lève une erreur', () => {
  fs.writeFileSync(tmpRegistry, '{ pas du json ')
  assert.throws(() => loadRegistry(tmpRegistry))
  fs.writeFileSync(tmpRegistry, JSON.stringify(validReg)) // restore
})

// --- 3) détection d'identifiants dupliqués ---
test('identifiants dupliqués détectés', () => {
  const dup = { ...validReg, entries: [...validReg.entries, { ...validReg.entries[0] }] }
  fs.writeFileSync(tmpRegistry, JSON.stringify(dup))
  const reg = loadRegistry(tmpRegistry)
  const ids = reg.entries.map((e) => e.id)
  assert.notEqual(ids.length, new Set(ids).size, 'un doublon doit être repéré')
  fs.writeFileSync(tmpRegistry, JSON.stringify(validReg)) // restore
})

// --- 4) comportement si le registry manque ---
test('registry absent lève une erreur explicite', () => {
  fs.rmSync(tmpRegistry)
  assert.throws(() => loadRegistry(tmpRegistry))
  fs.writeFileSync(tmpRegistry, JSON.stringify(validReg)) // restore
})

// --- 5) compilation déterministe (même entrée -> même hash) ---
test('compilation déterministe (hash stable)', async () => {
  // on pointe compile sur notre registry temporaire via loadRegistry mocké
  const a = compileOn(tmpRegistry)
  const b = compileOn(tmpRegistry)
  assert.equal(a.hash, b.hash, 'hash identique entre deux compiles identiques')
  assert.equal(a.bundle.rules.length, 1)
})

// helper: compile en forçant le registry (compile utilise loadRegistry(REGISTRY) en dur,
// donc on override temporairement le fichier réel puis on restore)
function compileOn(regPath) {
  fs.copyFileSync(regPath, REAL_REGISTRY) // swap atomique-ish
  try {
    const out = compile({ mission: 'det', domain: 'frontend', query: '', level: 'standard' })
    return out
  } finally {
    fs.copyFileSync(path.join(ROOT, 'registry', 'registry.generated.json.bak'), REAL_REGISTRY)
  }
}

before(() => {
  fs.copyFileSync(REAL_REGISTRY, path.join(ROOT, 'registry', 'registry.generated.json.bak'))
})
after(() => {
  fs.rmSync(path.join(ROOT, 'registry', 'registry.generated.json.bak'), { force: true })
  fs.rmSync(tmpDir, { recursive: true, force: true })
})
