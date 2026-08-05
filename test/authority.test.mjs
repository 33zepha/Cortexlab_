/**
 * Tests de la hiérarchie d'autorité (registre réel, pas de fixture).
 *
 * Post-suppression Antigravity : le registre ne doit plus contenir
 * AG-ANTIGRAVITY, et chaque domaine a un titulaire vivant non-worker justifié
 * par aptitude (pas par seul ratio qualité/coût).
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

// ─── Absence Antigravity ────────────────────────────────────────────────────

test('AG-ANTIGRAVITY est absent du registre derive', () => {
  assert.equal(byId('AG-ANTIGRAVITY'), undefined)
  assert.equal(agents.some((a) => /antigravity/i.test(a.name || '')), false)
})

test('aucun agent actif ne revendique les anciens tokens Antigravity exclusifs', () => {
  // Ces tokens UI-execution ne doivent plus servir de base de routage orpheline.
  // ui/prototypage purs ont ete redistribues : execution -> Codex, analyse -> Claude.
  for (const a of agents) {
    assert.notEqual(a.id, 'AG-ANTIGRAVITY')
  }
})

// ─── Codex : Chief Engineer ─────────────────────────────────────────────────

test('Codex est un manager rattache directement a Hermes', () => {
  const codex = byId('AG-CODEX')
  assert.ok(codex, 'AG-CODEX absent du registre')
  assert.equal(codex.tier, 'manager')
  assert.equal(codex.reports_to, 'AG-HERMES')
  assert.equal(codex.status, 'active')
})

test('Codex detient l autorite sur l ingenierie du depot', () => {
  for (const domain of ['frontend', 'backend', 'engineering', 'implementation', 'testing', 'debugging', 'refactoring', 'code_security', 'prototypage', 'frontend-integration']) {
    assert.equal(selectAgent(ctrl(domain), agents).agent.id, 'AG-CODEX', `domaine « ${domain} » mal route`)
  }
})

test('le mandat confie a Codex est justifie et chiffre', () => {
  const r = selectAgent(ctrl('backend'), agents)
  assert.match(r.rationale, /INV-011/)
  assert.match(r.rationale, /Codex/)
  assert.ok(r.cost > 0)
})

// ─── Claude : UX / produit ──────────────────────────────────────────────────

test('Claude porte les tokens UX machine (pas seulement le ratio)', () => {
  const claude = byId('AG-CLAUDE')
  assert.ok(claude)
  for (const tok of ['analyse-ux', 'critique-ux', 'specification-ui', 'direction-produit', 'revue-visuelle', 'analyse', 'critique', 'conseil']) {
    assert.ok((claude.strengths || []).includes(tok), `Claude manque le token ${tok}`)
  }
})

test('ui et ux routent vers Claude par aptitude', () => {
  for (const domain of ['ui', 'ux']) {
    const r = selectAgent(ctrl(domain), agents)
    assert.equal(r.agent.id, 'AG-CLAUDE', `domaine « ${domain} »`)
    assert.match(r.rationale, /aptitude/)
    assert.doesNotMatch(r.rationale, /aucune aptitude/)
  }
})

test('analyse / critique / conseil routent vers Claude', () => {
  for (const domain of ['analyse', 'critique', 'conseil']) {
    assert.equal(selectAgent(ctrl(domain), agents).agent.id, 'AG-CLAUDE', domain)
  }
})

// ─── Chaîne de commandement ─────────────────────────────────────────────────

test('Luna est un worker place sous le Chief Engineer', () => {
  const luna = byId('AG-LUNA')
  assert.equal(luna.tier, 'worker')
  assert.equal(luna.reports_to, 'AG-CODEX')
})

test('aucun worker n est candidat au routage (INV-011)', () => {
  const workers = agents.filter((a) => a.tier === 'worker').map((a) => a.id)
  for (const domain of ALL_DOMAINS) {
    const chosen = selectAgent(ctrl(domain), agents).agent.id
    assert.equal(workers.includes(chosen), false, `worker sur « ${domain} »`)
  }
})

test('Hermes (CEO) ne recoit jamais de mandat d execution (INV-001)', () => {
  for (const domain of [...ALL_DOMAINS, 'inconnu']) {
    const r = selectAgent(ctrl(domain), agents)
    assert.notEqual(r.agent.id, 'AG-HERMES')
    assert.ok(r.alternatives.every((a) => a.id !== 'AG-HERMES'))
  }
})

test('tout manager declare son rattachement a un agent existant', () => {
  for (const a of agents.filter((x) => x.tier === 'manager')) {
    assert.ok(a.reports_to, `${a.id} sans reports_to`)
    assert.ok(byId(a.reports_to), `${a.id} reports_to inconnu: ${a.reports_to}`)
  }
})

test('aucune boucle dans la chaine de rattachement', () => {
  for (const a of agents) {
    const path = [a.id]
    let cur = a
    while (cur?.reports_to) {
      assert.equal(path.includes(cur.reports_to), false, `boucle: ${[...path, cur.reports_to].join(' -> ')}`)
      path.push(cur.reports_to)
      cur = byId(cur.reports_to)
    }
  }
})

// ─── Domaines : titulaire vivant + aptitude ─────────────────────────────────

test('chaque domaine a un titulaire vivant non-worker justifie par aptitude', () => {
  for (const domain of ALL_DOMAINS) {
    const r = selectAgent(ctrl(domain), agents)
    assert.ok(r, `${domain} sans titulaire`)
    assert.notEqual(r.agent.tier, 'worker', `${domain} -> worker`)
    assert.notEqual(r.agent.id, 'AG-ANTIGRAVITY')
    assert.match(r.rationale, /aptitude/, `${domain} route par defaut sans aptitude`)
    assert.doesNotMatch(r.rationale, /aucune aptitude/)
  }
})

// ─── Cohérence registre / router ────────────────────────────────────────────

test('les strengths du registre sont des tokens matchables par le router', () => {
  const domains = ALL_DOMAINS
  for (const a of agents.filter((x) => x.tier === 'manager' && x.status === 'active')) {
    const matches = domains.some((d) => requiredStrengths(ctrl(d)).some((s) => (a.strengths || []).includes(s)))
    assert.ok(matches, `${a.id} ne matche aucun domaine`)
  }
})

test('Codex a la meilleure qualite parmi les managers', () => {
  const managers = agents.filter((a) => a.tier === 'manager')
  const best = Math.max(...managers.map((a) => a.quality_index || 0))
  assert.equal(byId('AG-CODEX').quality_index, best)
})

test('le registre ne contient que les agents attendus', () => {
  const ids = agents.map((a) => a.id).sort()
  assert.deepEqual(ids, ['AG-CLAUDE', 'AG-CODEX', 'AG-HERMES', 'AG-KIMI', 'AG-LUNA'].sort())
})
