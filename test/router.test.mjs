/**
 * Tests du routeur de délégation (INV-001 + INV-011).
 * node --test test/router.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selectAgent, requiredStrengths, DELEGATION_UNIT } from '../runtime/router.mjs'

const AGENTS = [
  { id: 'AG-HERMES', type: 'agent', tier: 'ceo', name: 'Hermes', status: 'active', strengths: ['orchestration'], cost_index: 0.4, quality_index: 0.9 },
  { id: 'AG-CLAUDE', type: 'agent', tier: 'manager', name: 'Claude', status: 'active', strengths: ['raisonnement', 'code', 'conformite'], cost_index: 1.7, quality_index: 0.95 },
  { id: 'AG-ANTIGRAVITY', type: 'agent', tier: 'manager', name: 'Antigravity', status: 'active', strengths: ['code', 'autonomie'], cost_index: 1.3, quality_index: 0.92 },
  { id: 'AG-KIMI', type: 'agent', tier: 'manager', name: 'Kimi', status: 'active', strengths: ['long-context', 'recherche'], cost_index: 0.8, quality_index: 0.88 },
]

const controlFrontend = { id: 'CTRL-X', type: 'control', domain: 'frontend' }

test('un control frontend demande l’aptitude code', () => {
  assert.deepEqual(requiredStrengths(controlFrontend), ['code'])
})

test('Hermes (CEO) ne reçoit jamais de mandat d’exécution (INV-001)', () => {
  const r = selectAgent(controlFrontend, AGENTS)
  assert.notEqual(r.agent.id, 'AG-HERMES')
  assert.ok(r.alternatives.every((a) => a.id !== 'AG-HERMES'))
})

test('à aptitude égale, le meilleur rapport qualité/coût gagne (INV-011)', () => {
  const r = selectAgent(controlFrontend, AGENTS)
  // Claude et Antigravity ont tous deux « code » ; 0.92/1.3=0.71 > 0.95/1.7=0.56
  assert.equal(r.agent.id, 'AG-ANTIGRAVITY')
  assert.match(r.rationale, /INV-011/)
  assert.match(r.rationale, /code/)
})

test('l’aptitude prime sur le rapport qualité/coût', () => {
  // Kimi a le meilleur ratio (0.88/0.8=1.1) mais pas l’aptitude « code ».
  const r = selectAgent(controlFrontend, AGENTS)
  assert.notEqual(r.agent.id, 'AG-KIMI')

  // Sur un domaine recherche, Kimi doit l’emporter.
  const r2 = selectAgent({ id: 'CTRL-Y', type: 'control', domain: 'recherche' }, AGENTS)
  assert.equal(r2.agent.id, 'AG-KIMI')
})

test('le coût du mandat dérive du cost_index de l’agent', () => {
  const r = selectAgent(controlFrontend, AGENTS)
  assert.equal(r.cost, Math.round(1.3 * DELEGATION_UNIT * 100) / 100)
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
