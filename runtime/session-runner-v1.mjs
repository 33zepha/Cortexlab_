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
    'Return a final JSON object with keys: status, summary, changed_files, tests_requested, risks, missing_evidence.',
    'Stop when done. Do not ask questions.',
  ].join('\n')
}

/**
 * runSessionV1
 */
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
}) {
  const assignment = (plan.assignments || []).find((a) => a.session_id === sessionId)
  if (!assignment) {
    return { status: 'blocked', reason: 'assignment_not_found', events: [] }
  }

  const gate = gateExecution({ env, argv, plan, auth, assignment })
  if (!gate.ok) {
    return { status: 'blocked', reason: 'gate_failed', errors: gate.errors, events: [] }
  }

  const adapter = pickAdapter(assignment, { forceFake })
  if (!adapter) {
    return {
      status: 'blocked_adapter_unavailable',
      reason: 'no_adapter_for_assignment',
      assignment_model: assignment.model,
      events: [],
    }
  }

  const events = []
  const push = (type, data) => {
    events.push({ type, data })
    if (store) store.emit(type, data)
  }

  let store = null
  if (ledgerPath) {
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true })
    store = new EventStore(ledgerPath)
  }

  // workspace: fixture copy OR git worktree
  let workspace
  let baseSha = null
  if (auth.scope === 'fixture_only' && copyFixtureFrom) {
    workspace = resolveWorktreePath(plan.mission.id, sessionId)
    // always reset fixture workspace for reproducibility
    fs.rmSync(workspace, { recursive: true, force: true })
    fs.mkdirSync(workspace, { recursive: true })
    copyDir(copyFixtureFrom, workspace)
    // isolate git evidence from monorepo
    try {
      execFileSync('git', ['init'], { cwd: workspace, stdio: 'ignore' })
      execFileSync('git', ['add', '-A'], { cwd: workspace, stdio: 'ignore' })
      execFileSync(
        'git',
        ['-c', 'user.email=cortex@local', '-c', 'user.name=cortex', 'commit', '-m', 'fixture'],
        { cwd: workspace, stdio: 'ignore' },
      )
    } catch {
      /* evidence git optional */
    }
    push('worktree.created.v2', {
      mission_id: plan.mission.id,
      session_id: sessionId,
      path: workspace,
      mode: 'fixture_copy',
      executable: true,
    })
  } else {
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
  }

  push('session.started.v2', {
    mission_id: plan.mission.id,
    session_id: sessionId,
    agent_role_id: assignment.agent_role_id,
    plan_hash: plan.metadata.plan_hash,
    model_family: assignment.model.family,
    model_variant: assignment.model.variant,
    access_channel: assignment.model.access_channel,
    canonical_effort: assignment.effort.canonical,
    provider_effort: assignment.effort.provider,
  })

  const testsBefore = runTests(workspace, testCommand)
  const mandate = buildMandate(plan, assignment)
  const model = assignment.model.variant
  const effort = assignment.effort.provider || assignment.effort.canonical

  const pf = adapter.preflight({ model, effort })
  if (!pf.ok) {
    push('session.blocked.v2', { session_id: sessionId, reason: pf.reason, preflight: pf })
    store?.close?.()
    return { status: 'blocked', reason: pf.reason, preflight: pf, events, workspace }
  }

  push('adapter.invoked.v2', {
    session_id: sessionId,
    adapter: adapter.adapterId || 'unknown',
    model,
    effort,
  })

  const adapterResult = await adapter.executeSession({
    cwd: workspace,
    model,
    effort,
    prompt: mandate,
  })

  push('adapter.completed.v2', {
    session_id: sessionId,
    status: adapterResult.status,
    exit_code: adapterResult.exit_code,
    duration_ms: adapterResult.duration_ms,
    model_applied: adapterResult.model_applied,
    effort_applied: adapterResult.effort_applied,
  })

  const testsAfter = runTests(workspace, testCommand)
  const evidence = buildEvidenceBundle({
    plan,
    assignment,
    workspace,
    adapterResult,
    testsBefore,
    testsAfter,
    baseSha,
  })
  push('evidence.collected.v2', {
    session_id: sessionId,
    changed_files: evidence.changed_files,
    tests_before_ok: testsBefore?.ok ?? null,
    tests_after_ok: testsAfter?.ok ?? null,
    plan_hash: evidence.plan_hash,
  })

  const closure_recommendation = recommendClosure(evidence)
  const ok = adapterResult.status === 'completed'
  push(ok ? 'session.succeeded.v2' : 'session.failed.v2', {
    session_id: sessionId,
    adapter_status: adapterResult.status,
    closure_recommendation: closure_recommendation.recommendation,
    note: 'no mission.closure emitted by runner',
  })

  store?.close?.()

  return {
    status: ok ? 'succeeded' : 'failed',
    workspace,
    evidence,
    closure_recommendation,
    events,
    adapterResult: {
      ...adapterResult,
      stdout_redacted: redactText(adapterResult.stdout_redacted || ''),
      stderr_redacted: redactText(adapterResult.stderr_redacted || ''),
    },
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
