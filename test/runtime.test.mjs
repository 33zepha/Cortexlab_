/**
 * Tests du runtime Cortex (Chief of Staff).
 * node --test test/runtime.test.mjs
 */
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const BUNDLES = path.join(ROOT, 'bundles')
const FIX = path.join(ROOT, 'test/fixtures')

// Compiler un bundle frontal avant les tests (chemin réel: compile-bundle.mjs)
let bundlePath
before(() => {
  execFileSync('node', ['compile-bundle.mjs', '--mission', 'test-runtime', '--domain', 'frontend', '--query', 'runtime-test'], {
    cwd: ROOT,
    stdio: 'pipe',
  })
  // trouver le bundle généré
  const f = fs.readdirSync(BUNDLES).find((x) => x.startsWith('test-runtime'))
  assert.ok(f, 'bundle de test non généré')
  bundlePath = path.join(BUNDLES, f)
})

test('bundle porte le check grep réel (compilateur réparé)', () => {
  const b = JSON.parse(fs.readFileSync(bundlePath, 'utf8'))
  const rule = b.rules.find((r) => r.id === 'CTRL-NO-LABEL-UPPERCASE')
  assert.ok(rule, 'règle CTRL-NO-LABEL-UPPERCASE présente')
  assert.equal(rule.check?.type, 'grep', 'check type grep')
  assert.ok(rule.check?.pattern?.includes('uppercase'), 'pattern uppercase présent')
  assert.notEqual(rule.statement, '>', 'statement n’est plus le littéral ">"')
})

test('violation anti-slop détectée => ESCALADE_HUMAINE + exit 3', async () => {
  const { runMission } = await import('../runtime/chief-of-staff.mjs')
  const rep = await runMission({ bundlePath, target: path.join(FIX, 'violation') })
  assert.equal(rep.closure, 'ESCALADE_HUMAINE')
  const v = rep.controls.find((c) => c.id === 'CTRL-NO-LABEL-UPPERCASE')
  assert.equal(v.violation, true, 'violation signalée')
  // le grep cible la syntaxe CSS `text-transform: uppercase` (camelCase JS
  // `textTransform` hors périmètre du check) -> au moins 1 occurrence (css)
  assert.ok(v.findings.length >= 1, 'au moins 1 occurrence css détectée')
  assert.equal(v.findings[0].file, 'src/sloppy.css', 'fichier fautif identifié')
})

test('workspace propre => LIVRAISON_AUTONOME (aucune violation)', async () => {
  const { runMission } = await import('../runtime/chief-of-staff.mjs')
  const rep = await runMission({ bundlePath, target: path.join(FIX, 'clean') })
  assert.equal(rep.closure, 'LIVRAISON_AUTONOME', 'closure autonome')
  assert.equal(rep.escalations.length, 0, 'aucune escalade')
  const v = rep.controls.find((c) => c.id === 'CTRL-NO-LABEL-UPPERCASE')
  assert.equal(v.violation, false)
})

test('dépassement budget => ESCALADE_HUMAINE', async () => {
  const { runMission } = await import('../runtime/chief-of-staff.mjs')
  const rep = await runMission({
    bundlePath,
    target: path.join(FIX, 'clean'),
    budget: { maxExplorations: 0 }, // 1 exploration prévue -> dépasse
  })
  assert.equal(rep.closure, 'ESCALADE_HUMAINE')
  assert.ok(rep.escalations.some((e) => e.includes('BUDGET')), 'raison budget présente')
})
