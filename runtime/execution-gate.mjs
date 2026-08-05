/**
 * execution-gate.mjs — double gate + authorization checks (pure).
 */
import crypto from 'node:crypto'
import { planHash } from './mission-planner-v2.mjs'

export function checkFeatureFlag(env = process.env) {
  return env.CORTEX_SESSION_RUNNER_V1 === '1'
}

export function checkExecuteFlag(argv = process.argv) {
  return argv.includes('--execute')
}

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
  if (!['fixture_only', 'worktree'].includes(auth.scope)) errors.push('bad_scope')
  if (!auth.approved_by) errors.push('approved_by_missing')
  if (auth.scope === 'worktree' && auth.approved_by !== 'boss' && auth.approved_by !== 'test_fixture') {
    // real worktree requires boss; fixture allows test_fixture
    if (auth.approved_by !== 'boss') errors.push('worktree_requires_boss')
  }
  if (auth.expires_at) {
    const exp = Date.parse(auth.expires_at)
    if (Number.isFinite(exp) && exp < now) errors.push('auth_expired')
  }
  if (auth.allow_commit === true) errors.push('allow_commit_forbidden_v1')
  if (auth.allow_push === true) errors.push('allow_push_forbidden_v1')
  if (auth.allow_merge === true) errors.push('allow_merge_forbidden_v1')
  return { ok: errors.length === 0, errors }
}

export function assertPlanExecutable(plan) {
  const errors = []
  if (!plan) errors.push('plan_missing')
  else {
    if (plan.status !== 'planned') errors.push(`plan_status_${plan.status}`)
    if (plan.organization?.status !== 'ok') errors.push(`org_status_${plan.organization?.status}`)
    if (plan.mode !== 'shadow' && plan.mode !== 'execute') {
      // shadow plans can be executed under runner with auth — mode stays shadow
    }
  }
  return { ok: errors.length === 0, errors }
}

export function gateExecution({ env, argv, plan, auth, assignment }) {
  const errors = []
  if (!checkFeatureFlag(env)) errors.push('feature_flag_off')
  if (!checkExecuteFlag(argv)) errors.push('execute_flag_missing')
  const pe = assertPlanExecutable(plan)
  if (!pe.ok) errors.push(...pe.errors)
  const ae = validateAuthorization(auth, plan)
  if (!ae.ok) errors.push(...ae.errors)
  if (assignment) {
    if (assignment.status !== 'planned') errors.push('assignment_not_planned')
    if (auth && !auth.assignment_session_ids?.includes(assignment.session_id)) {
      errors.push('assignment_not_authorized')
    }
  }
  // recalc hash
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
  }
  return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex').slice(0, 12)
}
