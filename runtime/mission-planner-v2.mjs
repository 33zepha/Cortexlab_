/**
 * mission-planner-v2.mjs — shadow planner with budgets, reviews, full validation.
 */
import crypto from 'node:crypto'
import {
  routeOrganization,
  buildRoleAssignments,
  topologicalSortAgents,
} from './organization-router.mjs'
import { selectModel, loadRoleProfiles } from './model-selector.mjs'
import { catalogSnapshotHash, CANONICAL_EFFORTS } from './model-catalog.mjs'
import {
  loadAllContracts,
  validateSessionAssignment,
  normalizeLegacySessionAssignment,
} from './contracts.mjs'

export const PLANNER_VERSION = '2.1.0-shadow'

function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

export function planHash(plan) {
  const clone = structuredClone(plan)
  if (clone.metadata) {
    delete clone.metadata.generated_at
    delete clone.metadata.plan_hash
  }
  return crypto.createHash('sha256').update(stableStringify(clone)).digest('hex').slice(0, 16)
}

export function validateMissionInput(input = {}) {
  const errors = []
  if (!input.id || !/^MIS-/.test(input.id)) errors.push('mission.id must be MIS-*')
  if (!input.goal || !String(input.goal).trim()) errors.push('mission.goal required')
  if (!['low', 'medium', 'high', 'critical'].includes(input.risk || 'medium')) errors.push('invalid risk')
  if (input.preferred_effort && !CANONICAL_EFFORTS.includes(input.preferred_effort)) {
    errors.push('preferred_effort non_canonical')
  }
  return { ok: errors.length === 0, errors }
}

function meta(modelDoc, now) {
  return {
    planner_version: PLANNER_VERSION,
    role_catalog_version: 1,
    model_catalog_version: modelDoc.schema_version,
    effort_catalog_version: 2,
    discovery_proof: modelDoc.discovery_proof || null,
    access_proof: modelDoc.access_proof || null,
    catalog_snapshot_hash: catalogSnapshotHash(modelDoc),
    generated_at: typeof now === 'function' ? now() : now,
  }
}

function normalizeMission(input) {
  return {
    id: input.id,
    goal: input.goal,
    domains: input.domains || [],
    risk: input.risk || 'medium',
    context_required: input.context_required || 0,
    tools_required: input.tools_required || [],
    modalities: input.modalities || [],
    budget_policy: input.budget_policy || 'balanced',
    latency_preference: input.latency_preference || 'normal',
    preferred_effort: input.preferred_effort || null,
    needs_evaluation: !!input.needs_evaluation,
    needs_pedagogy: !!input.needs_pedagogy,
  }
}

function missionBudgetFor(risk) {
  const tokens = { low: 80000, medium: 160000, high: 320000, critical: 480000 }
  const time = { low: 30, medium: 45, high: 75, critical: 120 }
  return {
    token_limit: tokens[risk] || 160000,
    time_limit_minutes: time[risk] || 45,
    retry_limit_total: risk === 'critical' ? 4 : 2,
    correction_limit_total: risk === 'critical' ? 4 : 2,
    allocation_policy: 'weighted_with_reserve',
    reserved_percent: 15,
  }
}

function weightFor(agentId, roleProfiles) {
  const t = roleProfiles[agentId]?.model_requirements?.task_profile || ''
  if (['architecture', 'implementation', 'security'].includes(t)) return 3
  if (['code', 'debug', 'visual_review', 'evidence_audit', 'ux_analysis', 'interface_design'].includes(t)) return 2
  return 1
}

function allocateBudgets(assignments, missionBudget, roleProfiles) {
  const reserve = Math.floor(missionBudget.token_limit * (missionBudget.reserved_percent / 100))
  const pool = missionBudget.token_limit - reserve
  const plannedIdx = assignments
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.status === 'planned')
  const weights = plannedIdx.map(({ a }) => weightFor(a.agent_role_id, roleProfiles))
  const sumW = weights.reduce((x, y) => x + y, 0) || 1
  let allocated = 0
  plannedIdx.forEach(({ a }, j) => {
    const share = Math.max(5000, Math.floor((pool * weights[j]) / sumW))
    allocated += share
    a.budget = {
      token_limit: share,
      time_limit_minutes: missionBudget.time_limit_minutes,
      retry_limit: 1,
      correction_limit: 1,
      allocation_reason: `weight_${weights[j]}_of_${sumW}`,
    }
  })
  for (const a of assignments) {
    if (!a.budget) {
      a.budget = {
        token_limit: 0,
        time_limit_minutes: 0,
        retry_limit: 0,
        correction_limit: 0,
        allocation_reason: 'unassigned',
      }
    }
  }
  return {
    ...missionBudget,
    allocated_tokens: allocated,
    unallocated_tokens: missionBudget.token_limit - allocated,
    reserve_tokens: reserve,
  }
}

