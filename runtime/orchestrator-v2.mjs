/**
 * orchestrator-v2.mjs — flux Mission Planner V2 + Session Runner V1 derrière
 * CORTEX_ORCHESTRATION_V2=1.
 *
 * Hermes request
 *   → MissionPlanV2 (adapter_snapshot si fourni)
 *   → 1 assignment réel (Claude adapter uniquement)
 *   → Session Runner V1
 *   → événements V2 dans le ledger
 *   → projection Cortex Lab (mission-projection)
 *
 * Aucune closure automatique. Un seul assignment réel au départ.
 */
import { planMissionV2, planHash, validateMissionPlanV2 } from './mission-planner-v2.mjs'
import { createPlanningEvents } from './orchestration-events.mjs'
import { runSessionV1 } from './session-runner-v1.mjs'
import { loadAllContracts } from './contracts.mjs'

export function isV2Enabled(env = process.env) {
  return env.CORTEX_ORCHESTRATION_V2 === '1'
}

/**
 * @param {object} request
 *   mission: { id, goal, domains, risk, context_required }
 *   adapter_snapshot: { installed_access_channels: [...] } (optionnel)
 *   max_assignments: 1 (forcé)
 *   auth: ExecutionAuthorization (boss) — requis pour exécuter
 *   baseRef / repoRoot / ledgerPath
 * @returns {object} { plan, plan_hash, events_v2, session_result|null }
 */
export async function runOrchestrationV2(request = {}, { env = process.env, argv = process.argv } = {}) {
  if (!isV2Enabled(env)) {
    return { enabled: false }
  }
  const {
    mission,
    adapter_snapshot = null,
    auth = null,
    baseRef = null,
    repoRoot = null,
    ledgerPath = null,
    expectBugFix = false,
    targetedTestCommand = null,
    forceFake = false,
  } = request

  const plan = planMissionV2(mission, {
    adapter_snapshot,
    max_assignments: 1,
    // un seul assignment réel : on prend le premier planifiable
  })

  const planHashValue = planHash(plan)
  const vr = validateMissionPlanV2(plan, loadAllContracts())
  const planningEvents = createPlanningEvents(plan)

  // Pas d'exécution sans auth valide (execution-gate le refusera de toute façon)
  let sessionResult = null
  let sessionEvents = []
  if (auth && plan.status === 'planned') {
    const assignment = plan.assignments.find((a) => a.status === 'planned')
    if (!assignment) {
      return {
        enabled: true,
        plan,
        plan_hash: planHashValue,
        executable: false,
        events_v2: planningEvents,
        reason: 'no_planned_assignment',
      }
    }
    const r = await runSessionV1({
      plan,
      auth,
      sessionId: assignment.session_id,
      // Le Session Runner a son propre feature flag ; on l'active ici car le
      // flux V2 en est l'unique appelant autorisé.
      env: { ...env, CORTEX_SESSION_RUNNER_V1: '1' },
      argv: [...argv, '--execute'],
      forceFake: false,
      ledgerPath,
      baseRef,
      repoRoot,
      expectBugFix,
      targetedTestCommand,
      forceFake,
      // Claude adapter uniquement (le planner V2 avec adapter_snapshot claude_code_subscription
      // ne produit que des assignments Claude ; le runner refuse sinon).
    })
    sessionResult = r
    sessionEvents = r.events || []
    return {
      enabled: true,
      plan,
      plan_hash: planHashValue,
      executable: true,
      validation: vr,
      events_v2: [...planningEvents, ...sessionEvents],
      session_result: {
        status: r.status,
        fail_reason: r.fail_reason || null,
        workspace: r.workspace,
        closure_recommendation: r.closure_recommendation,
      },
    }
  }

  return {
    enabled: true,
    plan,
    plan_hash: planHashValue,
    executable: Boolean(auth),
    validation: vr,
    events_v2: planningEvents,
    note: 'no execution without auth (CORTEX_ORCHESTRATION_V2 requires explicit boss authorization)',
  }
}
