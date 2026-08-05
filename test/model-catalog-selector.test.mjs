/**
 * Tests catalogue modèles enrichi + efforts + sélecteur + org router.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadModelCatalog,
  validateModelCatalog,
  listAvailableModels,
  resolveVariant,
  supportsEffort,
  normalizeEffortForVariant,
} from '../runtime/model-catalog.mjs'
import { selectModel } from '../runtime/model-selector.mjs'
import { routeOrganization, buildRoleAssignments } from '../runtime/organization-router.mjs'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const PROOF = path.join(ROOT, 'docs/proofs/model-discovery-2026-08-05.json')
const doc = loadModelCatalog()

test('grok present; gemini forbidden', () => {
  const fams = (doc.families || []).map((f) => f.id)
  assert.ok(fams.includes('grok'))
  assert.ok(fams.includes('codex'))
  assert.ok(fams.includes('claude'))
  assert.ok(fams.includes('kimi'))
  assert.ok(fams.includes('hy3'))
  const forbidden = (doc.forbidden_families || []).map((s) => s.toLowerCase())
  assert.ok(forbidden.some((f) => f.includes('gemini')))
  assert.ok(forbidden.some((f) => f.includes('antigravity') || f.includes('google')))
  const v = validateModelCatalog(doc)
  assert.equal(v.ok, true, v.errors.join('; '))
})

test('discovered variants have source proof file', () => {
  assert.ok(fs.existsSync(PROOF))
  const proof = JSON.parse(fs.readFileSync(PROOF, 'utf8'))
  assert.ok(Array.isArray(proof.sources) && proof.sources.length > 0)
  assert.ok(Array.isArray(proof.variants) && proof.variants.length > 0)
  for (const v of proof.variants) {
    assert.ok(v.discovered_from || v.evidence_status, v.variant_id)
    assert.ok(v.family_id)
    assert.ok(v.variant_id)
  }
  // no secrets
  const raw = fs.readFileSync(PROOF, 'utf8')
  assert.equal(/sk-[a-zA-Z0-9]{10,}/.test(raw), false)
  assert.equal(/ghp_/.test(raw), false)
  assert.equal(/BEGIN PRIVATE/.test(raw), false)
})

test('unavailable variants are not selectable', () => {
  for (const v of doc.variants || []) {
    if (v.availability?.account_access === false || v.availability?.discovered === false) {
      if (v.availability?.account_access !== true) {
        assert.equal(v.selectable, false, v.id)
      }
    }
    if (/quota_exhausted/i.test(v.status || '')) {
      assert.equal(v.selectable, false, v.id)
    }
  }
  const avail = listAvailableModels(doc)
  assert.ok(avail.every((v) => v.selectable === true))
  assert.ok(avail.every((v) => !/quota_exhausted/i.test(v.status || '')))
})

test('Luna is a variant not a role', () => {
  const luna = resolveVariant('gpt-5.6-luna', doc) || resolveVariant('luna', doc)
  assert.ok(luna)
  assert.equal(luna.family_id, 'codex')
  assert.equal(luna.id, 'gpt-5.6-luna')
  // not in roles
  const roles = fs.readFileSync(path.join(ROOT, 'contracts/roles.yaml'), 'utf8')
  assert.equal(/id:\s*AG-LUNA/.test(roles), false)
  assert.equal(/id:\s*LUNA/.test(roles), false)
})

test('HY3 preferred for light low-risk when available', () => {
  const r = selectModel({ task: 'classification', risk: 'low', preferred_effort: 'low', budget_policy: 'economical' }, doc)
  assert.equal(r.family_id, 'hy3')
  assert.equal(r.variant_id, 'tencent/hy3:free')
  assert.ok(['none', 'low', 'high'].includes(r.canonical_effort))
})

test('HY3 excluded from critical missions', () => {
  const r = selectModel({ task: 'architecture', risk: 'critical', preferred_effort: 'high' }, doc)
  assert.notEqual(r.family_id, 'hy3')
  assert.ok(r.rejected_alternatives.some((x) => x.variant_id === 'tencent/hy3:free' || x.reason.includes('hy3')))
  assert.ok(EFFORT_AT_LEAST_HIGH(r.canonical_effort))
})

function EFFORT_AT_LEAST_HIGH(e) {
  return ['high', 'xhigh', 'max'].includes(e)
}

test('OpenAI Luna favored for long volume-sensitive task', () => {
  const r = selectModel({ task: 'code', risk: 'low', preferred_effort: 'medium', budget_policy: 'economical' }, doc)
  // luna or terra acceptable; prefer luna for economical code
  assert.ok(['gpt-5.6-luna', 'gpt-5.6-terra', 'grok-build-0.1'].includes(r.variant_id), r.variant_id)
})

test('Sol can be favored for critical', () => {
  const r = selectModel({ task: 'architecture', risk: 'critical', preferred_effort: 'high', budget_policy: 'quality' }, doc)
  assert.ok(['gpt-5.6-sol', 'gpt-5.6-terra', 'claude-opus-4-8', 'grok-4.5'].includes(r.variant_id), r.variant_id)
})

test('variant never receives unsupported effort silently', () => {
  // K3 does not support medium
  const norm = normalizeEffortForVariant('k3', 'medium', doc)
  assert.equal(norm.ok, false)
  assert.equal(norm.provider_effort, null)
  assert.match(norm.reason, /unsupported|not_in_supported/)

  const sel = selectModel({ task: 'long_read', risk: 'low', preferred_effort: 'medium' }, doc)
  // if k3 chosen, effort must not be medium without explicit remap reason
  if (sel.variant_id === 'k3') {
    assert.notEqual(sel.provider_effort, 'medium')
    assert.ok(sel.effort_mapping_reason)
    assert.notEqual(sel.effort_mapping_reason, 'direct')
  }
  // provider_effort always in supported or thinking_* 
  if (sel.variant_id) {
    const v = resolveVariant(sel.variant_id, doc)
    if (sel.provider_effort && !String(sel.provider_effort).startsWith('thinking_')) {
      assert.ok(
        (v.efforts?.supported || []).includes(sel.provider_effort) ||
          (v.efforts?.supported || []).includes(sel.canonical_effort),
        `${sel.variant_id} provider_effort=${sel.provider_effort}`,
      )
    }
  }
})

test('K3 max-only false: supports low/high/max; medium not silent', () => {
  const k3 = resolveVariant('k3', doc)
  assert.deepEqual(k3.efforts.supported.sort(), ['high', 'low', 'max'])
  assert.equal(supportsEffort(k3, 'medium', doc), false)
  assert.equal(supportsEffort(k3, 'max', doc), true)
})

test('Grok multi-agent effort_semantics', () => {
  const g = resolveVariant('grok-4.20-multi-agent', doc)
  assert.equal(g.efforts.semantics, 'multi_agent_scale')
  assert.ok(g.efforts.supported.includes('xhigh'))
})

test('Claude efforts are own set', () => {
  const c = resolveVariant('claude-opus-4-8', doc)
  assert.deepEqual(c.efforts.supported, ['low', 'medium', 'high', 'xhigh', 'max'])
  assert.equal(c.efforts.semantics, 'claude_effort')
})

test('organization chosen before model; roles carry no provider/model', () => {
  const org = routeOrganization({
    goal: 'Corrige Mission Control et rends le mobile meilleur',
    domains: ['frontend', 'ui'],
    risk: 'medium',
  })
  assert.ok(org.manager_role_ids.includes('MGR-ENGINEERING'))
  assert.ok(org.manager_role_ids.includes('MGR-PRODUCT-EXPERIENCE'))
  assert.equal(org.model_selection, null)
  for (const id of [...org.manager_role_ids, ...org.agent_role_ids]) {
    assert.equal(/claude|codex|kimi|luna|hy3|gemini/i.test(id), false, id)
  }
  const stubs = buildRoleAssignments(org, 'MIS-1042')
  assert.ok(stubs.every((s) => s.model === null && s.effort === null))
  // then model selector per agent
  const picks = stubs.map((s) =>
    selectModel({
      agent_role_id: s.agent_role_id,
      task: s.agent_role_id.includes('FRONTEND') ? 'code' : 'light',
      risk: 'medium',
      preferred_effort: 'medium',
    }, doc),
  )
  assert.ok(picks.every((p) => p.variant_id))
})

test('selector is deterministic', () => {
  const input = { task: 'code', risk: 'low', preferred_effort: 'medium', budget_policy: 'economical' }
  const a = selectModel(input, doc)
  const b = selectModel(input, doc)
  assert.equal(a.variant_id, b.variant_id)
  assert.equal(a.canonical_effort, b.canonical_effort)
  assert.equal(a.provider_effort, b.provider_effort)
})

test('HY3 efforts only none/low/high', () => {
  const h = resolveVariant('tencent/hy3:free', doc)
  assert.deepEqual(h.efforts.supported.sort(), ['high', 'low', 'none'])
  assert.equal(normalizeEffortForVariant(h, 'medium', doc).ok, false)
  assert.equal(normalizeEffortForVariant(h, 'max', doc).ok, false)
})