function buildReviews(assignments, org, risk) {
  if (risk !== 'critical' && !(org.proofs_required || []).includes('second_family_review')) {
    return { reviews: [], extraDeps: [], block: null }
  }
  const planned = assignments.filter((a) => a.status === 'planned' && a.model)
  const producers = planned.filter((a) =>
    ['AGENT-ARCHITECTURE', 'AGENT-FRONTEND-ENGINEER', 'AGENT-BACKEND-ENGINEER', 'AGENT-DEBUGGING'].includes(
      a.agent_role_id,
    ),
  )
  if (!producers.length && planned.length) producers.push(planned[0])
  const reviews = []
  const extraDeps = []
  for (const p of producers) {
    const reviewer = planned.find(
      (a) =>
        a.session_id !== p.session_id &&
        a.model?.family &&
        a.model.family !== p.model.family &&
        [
          'AGENT-SECURITY-REVIEWER',
          'AGENT-EVIDENCE-AUDITOR',
          'AGENT-TEST-ENGINEER',
        ].includes(a.agent_role_id),
    )
    if (!reviewer) {
      return { reviews: [], extraDeps: [], block: `no_second_family_reviewer_for_${p.agent_role_id}` }
    }
    reviews.push({
      producer_assignment_id: p.session_id,
      reviewer_assignment_id: reviewer.session_id,
      subject: p.agent_role_id,
      required_different_family: true,
      status: 'planned',
      evidence_required: ['diff_review', 'rationale'],
      producer_family: p.model.family,
      reviewer_family: reviewer.model.family,
    })
    extraDeps.push({ before: p.agent_role_id, after: reviewer.agent_role_id })
    if ((org.agent_role_ids || []).includes('AGENT-MISSION-EVALUATOR')) {
      extraDeps.push({ before: reviewer.agent_role_id, after: 'AGENT-MISSION-EVALUATOR' })
    }
  }
  return { reviews, extraDeps, block: null }
}

export function validateMissionPlanV2(plan, catalogs) {
  const errors = []
  if (plan.kind !== 'mission_plan') errors.push('kind')
  if (plan.mode !== 'shadow') errors.push('mode')
  if (plan.schema_version !== 2) errors.push('schema_version')
  if (!plan.metadata?.catalog_snapshot_hash) errors.push('missing catalog_snapshot_hash')
  if (plan.status === 'invalid_input') {
    if (plan.metadata?.hash_status !== 'unavailable_due_to_invalid_input') {
      errors.push('invalid_input_needs_hash_status')
    }
    return { ok: errors.length === 0, errors }
  }
  if (!plan.metadata?.plan_hash) errors.push('missing plan_hash')
  else if (planHash(plan) !== plan.metadata.plan_hash) errors.push('plan_hash_mismatch')

  const mb = plan.mission_budget
  if (mb) {
    const sum = (plan.assignments || [])
      .filter((a) => a.status === 'planned')
      .reduce((s, a) => s + (a.budget?.token_limit || 0), 0)
    if (sum > mb.token_limit) errors.push(`budget_overallocated ${sum}>${mb.token_limit}`)
  }

  for (const a of plan.assignments || []) {
    if (a.status === 'planned') {
      if (!a.model?.family || !a.model?.variant || !a.model?.access_channel) {
        errors.push(`planned_missing_model ${a.agent_role_id}`)
      }
      if (a.effort?.requested == null || a.effort?.canonical == null || a.effort?.provider == null) {
        errors.push(`planned_missing_effort ${a.agent_role_id}`)
      }
      const flat = normalizeLegacySessionAssignment(a)
      const vr = validateSessionAssignment(flat, catalogs)
      if (!vr.ok) errors.push(`assignment_invalid ${a.agent_role_id}:${vr.errors.join(',')}`)
    }
    if (a.status === 'unassigned' && a.model?.variant) errors.push(`unassigned_has_model ${a.agent_role_id}`)
    if (/AG-/.test(a.agent_role_id || '') || /AG-/.test(a.manager_id || '')) {
      errors.push('legacy_ag_id_in_v2_plan')
    }
  }
  for (const r of plan.reviews || []) {
    if (r.required_different_family && r.producer_family === r.reviewer_family) {
      errors.push('review_same_family')
    }
  }
  const raw = JSON.stringify(plan)
  if (/sk-[a-zA-Z0-9]{10,}/.test(raw) || /ghp_/.test(raw)) errors.push('secret_like_content')
  if (/\/root\/\.hermes\/auth/.test(raw)) errors.push('private_path')
  return { ok: errors.length === 0, errors }
}

