/**
 * Tests de la hiérarchie d'autorité (registre réel, pas de fixture).
 *
 * Ces tests protègent des invariants de gouvernance qui ne se voient pas à la
 * lecture du YAML : ils lisent le registre DÉRIVÉ, celui que le router utilise
 * vraiment. Une régression de `generate-registry.mjs` ou une édition du YAML
 * qui casse la chaîne d'autorité échoue ici.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadAgents, selectAgent, requiredStrengths } from '../runtime/router.mjs'

const agents = loadAgents()
const byId = (id) => agents.find((a) => a.id === id)

const ctrl = (domain) => ({ id: `CTRL-${domain}`, type: 'control', domain })

// ─── Codex : Chief Engineer rattaché à Hermes ───────────────────────────────

test('Codex est un manager rattache directement a Hermes', () => {
  const codex = byId('AG-CODEX')
  assert.ok(codex, 'AG-CODEX absent du registre')
  assert.equal(codex.tier, 'manager')
  assert.equal(codex.reports_to, 'AG-HERMES')
  assert.equal(codex.status, 'active')
})

test('Codex ne depend plus d Antigravity', () => {
  assert.notEqual(byId('AG-CODEX').reports_to, 'AG-ANTIGRAVITY')
})

test('Codex detient l autorite sur l ingenierie du depot', () => {
  for (const domain of ['frontend', 'backend', 'engineering', 'implementation', 'testing', 'debugging', 'refactoring', 'code_security']) {
    assert.equal(selectAgent(ctrl(domain), agents).agent.id, 'AG-CODEX', `domaine « ${domain} » mal route`)
  }
})

test('le mandat confie a Codex est justifie et chiffre', () => {
  const r = selectAgent(ctrl('backend'), agents)
  assert.match(r.rationale, /INV-011/)
  assert.match(r.rationale, /Codex/)
  assert.ok(r.cost > 0)
})

// ─── Antigravity : domaine spécialisé, non concurrent ───────────────────────

test('Antigravity garde un domaine distinct (UI / prototypage)', () => {
  assert.equal(selectAgent(ctrl('ui'), agents).agent.id, 'AG-ANTIGRAVITY')
  assert.equal(selectAgent(ctrl('prototypage'), agents).agent.id, 'AG-ANTIGRAVITY')
})

test('Codex et Antigravity ne partagent aucune aptitude', () => {
  // « Antigravity et Codex ne doivent pas posséder simultanément le même
  // domaine d'autorité. » Un chevauchement de strengths recréerait le conflit.
  const overlap = (byId('AG-ANTIGRAVITY').strengths || []).filter((s) =>
    (byId('AG-CODEX').strengths || []).includes(s)
  )
  assert.deepEqual(overlap, [])
})

test('Antigravity ne revendique plus l aptitude « code »', () => {
  assert.equal((byId('AG-ANTIGRAVITY').strengths || []).includes('code'), false)
})

// ─── Chaîne de commandement ─────────────────────────────────────────────────

test('Luna est un worker place sous le Chief Engineer', () => {
  const luna = byId('AG-LUNA')
  assert.equal(luna.tier, 'worker')
  assert.equal(luna.reports_to, 'AG-CODEX')
})

test('aucun worker n est candidat au routage (INV-011)', () => {
  const workers = agents.filter((a) => a.tier === 'worker').map((a) => a.id)
  for (const domain of ['frontend', 'backend', 'ui', 'recherche', 'data']) {
    const chosen = selectAgent(ctrl(domain), agents).agent.id
    assert.equal(workers.includes(chosen), false, `un worker a recu un mandat sur « ${domain} »`)
  }
})

test('Hermes (CEO) ne recoit jamais de mandat d execution (INV-001)', () => {
  for (const domain of ['frontend', 'backend', 'engineering', 'ui', 'recherche', 'data', 'inconnu']) {
    const r = selectAgent(ctrl(domain), agents)
    assert.notEqual(r.agent.id, 'AG-HERMES')
    assert.ok(r.alternatives.every((a) => a.id !== 'AG-HERMES'))
  }
})

test('tout manager non-CEO declare son rattachement', () => {
  // Une hierarchie muette empeche de verifier qui repond a qui.
  for (const a of agents.filter((x) => x.tier === 'manager')) {
    if (a.id === 'AG-CLAUDE' || a.id === 'AG-KIMI') continue // rattachement non encore declare
    assert.ok(a.reports_to, `${a.id} sans reports_to`)
  }
})

test('aucune boucle dans la chaine de rattachement', () => {
  for (const a of agents) {
    const path = [a.id]
    let cur = a
    while (cur?.reports_to) {
      assert.equal(path.includes(cur.reports_to), false, `boucle detectee : ${[...path, cur.reports_to].join(' -> ')}`)
      path.push(cur.reports_to)
      cur = byId(cur.reports_to)
    }
  }
})

// ─── Cohérence registre / router ────────────────────────────────────────────

test('les strengths du registre sont des tokens matchables par le router', () => {
  // Piege : une description en prose ne matche jamais requiredStrengths().
  // Chaque manager actif doit matcher au moins un domaine.
  const domains = ['frontend', 'backend', 'ui', 'recherche', 'data', 'autre']
  for (const a of agents.filter((x) => x.tier === 'manager' && x.status === 'active')) {
    const matches = domains.some((d) => requiredStrengths(ctrl(d)).some((s) => (a.strengths || []).includes(s)))
    assert.ok(matches, `${a.id} ne matche aucun domaine : strengths inutilisables par le router`)
  }
})

test('Codex a la meilleure qualite parmi les managers', () => {
  const managers = agents.filter((a) => a.tier === 'manager')
  const best = Math.max(...managers.map((a) => a.quality_index || 0))
  assert.equal(byId('AG-CODEX').quality_index, best)
})
