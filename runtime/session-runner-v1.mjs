/**
 * session-runner-v1.mjs — execute approved V2 sessions behind feature flag.
 * Never writes mission.closure. Never touches prod ledger/events.ndjson.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { EventStore } from './event-store.mjs'
import { gateExecution } from './execution-gate.mjs'
import { createWorktree, resolveWorktreePath } from './worktree-manager.mjs'
import {
  buildEvidenceBundle,
  runTests,
  recommendClosure,
  redactText,
} from './evidence-collector.mjs'
import * as claudeAdapter from './adapters/claude-code-adapter.mjs'
import * as fakeAdapter from './adapters/fake-test-adapter.mjs'
import { loadAllContracts } from './contracts.mjs'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')

function pickAdapter(assignment, { forceFake = false } = {}) {
  if (forceFake) return fakeAdapter
  if (claudeAdapter.supportsAssignment(assignment)) return claudeAdapter
  return null
}

function buildMandate(plan, assignment) {
  return [
    'You are executing a single Cortex session under a strict mandate.',
    `Mission: ${plan.mission?.goal}`,
    `Role: ${assignment.agent_role_id}`,
    `Workspace: current directory only.`,
    'Allowed: edit files in workspace, run local tests if needed.',
    'Forbidden: git commit, git push, git merge, network exfiltration, reading secrets, leaving workspace.',
    `Effort: ${assignment.effort?.provider || assignment.effort?.canonical}`,
    `Proofs expected: ${(assignment.proofs_expected || []).join(', ') || 'tests'}`,
    'Fix the failing unit in this workspace if present.',
    'Return a final JSON object with keys: status, summary, changed_files, tests_requested, risks, missing_evidence.',
    'Stop when done. Do not ask questions.',
  ].join('\n')
}

/**
 * Success requires:
 * - adapter completed (not truncated/timeout)
 * - tests after green when testCommand provided
 * - if tests before were red, a non-empty diff is required
 */
export function evaluateSessionSuccess({ adapterResult, testsBefore, testsAfter, evidence, expectBugFix = false }) {
  if (!adapterResult || adapterResult.status !== 'completed') {
    return { ok: false, reason: `adapter_${adapterResult?.status || 'missing'}` }
  }
  if (adapterResult.truncated) return { ok: false, reason: 'output_truncated' }
  if (testsAfter && testsAfter.skipped !== true && testsAfter.ok !== true) {
    return { ok: false, reason: 'tests_red_after' }
  }
  const hadRedBefore = testsBefore && testsBefore.skipped !== true && testsBefore.ok === false
  const hasDiff =
    (evidence?.changed_files || []).length > 0 ||
    !!(evidence?.git_diff || '').trim()
  if ((hadRedBefore || expectBugFix) && !hasDiff) {
    return { ok: false, reason: 'empty_diff_on_bugfix' }
  }
  return { ok: true, reason: 'ok' }
}