export function planMissionV2(missionInput = {}, options = {}) {
  const {
    quota_snapshot = {},
    access_capability_snapshot = {},
    adapter_snapshot = null,
    max_assignments = null,
    base_commit_sha = null,
    now = () => new Date().toISOString(),
  } = options

  const catalogs = loadAllContracts()
  const modelDoc = catalogs.models
  const rolesDoc = catalogs.roles
  const roleProfiles = loadRoleProfiles()

  const v = validateMissionInput(missionInput)
  if (!v.ok) {
    return {
      schema_version: 2,
      kind: 'mission_plan',
      mode: 'shadow',
      mission: missionInput,
      organization: {
        status: 'invalid_input',
        manager_role_ids: [],
        agent_role_ids: [],
        agent_manager_map: {},
        dependencies: [],
        execution_order: [],
        proofs_required: [],
        rationale: v.errors,
        clarification_questions: [],
      },
      assignments: [],
      reviews: [],
      mission_budget: null,
      metadata: {
        ...meta(modelDoc, now),
        hash_status: 'unavailable_due_to_invalid_input',
        plan_hash: null,
      },
      status: 'invalid_input',
    }
  }

  const org = routeOrganization(
    {
      goal: missionInput.goal,
      domains: missionInput.domains || [],
      risk: missionInput.risk || 'medium',
      needs_evaluation: !!missionInput.needs_evaluation,
      needs_pedagogy: !!missionInput.needs_pedagogy,
      context_required: missionInput.context_required || 0,
    },
    rolesDoc,
  )

  if (org.status === 'needs_clarification') {
    const plan = {
      schema_version: 2,
      kind: 'mission_plan',
      mode: 'shadow',
      mission: normalizeMission(missionInput),
      organization: org,
      assignments: [],
      reviews: [],
      mission_budget: missionBudgetFor(missionInput.risk || 'medium'),
      metadata: meta(modelDoc, now),
      status: 'needs_clarification',
    }
    plan.metadata.plan_hash = planHash(plan)
    return plan
  }

  const stubsAll = buildRoleAssignments(org, missionInput.id)
  let stubs = stubsAll
  if (max_assignments != null && Number(max_assignments) > 0 && stubs.length > Number(max_assignments)) {
    const prefer = [
      'AGENT-FRONTEND-ENGINEER',
      'AGENT-BACKEND-ENGINEER',
      'AGENT-DEBUGGING',
      'AGENT-ARCHITECTURE',
    ]
    const ranked = [...stubs].sort((a, b) => {
      const ia = prefer.indexOf(a.agent_role_id)
      const ib = prefer.indexOf(b.agent_role_id)
      const sa = ia === -1 ? 99 : ia
      const sb = ib === -1 ? 99 : ib
      return sa - sb || a.order - b.order
    })
    stubs = ranked.slice(0, Number(max_assignments)).map((s, i) => ({ ...s, order: i }))
    org.agent_role_ids = stubs.map((s) => s.agent_role_id)
    org.execution_order = stubs.map((s) => s.agent_role_id)
    org.agent_manager_map = Object.fromEntries(
      stubs.map((s) => [s.agent_role_id, s.manager_id]),
    )
    org.manager_role_ids = [...new Set(stubs.map((s) => s.manager_id))]
    org.rationale = [
      ...(org.rationale || []),
      `max_assignments=${max_assignments} kept ${org.agent_role_ids.join(',')}`,
    ]
  }
  const assignments = []
  let blocked = false
  const blockReasons = []

  for (const stub of stubs) {
    const sel = selectModel(
      {
        agent_role_id: stub.agent_role_id,
        risk: missionInput.risk || 'medium',
        context_required: missionInput.context_required || 0,
        tools_required: missionInput.tools_required || [],
        modalities: missionInput.modalities || [],
        preferred_effort: missionInput.preferred_effort || null,
        quota_snapshot,
        access_capability_snapshot,
        adapter_snapshot,
        latency_preference: missionInput.latency_preference || 'normal',
        budget_policy: missionInput.budget_policy || 'balanced',
      },
      modelDoc,
      roleProfiles,
    )

    const sessionId = `ses_${missionInput.id}_${stub.order}_${stub.agent_role_id}`.replace(
      /[^A-Za-z0-9_.:-]/g,
      '_',
    )

    if (sel.status === 'unassigned') {
      blocked = true
      blockReasons.push(`${stub.agent_role_id}:${sel.reason}`)
      assignments.push({
        mission_id: missionInput.id,
        manager_id: stub.manager_id,
        agent_role_id: stub.agent_role_id,
        session_id: sessionId,
        role_profile: stub.role_profile,
        model: null,
        effort: null,
        selection: {
          reason: sel.reason,
          confidence: 0,
          chosen_score: 0,
          rejected_alternatives: sel.rejected_alternatives || [],
          fallback_chain: [],
        },
        requirements: {
          capabilities: stub.role_profile?.required_capabilities || [],
          tools: missionInput.tools_required || [],
          modalities: missionInput.modalities || [],
          context: missionInput.context_required || 0,
        },
        budget: null,
        proofs_expected: org.proofs_required || [],
        status: 'unassigned',
        order: stub.order,
      })
      continue
    }

    assignments.push({
      mission_id: missionInput.id,
      manager_id: stub.manager_id,
      agent_role_id: stub.agent_role_id,
      session_id: sessionId,
      role_profile: stub.role_profile,
      model: {
        family: sel.family_id,
        variant: sel.variant_id,
        access_channel: sel.access_channel,
      },
      effort: {
        requested: sel.requested_effort,
        minimum: sel.minimum_effort,
        canonical: sel.canonical_effort,
        provider: sel.provider_effort,
        semantics: sel.effort_semantics,
        mapping_reason: sel.effort_mapping_reason,
        decision: sel.effort_decision || { kind: 'direct', approved_by: 'selector', reason: 'direct' },
      },
      selection: {
        reason: sel.selection_reason,
        confidence: sel.confidence,
        chosen_score: sel.chosen_score,
        rejected_alternatives: sel.rejected_alternatives,
        fallback_chain: sel.fallback_chain,
      },
      requirements: {
        capabilities: stub.role_profile?.required_capabilities || [],
        tools: missionInput.tools_required || [],
        modalities: missionInput.modalities || [],
        context: missionInput.context_required || 0,
      },
      budget: null,
      proofs_expected: org.proofs_required || [],
      status: 'planned',
      order: stub.order,
    })
  }

  const risk = missionInput.risk || 'medium'
  const mission_budget = allocateBudgets(assignments, missionBudgetFor(risk), roleProfiles)

  const { reviews, extraDeps, block } = buildReviews(assignments, org, risk)
  if (block) {
    blocked = true
    blockReasons.push(block)
  }
  if (extraDeps.length) {
    org.dependencies = [...(org.dependencies || []), ...extraDeps]
    try {
      org.execution_order = topologicalSortAgents(org.agent_role_ids, org.dependencies)
    } catch {
      blocked = true
      blockReasons.push('review_dependency_cycle')
    }
  }

  for (const a of assignments) {
    if (a.status !== 'planned') continue
    const flat = normalizeLegacySessionAssignment(a)
    const vr = validateSessionAssignment(flat, catalogs)
    if (!vr.ok) {
      blocked = true
      blockReasons.push(`${a.agent_role_id}:validation:${vr.errors.join(',')}`)
      a.status = 'unassigned'
      a.selection.validation_errors = vr.errors
      a.model = null
      a.effort = null
    }
  }

  const plan = {
    schema_version: 2,
    kind: 'mission_plan',
    mode: 'shadow',
    mission: normalizeMission(missionInput),
    organization: {
      ...org,
      status: blocked ? 'blocked' : org.status,
      block_reasons: blocked ? blockReasons : [],
    },
    assignments,
    reviews,
    mission_budget,
    metadata: {
      ...meta(modelDoc, now),
      adapter_snapshot: adapter_snapshot || null,
      base_commit_sha: base_commit_sha || null,
      max_assignments: max_assignments ?? null,
    },
    status: blocked ? 'blocked' : 'planned',
  }
  plan.metadata.plan_hash = planHash(plan)

  const full = validateMissionPlanV2(plan, catalogs)
  if (!full.ok && plan.status === 'planned') {
    plan.status = 'blocked'
    plan.organization.status = 'blocked'
    plan.organization.block_reasons = [
      ...(plan.organization.block_reasons || []),
      ...full.errors.map((e) => `plan_validation:${e}`),
    ]
    plan.metadata.plan_hash = planHash(plan)
  }
  return plan
}
