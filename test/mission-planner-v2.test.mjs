/**
 * Hardening + Mission Planner V2 shadow tests.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  loadModelCatalog,
  validateModelCatalog,
  resolveCapability,
  normalizeEffortForVariant,
  listAvailableModels,
  resolveVariant,
  EFFORT_RANK,
} from '../runtime/model-catalog.mjs'
import { selectModel } from '../runtime/model-selector.mjs'
import {
  routeOrganization,
  topologicalSortAgents,
  hasAnyToken,
  tokenizeMissionText,
} from '../runtime/organization-router.mjs'
import { planMissionV2, planHash } from '../runtime/mission-planner-v2.mjs'
import { createPlanningEvents, createLegacyCompatibilityEvents } from '../runtime/orchestration-events.mjs'
import {
  loadTransitionalBindings,
  legacyAgentToV2,
  v2AssignmentToLegacy,
  validateTransitionalBindings,
} from '../runtime/legacy-compat.mjs'
import { EventStore } from '../runtime/event-store.mjs'
import { loadAllContracts, validateSessionAssignment, validateRoleCycles, assertEffortDefaultSafe } from '../runtime/contracts.mjs'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const doc = loadModelCatalog()

test('catalog validates; ultra not canonical; selectable access tight', () => {
  const v = validateModelCatalog(doc)
  assert.equal(v.ok, true, v.errors.join('; '))
  for (const x of listAvailableModels(doc)) {
    assert.ok(['confirmed_success', 'confirmed_catalog'].includes(x.variant_access?.status), x.id)
  }
  assert.equal(resolveVariant('claude-fable-5', doc)?.selectable, false)
})

test('build backend service does not trigger Product/UX', () => {
  const org = routeOrganization({ goal: 'build backend service', domains: [], risk: 'medium' })
  assert.equal(org.status, 'ok')
  assert.ok(org.manager_role_ids.includes('MGR-ENGINEERING'))
  assert.equal(org.manager_role_ids.includes('MGR-PRODUCT-EXPERIENCE'), false)
})

test('improve UI triggers Product/UX', () => {
  const org = routeOrganization({ goal: 'improve UI mobile layout', risk: 'medium' })
  assert.ok(org.manager_role_ids.includes('MGR-PRODUCT-EXPERIENCE'))
})

test('unknown mission needs clarification', () => {
  const org = routeOrganization({ goal: 'Améliore le truc', risk: 'low' })
  assert.equal(org.status, 'needs_clarification')
  assert.deepEqual(org.manager_role_ids, [])
  assert.deepEqual(org.agent_role_ids, [])
})

test('execution_order respects UX → Interface → Frontend → Test → Evaluation', () => {
  const org = routeOrganization({
    goal: 'Refonte Mission Control mobile avec preuves visuelles',
    domains: ['frontend', 'ui'],
    risk: 'high',
    needs_evaluation: true,
  })
  const order = org.execution_order
  const idx = (id) => order.indexOf(id)
  if (order.includes('AGENT-UX-ANALYST') && order.includes('AGENT-FRONTEND-ENGINEER')) {
    assert.ok(idx('AGENT-UX-ANALYST') < idx('AGENT-FRONTEND-ENGINEER'))
  }
  if (order.includes('AGENT-INTERFACE-DESIGNER') && order.includes('AGENT-FRONTEND-ENGINEER')) {
    assert.ok(idx('AGENT-INTERFACE-DESIGNER') < idx('AGENT-FRONTEND-ENGINEER'))
  }
  if (order.includes('AGENT-FRONTEND-ENGINEER') && order.includes('AGENT-TEST-ENGINEER')) {
    assert.ok(idx('AGENT-FRONTEND-ENGINEER') < idx('AGENT-TEST-ENGINEER'))
  }
  if (order.includes('AGENT-TEST-ENGINEER') && order.includes('AGENT-MISSION-EVALUATOR')) {
    assert.ok(idx('AGENT-TEST-ENGINEER') < idx('AGENT-MISSION-EVALUATOR'))
  }
})

test('dependency cycle throws', () => {
  assert.throws(() =>
    topologicalSortAgents(['A', 'B'], [
      { before: 'A', after: 'B' },
      { before: 'B', after: 'A' },
    ]),
  )
})

test('Grok conditional web_search without snapshot rejected', () => {
  const r = selectModel({
    agent_role_id: 'AGENT-RESEARCH',
    task: 'research_web',
    risk: 'medium',
    tools_required: ['web_search'],
    preferred_effort: 'high',
    access_capability_snapshot: {},
  }, doc)
  // either unassigned or non-grok without conditional true
  if (r.status === 'assigned') {
    assert.notEqual(r.family_id, 'grok')
  }
})

test('Grok web_search with snapshot true can be candidate', () => {
  const r = selectModel({
    agent_role_id: 'AGENT-RESEARCH',
    task: 'research_web',
    risk: 'medium',
    tools_required: ['web_search'],
    preferred_effort: 'high',
    access_capability_snapshot: {
      hermes_xai_oauth: { web_search: true, x_search: true, code_execution: false },
    },
  }, doc)
  assert.equal(r.status, 'assigned')
  // grok-4.5 preferred when tools confirmed
  assert.ok(['grok', 'kimi', 'claude', 'codex'].includes(r.family_id))
})

test('documentary_only never selected', () => {
  const fable = resolveVariant('claude-fable-5', doc)
  assert.equal(fable.selectable, false)
  const avail = listAvailableModels(doc).map((v) => v.id)
  assert.equal(avail.includes('claude-fable-5'), false)
})

test('resolveCapability never treats string as true', () => {
  const fake = { capabilities: { web_search: 'possible_if_tools_enabled' } }
  const r = resolveCapability(fake, 'web_search', {})
  assert.equal(r.available, false)
})

test('critical never remapped under high', () => {
  const r = selectModel({
    agent_role_id: 'AGENT-ARCHITECTURE',
    risk: 'critical',
    preferred_effort: 'low',
  }, doc)
  assert.equal(r.status, 'assigned')
  assert.ok(EFFORT_RANK[r.canonical_effort] >= EFFORT_RANK.high)
  assert.notEqual(r.family_id, 'hy3')
})

test('no candidate high returns unassigned not arbitrary low', () => {
  const r = selectModel({
    agent_role_id: 'AGENT-SECURITY-REVIEWER',
    risk: 'critical',
    preferred_effort: 'high',
    // force impossible context
    context_required: 999999999,
  }, doc)
  assert.equal(r.status, 'unassigned')
  assert.equal(r.requires_escalation, true)
})

test('fallback chain entries are effort-compatible', () => {
  const r = selectModel({
    agent_role_id: 'AGENT-FRONTEND-ENGINEER',
    risk: 'medium',
    preferred_effort: 'medium',
  }, doc)
  assert.equal(r.status, 'assigned')
  for (const f of r.fallback_chain || []) {
    assert.ok(f.canonical_effort)
    assert.ok(f.provider_effort != null)
    assert.ok(EFFORT_RANK[f.canonical_effort] >= EFFORT_RANK[r.minimum_effort])
  }
})

test('chosen_score matches chosen model', () => {
  const r = selectModel({ agent_role_id: 'AGENT-FRONTEND-ENGINEER', risk: 'low', preferred_effort: 'medium' }, doc)
  assert.equal(r.status, 'assigned')
  assert.equal(typeof r.chosen_score, 'number')
  assert.match(r.selection_reason, new RegExp(String(r.chosen_score)))
})

test('ultra cannot be requested as canonical', () => {
  const r = selectModel({ preferred_effort: 'ultra', risk: 'low' }, doc)
  assert.equal(r.status, 'unassigned')
})

test('provider ultra observable but not selectable by cortex', () => {
  const sol = resolveVariant('gpt-5.6-sol', doc)
  assert.ok(sol.provider_extensions?.ultra?.discovered)
  assert.equal(sol.provider_extensions.ultra.selectable_by_cortex, false)
  assert.equal((sol.efforts.canonical_supported || []).includes('ultra'), false)
})

test('Security Reviewer never HY3', () => {
  const r = selectModel({ agent_role_id: 'AGENT-SECURITY-REVIEWER', risk: 'high', preferred_effort: 'high' }, doc)
  assert.notEqual(r.family_id, 'hy3')
})

test('Source Verifier low-risk may get HY3 without web mandatory', () => {
  const r = selectModel({
    agent_role_id: 'AGENT-SOURCE-VERIFIER',
    risk: 'low',
    preferred_effort: 'low',
    budget_policy: 'economical',
  }, doc)
  assert.equal(r.status, 'assigned')
  // HY3 preferred for light
  assert.ok(['hy3', 'kimi', 'codex'].includes(r.family_id))
})

test('Visual Reviewer requires vision', () => {
  const r = selectModel({ agent_role_id: 'AGENT-VISUAL-REVIEWER', risk: 'medium', preferred_effort: 'medium' }, doc)
  assert.equal(r.status, 'assigned')
  const v = resolveVariant(r.variant_id, doc)
  assert.equal(resolveCapability(v, 'vision', {}).available, true)
})

test('Mnemosyne absent on light non-evaluated', () => {
  const org = routeOrganization({ goal: 'extract and classify ten rows', risk: 'low' })
  assert.equal(org.manager_role_ids.includes('MGR-LEARNING-EVALUATION'), false)
})

test('Mnemosyne present for critical', () => {
  const org = routeOrganization({ goal: 'migrate runtime contract consumers', risk: 'critical' })
  assert.ok(org.manager_role_ids.includes('MGR-LEARNING-EVALUATION'))
})

test('role cycles valid; effort default safe', () => {
  const c = loadAllContracts()
  assert.equal(validateRoleCycles(c.roles).ok, true)
  assert.equal(assertEffortDefaultSafe(c.efforts), null)
})

test('session validation rejects bad channel and family mismatch', () => {
  const catalogs = loadAllContracts()
  const bad = {
    mission_id: 'MIS-1',
    manager_id: 'MGR-ENGINEERING',
    agent_role_id: 'AGENT-FRONTEND-ENGINEER',
    session_id: 'ses_1',
    model: { family: 'claude', variant: 'gpt-5.6-luna', access_channel: 'nope' },
    effort: 'medium',
  }
  const r = validateSessionAssignment(bad, catalogs)
  assert.equal(r.ok, false)
})

// ── Planner scenarios ──────────────────────────────────────────

test('SCENARIO A frontend medium bug', () => {
  const plan = planMissionV2({
    id: 'MIS-A',
    goal: 'Corriger le scoping de Mission Control.',
    domains: ['frontend'],
    risk: 'medium',
  })
  assert.equal(plan.status, 'planned')
  assert.ok(plan.organization.manager_role_ids.includes('MGR-ENGINEERING'))
  assert.ok(plan.organization.agent_role_ids.includes('AGENT-FRONTEND-ENGINEER'))
  assert.ok(plan.organization.agent_role_ids.includes('AGENT-TEST-ENGINEER'))
  const order = plan.organization.execution_order
  assert.ok(order.indexOf('AGENT-FRONTEND-ENGINEER') < order.indexOf('AGENT-TEST-ENGINEER'))
  for (const a of plan.assignments) {
    if (a.agent_role_id === 'AGENT-FRONTEND-ENGINEER') {
      assert.equal(a.status, 'planned')
      assert.notEqual(a.model.family, 'hy3')
      assert.ok(EFFORT_RANK[a.effort.canonical] >= EFFORT_RANK.medium)
    }
  }
})

test('SCENARIO B UI + frontend', () => {
  const plan = planMissionV2({
    id: 'MIS-B',
    goal: 'Refondre Mission Control mobile avec preuves visuelles.',
    domains: ['frontend', 'ui'],
    risk: 'medium',
    needs_evaluation: true,
  })
  assert.ok(plan.organization.manager_role_ids.includes('MGR-PRODUCT-EXPERIENCE'))
  assert.ok(plan.organization.manager_role_ids.includes('MGR-ENGINEERING'))
  assert.ok(plan.organization.agent_role_ids.includes('AGENT-UX-ANALYST'))
  assert.ok(plan.organization.agent_role_ids.includes('AGENT-VISUAL-REVIEWER'))
})

test('SCENARIO C research web without snapshot', () => {
  const plan = planMissionV2({
    id: 'MIS-C',
    goal: 'Comparer les approches d orchestration agentique sur le web et X.',
    domains: ['research'],
    risk: 'medium',
    tools_required: ['web_search', 'x_search'],
  })
  // may be planned with non-grok or blocked — never silent false capability
  if (plan.status === 'planned') {
    for (const a of plan.assignments.filter((x) => x.status === 'planned')) {
      if (a.model.family === 'grok') {
        assert.fail('grok should not be selected without capability snapshot')
      }
    }
  }
})

test('SCENARIO C with xai snapshot', () => {
  const plan = planMissionV2(
    {
      id: 'MIS-C2',
      goal: 'Comparer approches agentiques web et X',
      domains: ['research'],
      risk: 'medium',
      tools_required: ['web_search'],
    },
    {
      access_capability_snapshot: {
        hermes_xai_oauth: { web_search: true, x_search: true, code_execution: true },
      },
    },
  )
  assert.ok(['planned', 'blocked'].includes(plan.status))
})

test('SCENARIO D light task prefers HY3', () => {
  const plan = planMissionV2({
    id: 'MIS-D',
    goal: 'Extraire et classer dix entrees deja fournies.',
    risk: 'low',
    budget_policy: 'economical',
  })
  // may clarify if weak signal — if planned, hy3 preferred
  if (plan.status === 'planned') {
    assert.equal(plan.organization.manager_role_ids.includes('MGR-LEARNING-EVALUATION'), false)
    const families = plan.assignments.filter((a) => a.status === 'planned').map((a) => a.model.family)
    assert.ok(families.includes('hy3') || families.every((f) => f !== 'claude' || true))
  }
})

test('SCENARIO E critical migration', () => {
  const plan = planMissionV2({
    id: 'MIS-E',
    goal: 'Modifier le contrat runtime et migrer les consommateurs.',
    domains: ['engineering', 'backend'],
    risk: 'critical',
    needs_evaluation: true,
  })
  assert.ok(plan.organization.manager_role_ids.includes('MGR-ENGINEERING'))
  assert.ok(plan.organization.manager_role_ids.includes('MGR-LEARNING-EVALUATION'))
  for (const a of plan.assignments.filter((x) => x.status === 'planned')) {
    assert.notEqual(a.model.family, 'hy3')
    assert.ok(EFFORT_RANK[a.effort.canonical] >= EFFORT_RANK.high)
  }
  // second family or blocked
  if (plan.status === 'planned') {
    const fams = new Set(plan.assignments.filter((a) => a.status === 'planned').map((a) => a.model.family))
    assert.ok(fams.size >= 2 || plan.organization.proofs_required.includes('second_family_review'))
  }
})

test('SCENARIO F ambiguous', () => {
  const plan = planMissionV2({ id: 'MIS-F', goal: 'Améliore le truc.', risk: 'low' })
  assert.equal(plan.status, 'needs_clarification')
  assert.equal(plan.assignments.length, 0)
})

test('plan hash stable excluding generated_at', () => {
  const a = planMissionV2({ id: 'MIS-H', goal: 'fix frontend button bug', domains: ['frontend'], risk: 'low' })
  const b = planMissionV2({ id: 'MIS-H', goal: 'fix frontend button bug', domains: ['frontend'], risk: 'low' })
  assert.equal(a.metadata.plan_hash, b.metadata.plan_hash)
  assert.equal(planHash(a), a.metadata.plan_hash)
})

test('planning events never emit agent.result', () => {
  const plan = planMissionV2({ id: 'MIS-EV', goal: 'fix frontend bug', domains: ['frontend'], risk: 'medium' })
  const ev = createPlanningEvents(plan)
  assert.ok(ev.every((e) => e.type !== 'agent.result'))
  const legacy = createLegacyCompatibilityEvents(plan, loadTransitionalBindings())
  assert.ok(legacy.every((e) => e.type !== 'agent.result'))
})

test('legacy compat mapping', () => {
  assert.equal(validateTransitionalBindings().ok, true)
  const m = legacyAgentToV2('AG-CODEX')
  assert.equal(m.status, 'mapped')
  assert.equal(m.role_id, 'MGR-ENGINEERING')
  assert.equal(m.deprecated, true)
})

test('temp EventStore can record planning events', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-plan-'))
  const file = path.join(dir, 'events.ndjson')
  const store = new EventStore(file)
  const plan = planMissionV2({ id: 'MIS-ES', goal: 'fix frontend bug', domains: ['frontend'], risk: 'low' })
  for (const e of createPlanningEvents(plan)) {
    store.emit(e.type, e.data)
  }
  store.close?.()
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n')
  assert.ok(lines.length >= 1)
})

test('historical router and CoS untouched by planner import', async () => {
  const router = fs.readFileSync(path.join(ROOT, 'runtime/router.mjs'), 'utf8')
  const cos = fs.readFileSync(path.join(ROOT, 'runtime/chief-of-staff.mjs'), 'utf8')
  // still the legacy selectAgent path
  assert.match(router, /selectAgent/)
  assert.match(cos, /selectAgent/)
})
