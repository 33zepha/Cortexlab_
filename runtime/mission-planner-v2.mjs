/**
 * mission-planner-v2.mjs — shadow planner (no model execution, no CoS authority).
 */
import crypto from 'node:crypto'
import { routeOrganization, buildRoleAssignments, loadRoles } from './organization-router.mjs'
import { selectModel, loadRoleProfiles } from './model-selector.mjs'
import {
  loadModelCatalog,
  catalogSnapshotHash,
  CANONICAL_EFFORTS,
} from './model-catalog.mjs'
import { loadAllContracts, validateSessionAssignment } from './contracts.mjs'

export const PLANNER_VERSION = '2.0.0-shadow'

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
  if (!['low', 'medium', 'high', 'critical'].includes(input.risk || 'medium')) {
    errors.push('invalid risk')
  }
  if (input.preferred_effort && !CANONICAL_EFFORTS.includes(input.preferred_effort)) {
    errors.push('preferred_effort non_canonical')
  }
  return { ok: errors.length === 0, errors }
}

/**
 * planMissionV2(missionInput, options)
 */
export function planMissionV2(missionInput = {}, options = {}) {
  const {
    quota_snapshot = {},
    access_capability_snapshot = {},
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
      metadata: meta(modelDoc, now),
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
      metadata: meta(modelDoc, now),
      status: 'needs_clarification',
    }
    plan.metadata.plan_hash = planHash(plan)
    return plan
  }

  const stubs = buildRoleAssignments(org, missionInput.id)
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
          rejected_alternatives: sel.rejected_alternatives || [],
          fallback_chain: [],
        },
        requirements: {
          capabilities: stub.role_profile?.required_capabilities || [],
          context: missionInput.context_required || 0,
          tools: missionInput.tools_required || [],
          modalities: missionInput.modalities || [],
        },
        budget: defaultBudget(missionInput),
        proofs_expected: org.proofs_required || [],
        status: 'unassigned',
        order: stub.order,
      })
      continue
    }

    const assignment = {
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
        requested: sel.canonical_effort,
        canonical: sel.canonical_effort,
        provider: sel.provider_effort,
        semantics: sel.effort_semantics,
        mapping_reason: sel.effort_mapping_reason,
        minimum: sel.minimum_effort,
      },
      selection: {
        reason: sel.selection_reason,
        confidence: sel.confidence,
        rejected_alternatives: sel.rejected_alternatives,
        fallback_chain: sel.fallback_chain,
        chosen_score: sel.chosen_score,
      },
      requirements: {
        capabilities: stub.role_profile?.required_capabilities || [],
        context: missionInput.context_required || 0,
        tools: missionInput.tools_required || [],
        modalities: missionInput.modalities || [],
      },
      budget: defaultBudget(missionInput),
      proofs_expected: org.proofs_required || [],
      status: 'planned',
      order: stub.order,
    }

    // validate as session assignment shape (effort nested → flatten for validator)
    const flat = {
      ...assignment,
      effort: assignment.effort.canonical,
      effort_requested: assignment.effort.requested,
      effort_actual: assignment.effort.canonical,
      provider_effort: assignment.effort.provider,
      model: {
        family: assignment.model.family,
        variant: assignment.model.variant,
        access_channel: assignment.model.access_channel,
        provider: assignment.model.access_channel,
      },
    }
    const vr = validateSessionAssignment(flat, catalogs)
    if (!vr.ok) {
      blocked = true
      blockReasons.push(`${stub.agent_role_id}:validation:${vr.errors.join(',')}`)
      assignment.status = 'unassigned'
      assignment.selection.validation_errors = vr.errors
    }
    assignments.push(assignment)
  }

  // critical: require second family among assigned if proof demands
  if (
    (missionInput.risk === 'critical' || (org.proofs_required || []).includes('second_family_review')) &&
    !blocked
  ) {
    const families = new Set(
      assignments.filter((a) => a.status === 'planned').map((a) => a.model?.family).filter(Boolean),
    )
    if (families.size < 2) {
      blocked = true
      blockReasons.push('critical_requires_second_family')
    }
  }

  const orgOut = {
    ...org,
    status: blocked ? 'blocked' : org.status,
    block_reasons: blocked ? blockReasons : [],
  }

  const plan = {
    schema_version: 2,
    kind: 'mission_plan',
    mode: 'shadow',
    mission: normalizeMission(missionInput),
    organization: orgOut,
    assignments,
    metadata: meta(modelDoc, now),
    status: blocked ? 'blocked' : 'planned',
  }
  plan.metadata.plan_hash = planHash(plan)
  return plan
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
    needs_evaluation: !!input.needs_evaluation,
    needs_pedagogy: !!input.needs_pedagogy,
  }
}

function defaultBudget(input) {
  const risk = input.risk || 'medium'
  const base = { low: 40, medium: 80, high: 160, critical: 240 }
  return {
    token_limit: (base[risk] || 80) * 1000,
    time_limit_minutes: risk === 'critical' ? 90 : risk === 'high' ? 60 : 40,
    retry_limit: risk === 'critical' ? 2 : 1,
    correction_limit: risk === 'critical' ? 3 : 2,
  }
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
