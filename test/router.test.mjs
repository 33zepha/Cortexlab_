/**
 * Tests du routeur de délégation (INV-001 + INV-011).
 * node --test test/router.test.mjs
 *
 * Fixture locale (pas le registre) : absence d'Antigravity.
 *
 * TEMPORARY MODEL BINDING — les assertions de titulaire précis (ui→Claude,
 * engineering→Codex, …) décrivent le binding TRANSITOIRE post-remove-antigravity.
 * Elles seront remplacées par feat/role-model-separation (rôle ≠ modèle ≠ effort).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selectAgent, requiredStrengths, DELEGATION_UNIT } from '../runtime/router.mjs'

const AGENTS = [
  { id: 'AG-HERMES', type: 'agent', tier: 'ceo', name: 'Hermes', status: 'active', strengths: ['orchestration'], cost_index: 0.4, quality_index: 0.9 },
  {
    id: 'AG-CLAUDE', type: 'agent', tier: 'manager', name: 'Claude', status: 'active',
    strengths: ['raisonnement', 'conformite', 'analyse', 'critique', 'conseil', 'analyse-ux', 'critique-ux', 'specification-ui', 'direction-produit', 'revue-visuelle'],
    cost_index: 1.7, quality_index: 0.95,
  },
  {
    id: 'AG-CODEX', type: 'agent', tier: 'manager', name: 'Codex', status: 'active',
    strengths: ['code', 'tests', 'correction', 'refactoring', 'debugging'],
    cost_index: 0.7, quality_index: 0.98,
  },
  { id: 'AG-KIMI', type: 'agent', tier: 'manager', name: 'Kimi', status: 'active', strengths: ['long-context', 'recherche'], cost_index: 0.8, quality_index: 0.88 },
]

const controlFrontend = { id: 'CTRL-X', type: 'control', domain: 'frontend' }

test('un control frontend demande les aptitudes d’ingénierie', () => {
  assert.deepEqual(requiredStrengths(controlFrontend), ['code', 'tests', 'correction'])
})

test('les domaines d’ingénierie et d’UI demandent des aptitudes distinctes', () => {
  const engineering = requiredStrengths({ id: 'C', type: 'control', domain: 'backend' })
  const ui = requiredStrengths({ id: 'C', type: 'control', domain: 'ui' })
  assert.equal(engineering.some((s) => ui.includes(s)), false)
})

test('ui a un chemin non orphelin (tokens UX, pas code)', () => {
  // TEMPORARY MODEL BINDING — titulaire précis remplacé dans role-model-separation.
  const ui = requiredStrengths({ id: 'C', type: 'control', domain: 'ui' })
  assert.ok(ui.includes('analyse-ux'))
  assert.equal(ui.includes('code'), false)
  const r = selectAgent({ id: 'CTRL-UI', type: 'control', domain: 'ui' }, AGENTS)
  assert.ok(r)
  assert.notEqual(r.agent.id, 'AG-ANTIGRAVITY')
  assert.notEqual(r.agent.tier, 'worker')
  assert.match(r.rationale, /aptitude/)
  assert.doesNotMatch(r.rationale, /aucune aptitude/)
})

test('prototypage a un chemin non orphelin (ingenierie executable)', () => {
  // TEMPORARY MODEL BINDING — titulaire précis remplacé dans role-model-separation.
  assert.deepEqual(
    requiredStrengths({ id: 'C', type: 'control', domain: 'prototypage' }),
    ['code', 'tests', 'correction'],
  )
  const r = selectAgent({ id: 'CTRL-P', type: 'control', domain: 'prototypage' }, AGENTS)
  assert.ok(r)
  assert.notEqual(r.agent.id, 'AG-ANTIGRAVITY')
  assert.notEqual(r.agent.tier, 'worker')
  assert.match(r.rationale, /aptitude/)
})

test('Hermes (CEO) ne reçoit jamais de mandat d’exécution (INV-001)', () => {
  const r = selectAgent(controlFrontend, AGENTS)
  assert.notEqual(r.agent.id, 'AG-HERMES')
  assert.ok(r.alternatives.every((a) => a.id !== 'AG-HERMES'))
})

test('frontend a un chemin justifie par aptitude code/tests/correction', () => {
  // TEMPORARY MODEL BINDING — ne fige pas Codex comme organigramme définitif ;
  // vérifie le binding actuel et qu'Antigravity n'est jamais choisi.
  const r = selectAgent(controlFrontend, AGENTS)
  assert.notEqual(r.agent.id, 'AG-ANTIGRAVITY')
  assert.match(r.rationale, /INV-011/)
  assert.match(r.rationale, /aptitude/)
  assert.match(r.rationale, /code/)
  assert.doesNotMatch(r.rationale, /aucune aptitude/)
})

test('l’aptitude prime sur le rapport qualité/coût', () => {
  const r = selectAgent(controlFrontend, AGENTS)
  // L'agent purement recherche ne doit pas gagner un mandat d'ingénierie.
  assert.notEqual(r.agent.id, 'AG-KIMI')

  const r2 = selectAgent({ id: 'CTRL-Y', type: 'control', domain: 'recherche' }, AGENTS)
  assert.notEqual(r2.agent.id, 'AG-ANTIGRAVITY')
  assert.match(r2.rationale, /aptitude/)
})

test('le coût du mandat dérive du cost_index de l’agent choisi', () => {
  const r = selectAgent(controlFrontend, AGENTS)
  assert.equal(r.cost, Math.round((r.agent.cost_index || 0) * DELEGATION_UNIT * 100) / 100)
})

test('le choix est déterministe', () => {
  const a = selectAgent(controlFrontend, AGENTS)
  const b = selectAgent(controlFrontend, [...AGENTS].reverse())
  assert.equal(a.agent.id, b.agent.id)
  assert.equal(a.rationale, b.rationale)
})

test('aucun manager actif => aucun mandat', () => {
  const onlyCeo = AGENTS.filter((a) => a.tier === 'ceo')
  assert.equal(selectAgent(controlFrontend, onlyCeo), null)
})

test('fixture et selection n incluent jamais AG-ANTIGRAVITY', () => {
  assert.equal(AGENTS.some((a) => a.id === 'AG-ANTIGRAVITY'), false)
  for (const domain of ['frontend', 'ui', 'prototypage', 'recherche', 'analyse']) {
    const r = selectAgent({ id: 'C', type: 'control', domain }, AGENTS)
    assert.notEqual(r?.agent?.id, 'AG-ANTIGRAVITY')
  }
})
