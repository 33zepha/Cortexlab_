/**
 * Invariants d'autorité durables (registre réel, pas de fixture).
 *
 * Post-suppression Antigravity. Ne fige PAS la liste des modèles/agents
 * actuels comme organigramme définitif — le registre Claude/Codex/Kimi/Luna
 * est une représentation TRANSITOIRE avant feat/role-model-separation.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadAgents, selectAgent, requiredStrengths } from '../runtime/router.mjs'

const agents = loadAgents()
const byId = (id) => agents.find((a) => a.id === id)

const ctrl = (domain) => ({ id: `CTRL-${domain}`, type: 'control', domain })

const ALL_DOMAINS = [
  'frontend', 'backend', 'engineering', 'implementation', 'testing', 'debugging',
  'refactoring', 'code_security', 'ui', 'ux', 'prototypage', 'frontend-integration',
  'recherche', 'data', 'analyse', 'critique', 'conseil',
]

// ─── Absence Antigravity / providers retirés ────────────────────────────────

test('AG-ANTIGRAVITY est absent du registre derive', () => {
  assert.equal(byId('AG-ANTIGRAVITY'), undefined)
  assert.equal(agents.some((a) => /antigravity/i.test(a.name || '') || /antigravity/i.test(a.id || '')), false)
})

test('Antigravity n est jamais selectionne', () => {
  for (const domain of ALL_DOMAINS) {
    const r = selectAgent(ctrl(domain), agents)
    assert.ok(r, `${domain} sans chemin`)
    assert.notEqual(r.agent.id, 'AG-ANTIGRAVITY')
    assert.equal(/antigravity/i.test(r.agent.name || ''), false)
  }
})

test('aucun agent Google/Gemini actif', () => {
  for (const a of agents.filter((x) => x.status === 'active')) {
    const provider = String(a.provider || '').toLowerCase()
    const model = String(a.model || '').toLowerCase()
    assert.notEqual(provider, 'google', `${a.id} provider google`)
    assert.equal(/gemini|antigravity/.test(model), false, `${a.id} model ${a.model}`)
  }
})

// ─── Invariants durables (pas de liste figée de modèles) ────────────────────

test('AG-HERMES est present (CEO)', () => {
  const h = byId('AG-HERMES')
  assert.ok(h, 'AG-HERMES absent')
  assert.equal(h.tier, 'ceo')
  assert.equal(h.status, 'active')
})

test('Hermes (CEO) ne recoit jamais de mandat d execution (INV-001)', () => {
  for (const domain of [...ALL_DOMAINS, 'inconnu']) {
    const r = selectAgent(ctrl(domain), agents)
    assert.ok(r, `${domain} sans chemin`)
    assert.notEqual(r.agent.id, 'AG-HERMES')
    assert.ok((r.alternatives || []).every((a) => a.id !== 'AG-HERMES'))
  }
})

test('aucun worker n est selectionne directement (INV-011)', () => {
  const workers = new Set(agents.filter((a) => a.tier === 'worker').map((a) => a.id))
  for (const domain of ALL_DOMAINS) {
    const chosen = selectAgent(ctrl(domain), agents).agent
    assert.equal(workers.has(chosen.id), false, `worker ${chosen.id} sur « ${domain} »`)
    assert.notEqual(chosen.tier, 'worker')
  }
})

test('aucun reports_to vers un agent absent', () => {
  for (const a of agents) {
    if (!a.reports_to) continue
    assert.ok(byId(a.reports_to), `${a.id} reports_to inconnu: ${a.reports_to}`)
  }
})

test('aucune boucle dans la chaine de rattachement', () => {
  for (const a of agents) {
    const path = [a.id]
    let cur = a
    while (cur?.reports_to) {
      assert.equal(
        path.includes(cur.reports_to),
        false,
        `boucle: ${[...path, cur.reports_to].join(' -> ')}`,
      )
      path.push(cur.reports_to)
      cur = byId(cur.reports_to)
    }
  }
})

test('chaque domaine a un chemin temporaire valide (non orphelin, aptitude)', () => {
  // TEMPORARY MODEL BINDING — le titulaire exact changera avec role-model-separation.
  // Ici on garantit seulement : un manager actif, justifié par aptitude, pas AGY.
  for (const domain of ALL_DOMAINS) {
    const r = selectAgent(ctrl(domain), agents)
    assert.ok(r, `${domain} sans titulaire`)
    assert.equal(r.agent.status, 'active')
    assert.notEqual(r.agent.tier, 'worker')
    assert.notEqual(r.agent.tier, 'ceo')
    assert.notEqual(r.agent.id, 'AG-ANTIGRAVITY')
    assert.match(r.rationale, /aptitude/, `${domain} route par defaut sans aptitude`)
    assert.doesNotMatch(r.rationale, /aucune aptitude/)
    assert.ok(r.cost >= 0)
  }
})

test('les strengths des managers actifs sont matchables par le router', () => {
  for (const a of agents.filter((x) => x.tier === 'manager' && x.status === 'active')) {
    const matches = ALL_DOMAINS.some((d) =>
      requiredStrengths(ctrl(d)).some((s) => (a.strengths || []).includes(s)),
    )
    assert.ok(matches, `${a.id} ne matche aucun domaine — strengths inutilisables`)
  }
})

test('au moins un manager actif hors CEO existe (runtime delegable)', () => {
  const managers = agents.filter((a) => a.tier === 'manager' && a.status === 'active')
  assert.ok(managers.length >= 1, 'aucun manager actif')
})