export async function runSessionV1({
  plan,
  auth,
  sessionId,
  env = process.env,
  argv = process.argv,
  forceFake = false,
  testCommand = null,
  ledgerPath = null,
  baseRef = 'HEAD',
  repoRoot = ROOT,
  copyFixtureFrom = null,
  expectBugFix = false,
  catalogs = null,
}) {
  const events = []
  let store = null
  let workspace = null

  try {
    const assignment = (plan.assignments || []).find((a) => a.session_id === sessionId)
    if (!assignment) {
      return { status: 'blocked', reason: 'assignment_not_found', events }
    }

    const gate = gateExecution({
      env,
      argv,
      plan,
      auth,
      assignment,
      catalogs: catalogs || loadAllContracts(),
    })
    if (!gate.ok) {
      return { status: 'blocked', reason: 'gate_failed', errors: gate.errors, events }
    }

    const adapter = pickAdapter(assignment, { forceFake })
    if (!adapter) {
      return {
        status: 'blocked_adapter_unavailable',
        reason: 'no_adapter_for_assignment',
        assignment_model: assignment.model,
        events,
      }
    }

    const model = assignment.model.variant
    const effort = assignment.effort.provider || assignment.effort.canonical
    const pf = adapter.preflight({ model, effort })
    if (!pf.ok) {
      return {
        status: 'blocked',
        reason: pf.reason,
        preflight: pf,
        events,
      }
    }

    if (ledgerPath) {
      fs.mkdirSync(path.dirname(ledgerPath), { recursive: true })
      store = new EventStore(ledgerPath)
    }
    const push = (type, data) => {
      events.push({ type, data })
      if (store) store.emit(type, data)
    }

    let baseSha = null
    if (auth.scope === 'fixture_only' && copyFixtureFrom) {
      workspace = resolveWorktreePath(plan.mission.id, sessionId)
      if (fs.existsSync(workspace)) {
        return {
          status: 'blocked',
          reason: 'worktree_already_exists',
          workspace,
          events,
        }
      }
      fs.mkdirSync(workspace, { recursive: true })
      copyDir(copyFixtureFrom, workspace)
      try {
        execFileSync('git', ['init'], { cwd: workspace, stdio: 'ignore' })
        execFileSync('git', ['add', '-A'], { cwd: workspace, stdio: 'ignore' })
        execFileSync(
          'git',
          ['-c', 'user.email=cortex@local', '-c', 'user.name=cortex', 'commit', '-m', 'fixture'],
          { cwd: workspace, stdio: 'ignore' },
        )
      } catch {
        /* optional */
      }
      push('worktree.created.v2', {
        mission_id: plan.mission.id,
        session_id: sessionId,
        path: workspace,
        mode: 'fixture_copy',
        executable: true,
      })
    } else {
      try {
        const wt = createWorktree({
          missionId: plan.mission.id,
          sessionId,
          baseRef,
          repoRoot,
        })
        workspace = wt.path
        baseSha = baseRef
        push('worktree.created.v2', {
          mission_id: plan.mission.id,
          session_id: sessionId,
          path: workspace,
          baseRef,
          executable: true,
        })
      } catch (e) {
        if (e.code === 'WORKTREE_EXISTS' || e.message === 'worktree_already_exists') {
          return {
            status: 'blocked',
            reason: 'worktree_already_exists',
            workspace: e.path || null,
            events,
          }
        }
        throw e
      }
    }

    push('session.started.v2', {
      mission_id: plan.mission.id,
      session_id: sessionId,
      agent_role_id: assignment.agent_role_id,
      plan_hash: plan.metadata.plan_hash,
      model_family: assignment.model.family,
      model_variant: assignment.model.variant,
      model_requested: model,
      access_channel: assignment.model.access_channel,
      canonical_effort: assignment.effort.canonical,
      provider_effort: assignment.effort.provider,
    })

    const testsBefore = runTests(workspace, testCommand)
    const mandate = buildMandate(plan, assignment)

    push('adapter.invoked.v2', {
      session_id: sessionId,
      adapter: adapter.adapterId || 'unknown',
      model_requested: model,
      effort,
      // argv without prompt — filled after execute if available
    })

    const adapterResult = await adapter.executeSession({
      cwd: workspace,
      model,
      effort,
      prompt: mandate,
    })

    // strip any accidental prompt leakage from audit
    const argvAudit = (adapterResult.argv_audit || adapterResult.argv || []).filter(
      (x) => typeof x === 'string' && !x.includes('You are executing a single Cortex'),
    )
    // ensure mandate text not in evidence argv
    adapterResult.argv_audit = argvAudit
    adapterResult.argv = argvAudit
    if (adapterResult.stdout_redacted?.includes(mandate.slice(0, 40))) {
      adapterResult.stdout_redacted = redactText(adapterResult.stdout_redacted)
    }

    push('adapter.completed.v2', {
      session_id: sessionId,
      status: adapterResult.status,
      exit_code: adapterResult.exit_code,
      duration_ms: adapterResult.duration_ms,
      model_requested: adapterResult.model_requested,
      model_applied: adapterResult.model_applied,
      effort_applied: adapterResult.effort_applied,
      truncated: !!adapterResult.truncated,
      argv_audit: argvAudit,
    })

    const testsAfter = runTests(workspace, testCommand)
    const evidence = buildEvidenceBundle({
      plan,
      assignment,
      workspace,
      adapterResult: {
        ...adapterResult,
        argv: argvAudit,
      },
      testsBefore,
      testsAfter,
      baseSha,
    })
    // never store prompt in evidence
    delete evidence.prompt
    delete evidence.mandate

    push('evidence.collected.v2', {
      session_id: sessionId,
      changed_files: evidence.changed_files,
      tests_before_ok: testsBefore?.ok ?? null,
      tests_after_ok: testsAfter?.ok ?? null,
      plan_hash: evidence.plan_hash,
      model_requested: evidence.model_requested,
      model_applied: evidence.model_applied,
    })

    const success = evaluateSessionSuccess({
      adapterResult,
      testsBefore,
      testsAfter,
      evidence,
      expectBugFix: expectBugFix || auth.scope === 'fixture_only',
    })
    const closure_recommendation = recommendClosure(evidence)

    if (success.ok) {
      push('session.succeeded.v2', {
        session_id: sessionId,
        adapter_status: adapterResult.status,
        closure_recommendation: closure_recommendation.recommendation,
        note: 'no mission.closure emitted by runner',
      })
    } else {
      push('session.failed.v2', {
        session_id: sessionId,
        adapter_status: adapterResult.status,
        reason: success.reason,
        closure_recommendation: closure_recommendation.recommendation,
        note: 'no mission.closure emitted by runner',
      })
    }

    return {
      status: success.ok ? 'succeeded' : 'failed',
      fail_reason: success.ok ? null : success.reason,
      workspace,
      evidence,
      closure_recommendation,
      events,
      adapterResult: {
        ...adapterResult,
        argv: argvAudit,
        argv_audit: argvAudit,
        stdout_redacted: redactText(adapterResult.stdout_redacted || ''),
        stderr_redacted: redactText(adapterResult.stderr_redacted || ''),
      },
    }
  } finally {
    try {
      store?.close?.()
    } catch {
      /* ignore */
    }
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name)
    const d = path.join(dest, ent.name)
    if (ent.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}
