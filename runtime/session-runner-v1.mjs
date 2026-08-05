/**
 * session-runner-v1.mjs — execute / resume approved V2 sessions behind feature flag.
 * Never writes mission.closure. Never touches prod ledger/events.ndjson.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { EventStore } from './event-store.mjs'
import { gateExecution } from './execution-gate.mjs'
import {
  createWorktree,
  resolveWorktreePath,
  computeWorkspaceStateHash,
  assertWorkspaceState,
  getWorktreeRoot,
} from './worktree-manager.mjs'
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
const DEFAULT_ASSIGNMENT_TIMEOUT_MS = 180_000
const MAX_ASSIGNMENT_TIMEOUT_MS = 8 * 60_000

function pickAdapter(assignment, { forceFake = false } = {}) {
  if (forceFake) return fakeAdapter
  if (claudeAdapter.supportsAssignment(assignment)) return claudeAdapter
  return null
}

function buildMandate(plan, assignment, auth = null) {
  if (auth?.scope === 'worktree_resume' || auth?.resume_mandate) {
    return (
      auth.resume_mandate ||
      [
        'Resume only. Do not restart the mission from scratch.',
        'Finish only the Mission Control scoping fix already started in this worktree.',
        'Verify that events, agents, summary and inspector are all limited to the selected mission.',
        'Add targeted unit tests for web/src/lib/mission-scope.js.',
        'Do not refactor anything else.',
        'Run only the validations the Runner asks for and return the result JSON.',
        'Forbidden: git commit, push, merge, leaving the worktree.',
        'Return JSON: status, summary, changed_files, tests_requested, risks, missing_evidence.',
      ].join('\n')
    )
  }
  const proofs = []
  if (auth?.proof_commands?.length) {
    proofs.push(`Required proof commands (run in workspace, do not commit): ${auth.proof_commands.join(' ; ')}`)
  }
  return [
    'You are executing a single Cortex session under a strict mandate.',
    `Mission: ${plan.mission?.goal}`,
    `Role: ${assignment.agent_role_id}`,
    `Workspace: current directory only. Stay inside this git worktree.`,
    'Allowed: edit files in workspace, run local tests and local web build if needed.',
    'Forbidden: git commit, git push, git merge, network exfiltration, reading secrets, leaving workspace, writing outside the worktree.',
    `Effort requested: ${assignment.effort?.provider || assignment.effort?.canonical}`,
    `Proofs expected: ${(assignment.proofs_expected || []).join(', ') || 'tests'}`,
    ...proofs,
    'Focus on Mission Control scoping: each page must show only events, agents, summary and inspector for the selected mission. Add or fix corresponding tests.',
    'Return a final JSON object with keys: status, summary, changed_files, tests_requested, risks, missing_evidence.',
    'Stop when done. Do not ask questions.',
  ].join('\n')
}

/**
 * Success requires adapter completed + post proofs.
 * For resume/bugfix: non-empty workspace delta (tracked or untracked).
 */
export function evaluateSessionSuccess({
  adapterResult,
  testsBefore,
  testsAfter,
  evidence,
  expectBugFix = false,
  extraProofs = [],
}) {
  if (!adapterResult || adapterResult.status !== 'completed') {
    return { ok: false, reason: `adapter_${adapterResult?.status || 'missing'}` }
  }
  if (adapterResult.truncated) return { ok: false, reason: 'output_truncated' }
  if (testsAfter && testsAfter.skipped !== true && testsAfter.ok !== true) {
    return { ok: false, reason: 'tests_red_after' }
  }
  for (const p of extraProofs) {
    if (p && p.ok === false) return { ok: false, reason: p.reason || 'extra_proof_failed' }
  }
  const hadRedBefore = testsBefore && testsBefore.skipped !== true && testsBefore.ok === false
  const hasDiff =
    (evidence?.changed_files || []).length > 0 ||
    !!(evidence?.git_diff || '').trim() ||
    (evidence?.untracked_files || []).length > 0
  if ((hadRedBefore || expectBugFix) && !hasDiff) {
    return { ok: false, reason: 'empty_diff_on_bugfix' }
  }
  return { ok: true, reason: 'ok' }
}

