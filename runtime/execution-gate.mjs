/**
 * execution-gate.mjs — double gate + authorization checks (pure).
 */
import crypto from 'node:crypto'
import { planHash, validateMissionPlanV2 } from './mission-planner-v2.mjs'
import { loadAllContracts } from './contracts.mjs'

export function checkFeatureFlag(env = process.env) {
  return env.CORTEX_SESSION_RUNNER_V1 === '1'
}

export function checkExecuteFlag(argv = process.argv) {
  return argv.includes('--execute')
}

const SCOPES = new Set(['fixture_only', 'worktree', 'worktree_resume'])

/**
 * worktree / worktree_resume require approved_by=boss.
 * fixture_only may use test_fixture.
 * expires_at mandatory.
 * worktree_resume requires resume_from_session_id, workspace_state_hash,
 * authorization_id, nonce.
 */
export function validateAuthorization(auth, plan, { now = Date.now() } = {}) {
  const errors = []
  if (!auth || typeof auth !== 'object') return { ok: false, errors: ['auth_missing'] }
  if (auth.mission_id !== plan.mission?.id) errors.push('mission_id_mismatch')
  if (auth.plan_hash !== plan.metadata?.plan_hash) errors.push('plan_hash_mismatch')
  const recalc = planHash(plan)
  if (auth.plan_hash !== recalc) errors.push('plan_hash_recalc_mismatch')
  if (!Array.isArray(auth.assignment_session_ids) || !auth.assignment_session_ids.length) {
    errors.push('no_sessions')
  }
  if (!SCOPES.has(auth.scope)) errors.push('bad_scope')
  if (!auth.approved_by) errors.push('approved_by_missing')
  if ((auth.scope === 'worktree' || auth.scope === 'worktree_resume') && auth.approved_by !== 'boss') {
    errors.push('worktree_requires_boss')
  }
  if (auth.scope === 'fixture_only' && !['test_fixture', 'boss'].includes(auth.approved_by)) {
    errors.push('fixture_requires_test_fixture_or_boss')
  }
  if (auth.scope === 'worktree_resume') {
    if (!auth.resume_from_session_id) errors.push('resume_from_session_id_required')
    else if (!auth.assignment_session_ids.includes(auth.resume_from_session_id)) {
      errors.push('resume_session_not_authorized')
    }
    if (!auth.workspace_state_hash) errors.push('workspace_state_hash_required')
    if (!auth.authorization_id) errors.push('authorization_id_required')
    if (!auth.nonce) errors.push('nonce_required')
    if (!auth.worktree_path && !auth.resume_from_session_id) errors.push('worktree_path_required')
  }
  if (!auth.expires_at) {
    errors.push('expires_at_required')
  } else {
    const exp = Date.parse(auth.expires_at)
    if (!Number.isFinite(exp)) errors.push('expires_at_invalid')
    else if (exp < now) errors.push('auth_expired')
  }
  if (auth.allow_commit === true) errors.push('allow_commit_forbidden_v1')
  if (auth.allow_push === true) errors.push('allow_push_forbidden_v1')
  if (auth.allow_merge === true) errors.push('allow_merge_forbidden_v1')
  return { ok: errors.length === 0, errors }
}

export function assertPlanExecutable(plan, catalogs = null) {
  const errors = []
  if (!plan) errors.push('plan_missing')
  else {
    if (plan.status !== 'planned') errors.push(`plan_status_${plan.status}`)
    if (plan.organization?.status !== 'ok') errors.push(`org_status_${plan.organization?.status}`)
    try {
      const cats = catalogs || loadAllContracts()
      const vr = validateMissionPlanV2(plan, cats)
      if (!vr.ok) errors.push(...vr.errors.map((e) => `plan_validation:${e}`))
    } catch (e) {
      errors.push(`plan_validation_threw:${e.message || e}`)
    }
  }
  return { ok: errors.length === 0, errors }
}

export function gateExecution({ env, argv, plan, auth, assignment, catalogs = null }) {
  const errors = []
  if (!checkFeatureFlag(env)) errors.push('feature_flag_off')
  if (!checkExecuteFlag(argv)) errors.push('execute_flag_missing')
  const pe = assertPlanExecutable(plan, catalogs)
  if (!pe.ok) errors.push(...pe.errors)
  const ae = validateAuthorization(auth, plan)
  if (!ae.ok) errors.push(...ae.errors)
  if (assignment) {
    if (assignment.status !== 'planned') errors.push('assignment_not_planned')
    if (auth && !auth.assignment_session_ids?.includes(assignment.session_id)) {
      errors.push('assignment_not_authorized')
    }
    if (
      auth?.scope === 'worktree_resume' &&
      auth.resume_from_session_id &&
      auth.resume_from_session_id !== assignment.session_id
    ) {
      errors.push('resume_session_mismatch')
    }
  }
  if (plan?.metadata?.plan_hash && planHash(plan) !== plan.metadata.plan_hash) {
    errors.push('plan_tampered')
  }
  return { ok: errors.length === 0, errors }
}

export function authFingerprint(auth) {
  const stable = {
    mission_id: auth.mission_id,
    plan_hash: auth.plan_hash,
    sessions: [...(auth.assignment_session_ids || [])].sort(),
    scope: auth.scope,
    approved_by: auth.approved_by,
    authorization_id: auth.authorization_id || null,
    nonce: auth.nonce || null,
    resume_from_session_id: auth.resume_from_session_id || null,
    workspace_state_hash: auth.workspace_state_hash || null,
  }
  return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex').slice(0, 12)
}
