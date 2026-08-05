/**
 * Contrats rôle / modèle / effort / session — Étape 1.
 * Ne touche pas le runtime d'exécution (router, CoS).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadAllContracts,
  assertRoleIdsAreOrganizational,
  assertNoForbiddenFamilies,
  assertEffortDefaultSafe,
  validateSessionAssignment,
} from '../runtime/contracts.mjs'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const catalogs = loadAllContracts(path.join(ROOT, 'contracts'))

test('catalogues chargeables', () => {
  assert.equal(catalogs.roles.kind, 'role_catalog')
  assert.equal(catalogs.models.kind, 'model_catalog')
  assert.equal(catalogs.efforts.kind, 'effort_catalog')
  assert.equal(catalogs.sessionSchema.kind, 'session_assignment_schema')
  assert.equal(catalogs.transitional.kind, 'transitional_bindings')
})

test('managers métier initiaux presents', () => {
  const ids = new Set(catalogs.roles.roles.map((r) => r.id))
  for (const id of [
    'MGR-ENGINEERING',
    'MGR-PRODUCT-EXPERIENCE',
    'MGR-RESEARCH',
    'MGR-LEARNING-EVALUATION',
    'ROLE-HERMES',
    'ROLE-CHIEF-OF-STAFF',
  ]) {
    assert.ok(ids.has(id), `manque ${id}`)
  }
  const mnemo = catalogs.roles.roles.find((r) => r.id === 'MGR-LEARNING-EVALUATION')
  assert.equal(mnemo.name, 'Mnemosyne')
})

test('aucun id de role n est une marque modele', () => {
  const bad = assertRoleIdsAreOrganizational(catalogs.roles.roles)
  assert.deepEqual(bad, [])
  for (const r of catalogs.roles.roles) {
    assert.equal(String(r.id).startsWith('AG-'), false, r.id)
  }
})

test('ids de roles uniques et reports_to acyclique', () => {
  const roles = catalogs.roles.roles
  const ids = roles.map((r) => r.id)
  assert.equal(ids.length, new Set(ids).size)
  const byId = Object.fromEntries(roles.map((r) => [r.id, r]))
  for (const r of roles) {
    if (!r.reports_to) continue
    assert.ok(byId[r.reports_to], `${r.id} reports_to unknown ${r.reports_to}`)
  }
  // cycle check
  for (const r of roles) {
    const seen = new Set()
    let cur = r.id
    while (cur) {
      assert.equal(seen.has(cur), false, `cycle at ${cur}`)
      seen.add(cur)
      cur = byId[cur]?.reports_to
    }
  }
})

test('catalogue modeles : familles autorisees incluent grok, zero familles interdites actives', () => {
  const hits = assertNoForbiddenFamilies(catalogs.models)
  assert.deepEqual(hits, [])
  const famIds = catalogs.models.families.map((f) => f.id).sort()
  assert.ok(famIds.includes('claude'))
  assert.ok(famIds.includes('codex'))
  assert.ok(famIds.includes('kimi'))
  assert.ok(famIds.includes('grok'))
  assert.ok(famIds.includes('hy3'))
  const luna = (catalogs.models.variants || []).find((v) => v.id === 'gpt-5.6-luna')
  assert.ok(luna, 'luna = variante codex')
})

test('effort : default medium, max jamais defaut', () => {
  assert.equal(catalogs.efforts.default_effort, 'medium')
  assert.ok((catalogs.efforts.forbid_default || []).includes('max'))
  assert.equal(assertEffortDefaultSafe(catalogs.efforts), null)
  const levels = catalogs.efforts.levels.map((l) => l.id)
  assert.deepEqual(levels, ['none', 'low', 'medium', 'high', 'xhigh', 'max'])
})

test('session assignment exemple du schema est valide', () => {
  const example = catalogs.sessionSchema.example
  const r = validateSessionAssignment(example, catalogs)
  assert.equal(r.ok, true, r.errors.join('; '))
})

test('session assignment rejette famille interdite et AG- legacy', () => {
  const base = { ...catalogs.sessionSchema.example }
  const banned = (catalogs.models.forbidden_families || [])[0]
  assert.ok(banned, 'forbidden_families doit etre non vide')
  const badModel = {
    ...base,
    model: { family: banned, variant: 'x', provider: 'blocked' },
  }
  const r1 = validateSessionAssignment(badModel, catalogs)
  assert.equal(r1.ok, false)
  assert.ok(r1.errors.some((e) => /forbidden|unknown model/i.test(e)))

  const badRole = {
    ...base,
    agent_role_id: 'AG-CODEX',
    manager_id: 'MGR-ENGINEERING',
  }
  const r2 = validateSessionAssignment(badRole, catalogs)
  assert.equal(r2.ok, false)
  assert.ok(r2.errors.some((e) => /AG-|unknown agent/i.test(e)))
})

test('session assignment rejette agent sous le mauvais manager', () => {
  const bad = {
    ...catalogs.sessionSchema.example,
    manager_id: 'MGR-RESEARCH',
    agent_role_id: 'AGENT-FRONTEND-ENGINEER',
  }
  const r = validateSessionAssignment(bad, catalogs)
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => /reports_to/i.test(e)))
})

test('bindings transitoires couvrent les AG-* legacy sans figer Luna comme role', () => {
  const b = catalogs.transitional.bindings
  const byLegacy = Object.fromEntries(b.map((x) => [x.legacy_agent_id, x]))
  for (const id of ['AG-HERMES', 'AG-CODEX', 'AG-CLAUDE', 'AG-KIMI', 'AG-LUNA']) {
    assert.ok(byLegacy[id], id)
  }
  assert.equal(byLegacy['AG-LUNA'].maps_role_to, null)
  assert.equal(byLegacy['AG-LUNA'].default_model_variant, 'gpt-5.6-luna')
  assert.equal(byLegacy['AG-CODEX'].maps_role_to, 'MGR-ENGINEERING')
  assert.equal(byLegacy['AG-CODEX'].default_model_variant, 'gpt-5.6-luna')
  assert.equal(byLegacy['AG-KIMI'].default_model_variant, 'k3')
  assert.equal(catalogs.transitional.chief_of_staff.role_id, 'ROLE-CHIEF-OF-STAFF')
  assert.equal(catalogs.transitional.chief_of_staff.legacy_agent_id, null)
})

test('runtime execution paths non modifies par les contrats (smoke import)', async () => {
  // Garantit que charger les contrats n'exige pas de changer selectAgent.
  const { selectAgent, requiredStrengths } = await import('../runtime/router.mjs')
  assert.equal(typeof selectAgent, 'function')
  assert.ok(Array.isArray(requiredStrengths({ type: 'control', domain: 'frontend' })))
})