function resolveAssignmentTimeoutMs(auth) {
  const raw = auth?.timeout_ms ?? auth?.assignment_timeout_ms ?? DEFAULT_ASSIGNMENT_TIMEOUT_MS
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_ASSIGNMENT_TIMEOUT_MS
  return Math.min(n, MAX_ASSIGNMENT_TIMEOUT_MS)
}

export async function runSessionV1({
  plan,
  auth,
  sessionId,
  env = process.env,
  argv = process.argv,
  forceFake = false,
  testCommand = null,
  targetedTestCommand = null,
  ledgerPath = null,
  baseRef = null,
  repoRoot = ROOT,
  copyFixtureFrom = null,
  expectBugFix = false,
  catalogs = null,
  timeoutMs = null,
}) {
  const events = []
  let store = null
  let workspace = null
  const resolvedBaseRef =
    baseRef || auth?.base_commit_sha || plan?.metadata?.base_commit_sha || 'HEAD'
  const assignmentTimeout = timeoutMs ?? resolveAssignmentTimeoutMs(auth)
  let workspaceStateBefore = null

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
    const isResume = auth.scope === 'worktree_resume'

    if (isResume) {
      const resumeSession = auth.resume_from_session_id || sessionId
      workspace =
        auth.worktree_path ||
        resolveWorktreePath(plan.mission.id, resumeSession)
      // path must stay under .cortex/worktrees
      const root = getWorktreeRoot()
      if (!path.resolve(workspace).startsWith(root + path.sep)) {
        return { status: 'blocked', reason: 'worktree_path_escape', workspace, events }
      }
      if (!fs.existsSync(workspace)) {
        return { status: 'blocked', reason: 'worktree_missing_for_resume', workspace, events }
      }
      try {
        workspaceStateBefore = assertWorkspaceState(workspace, auth.workspace_state_hash)
      } catch (e) {
        return {
          status: 'blocked',
          reason: 'workspace_state_hash_mismatch',
          expected: auth.workspace_state_hash,
          live: e.live || null,
          events,
        }
      }
      baseSha = resolvedBaseRef
      push('worktree.resumed.v2', {
        mission_id: plan.mission.id,
        session_id: sessionId,
        resume_from_session_id: resumeSession,
        path: workspace,
        workspace_state_hash: workspaceStateBefore.workspace_state_hash,
        authorization_id: auth.authorization_id,
        nonce: auth.nonce,
        executable: true,
      })
    } else if (auth.scope === 'fixture_only' && copyFixtureFrom) {
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
          baseRef: resolvedBaseRef,
          repoRoot,
        })
        workspace = wt.path
        baseSha = resolvedBaseRef
        push('worktree.created.v2', {
          mission_id: plan.mission.id,
          session_id: sessionId,
          path: workspace,
          baseRef: resolvedBaseRef,
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
      resume: isResume,
      assignment_timeout_ms: assignmentTimeout,
      authorization_id: auth.authorization_id || null,
    })

    const testsBefore = runTests(workspace, testCommand)
    const mandate = buildMandate(plan, assignment, auth)

    push('adapter.invoked.v2', {
      session_id: sessionId,
      adapter: adapter.adapterId || 'unknown',
      model_requested: model,
      effort,
      timeout_ms: assignmentTimeout,
      resume: isResume,
    })

    const adapterResult = await adapter.executeSession({
      cwd: workspace,
      model,
      effort,
      prompt: mandate,
      timeoutMs: assignmentTimeout,
    })

    const argvAudit = (adapterResult.argv_audit || adapterResult.argv || []).filter(
      (x) => typeof x === 'string' && !x.includes('You are executing a single Cortex') && !x.includes('Resume only'),
    )
    adapterResult.argv_audit = argvAudit
    adapterResult.argv = argvAudit

    push('adapter.completed.v2', {
      session_id: sessionId,
      status: adapterResult.status,
      exit_code: adapterResult.exit_code,
      duration_ms: adapterResult.duration_ms,
      model_requested: adapterResult.model_requested,
      model_applied: adapterResult.model_applied,
      effort_applied: adapterResult.effort_applied,
      effort_verification: adapterResult.effort_verification,
      truncated: !!adapterResult.truncated,
      argv_audit: argvAudit,
    })

    // Targeted helper tests first when provided
    let targetedAfter = null
    if (targetedTestCommand) {
      targetedAfter = runTests(workspace, targetedTestCommand)
    }
    const testsAfter = runTests(workspace, testCommand)

    // optional web build proof
    let webBuild = null
    if (auth?.proof_commands?.some((c) => String(c).includes('build'))) {
      webBuild = runWebBuild(workspace)
    }

    const evidence = buildEvidenceBundle({
      plan,
      assignment,
      workspace,
      adapterResult: { ...adapterResult, argv: argvAudit },
      testsBefore,
      testsAfter,
      baseSha,
    })
    evidence.targeted_tests = targetedAfter
    evidence.web_build = webBuild
    evidence.workspace_state_hash_before = workspaceStateBefore?.workspace_state_hash || null
    try {
      evidence.workspace_state_hash_after = computeWorkspaceStateHash(workspace).workspace_state_hash
    } catch {
      evidence.workspace_state_hash_after = null
    }
    delete evidence.prompt
    delete evidence.mandate

    push('evidence.collected.v2', {
      session_id: sessionId,
      changed_files: evidence.changed_files,
      untracked_files: evidence.untracked_files,
      tests_before_ok: testsBefore?.ok ?? null,
      tests_after_ok: testsAfter?.ok ?? null,
      targeted_tests_ok: targetedAfter?.ok ?? null,
      web_build_ok: webBuild?.ok ?? null,
      plan_hash: evidence.plan_hash,
      model_requested: evidence.model_requested,
      model_applied: evidence.model_applied,
      workspace_state_hash_before: evidence.workspace_state_hash_before,
      workspace_state_hash_after: evidence.workspace_state_hash_after,
    })

    const extraProofs = []
    if (targetedAfter) {
      extraProofs.push({
        ok: targetedAfter.ok === true,
        reason: 'targeted_tests_failed',
      })
    }
    if (webBuild) {
      extraProofs.push({ ok: webBuild.ok === true, reason: 'web_build_failed' })
    }
    // resume always expects non-empty delta relative to clean base (already dirty OK)
    const requireDiff = expectBugFix || isResume || auth.scope === 'fixture_only'
    const success = evaluateSessionSuccess({
      adapterResult,
      testsBefore,
      testsAfter,
      evidence,
      expectBugFix: requireDiff,
      extraProofs,
    })
    // If resume and only adapter failed timeout but proofs are green and files present,
    // still fail (user requires adapter completed).
    const closure_recommendation = recommendClosure(evidence)

    if (success.ok) {
      push('session.succeeded.v2', {
        session_id: sessionId,
        adapter_status: adapterResult.status,
        closure_recommendation: closure_recommendation.recommendation,
        note: 'no mission.closure emitted by runner',
        resume: isResume,
      })
    } else {
      push('session.failed.v2', {
        session_id: sessionId,
        adapter_status: adapterResult.status,
        reason: success.reason,
        closure_recommendation: closure_recommendation.recommendation,
        note: 'no mission.closure emitted by runner',
        resume: isResume,
      })
    }

    return {
      status: success.ok ? 'succeeded' : 'failed',
      fail_reason: success.ok ? null : success.reason,
      workspace,
      evidence,
      closure_recommendation,
      events,
      workspace_state_hash_before: evidence.workspace_state_hash_before,
      workspace_state_hash_after: evidence.workspace_state_hash_after,
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

function runWebBuild(workspace) {
  const webDir = path.join(workspace, 'web')
  if (!fs.existsSync(path.join(webDir, 'package.json'))) {
    return { ok: false, reason: 'web_package_missing', skipped: false }
  }
  try {
    try {
      execFileSync('npm', ['ci', '--no-audit', '--no-fund'], {
        cwd: webDir,
        encoding: 'utf8',
        timeout: 300000,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch {
      /* may already be installed */
    }
    const out = execFileSync('npm', ['run', 'build'], {
      cwd: webDir,
      encoding: 'utf8',
      timeout: 300000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { ok: true, command: 'npm run build', stdout_tail: out.slice(-1000) }
  } catch (e) {
    return {
      ok: false,
      reason: 'web_build_failed',
      code: e.status,
      stderr_tail: String(e.stderr || e.message).slice(-1500),
      stdout_tail: String(e.stdout || '').slice(-800),
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

export { computeWorkspaceStateHash, MAX_ASSIGNMENT_TIMEOUT_MS }
