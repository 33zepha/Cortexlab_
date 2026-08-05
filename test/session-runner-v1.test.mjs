/**
 * Session Runner V1 — critical gates + fixture E2E (no prod ledger).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { planMissionV2, planHash } from '../runtime/mission-planner-v2.mjs'
import {
  gateExecution,
  validateAuthorization,
} from '../runtime/execution-gate.mjs'
import { runSessionV1, evaluateSessionSuccess } from '../runtime/session-runner-v1.mjs'
import { resolveWorktreePath, getWorktreeRoot, createWorktree } from '../runtime/worktree-manager.mjs'
import { preflight as claudePreflight, buildArgv } from '../runtime/adapters/claude-code-adapter.mjs'
import { redactText } from '../runtime/evidence-collector.mjs'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const FIXTURE = path.join(ROOT, 'test/fixtures/session-runner-bug')

const VERIFY_CMD = [
  'node',
  '--input-type=module',
  '-e',
  "import { add } from './buggy.js'; const v=add(2,3); if(v!==5){console.error('FAIL',v); process.exit(1)}; console.log('PASS',v)",
]

function makePlan(suffix = '1') {
  const plan = planMissionV2({
    id: `MIS-RUNNER-${suffix}`,
    goal: 'Corriger le scoping de Mission Control.',
    domains: ['frontend'],
    risk: 'medium',
  })
  assert.equal(plan.status, 'planned', JSON.stringify(plan.organization))
  const a = plan.assignments.find((x) => x.status === 'planned')
  a.model = {
    family: 'claude',
    variant: 'claude-sonnet-5',
    access_channel: 'claude_code_subscription',
  }
  a.effort = {
    requested: a.effort?.requested || 'medium',
    minimum: a.effort?.minimum || 'low',
    canonical: 'medium',
    provider: 'medium',
    semantics: 'claude_effort',
    mapping_reason: 'test_override_for_adapter',
    decision: { kind: 'direct', approved_by: 'test', reason: 'adapter_e2e' },
  }
  // keep other planned assignments valid if present — only first rewritten
  plan.metadata.plan_hash = planHash(plan)
  return plan
}

function makeAuth(plan, sessionId, overrides = {}) {
  return {
    mission_id: plan.mission.id,
    plan_hash: plan.metadata.plan_hash,
    assignment_session_ids: [sessionId],
    scope: 'fixture_only',
    approved_by: 'test_fixture',
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    allow_commit: false,
    allow_push: false,
    allow_merge: false,
    ...overrides,
  }
}

test('feature flag off refuses', async () => {
  const plan = makePlan('flag')
  const a = plan.assignments.find((x) => x.status === 'planned')
  const auth = makeAuth(plan, a.session_id)
  const r = await runSessionV1({
    plan,
    auth,
    sessionId: a.session_id,
    env: { ...process.env, CORTEX_SESSION_RUNNER_V1: '0' },
    argv: ['node', 'x', '--execute'],
    forceFake: true,
    copyFixtureFrom: FIXTURE,
  })
  assert.equal(r.status, 'blocked')
  assert.ok(r.errors?.includes('feature_flag_off'))
})

test('execute flag missing refuses', async () => {
  const plan = makePlan('exec')
  const a = plan.assignments.find((x) => x.status === 'planned')
  const auth = makeAuth(plan, a.session_id)
  const r = await runSessionV1({
    plan,
    auth,
    sessionId: a.session_id,
    env: { ...process.env, CORTEX_SESSION_RUNNER_V1: '1' },
    argv: ['node', 'x'],
    forceFake: true,
    copyFixtureFrom: FIXTURE,
  })
  assert.equal(r.status, 'blocked')
  assert.ok(r.errors?.includes('execute_flag_missing'))
})

test('worktree scope requires approved_by=boss', () => {
  const plan = makePlan('wt-boss')
  const a = plan.assignments.find((x) => x.status === 'planned')
  const auth = makeAuth(plan, a.session_id, {
    scope: 'worktree',
    approved_by: 'test_fixture',
  })
  const g = validateAuthorization(auth, plan)
  assert.equal(g.ok, false)
  assert.ok(g.errors.includes('worktree_requires_boss'))
})

test('expires_at required', () => {
  const plan = makePlan('exp-req')
  const a = plan.assignments.find((x) => x.status === 'planned')
  const auth = makeAuth(plan, a.session_id)
  delete auth.expires_at
  const g = validateAuthorization(auth, plan)
  assert.equal(g.ok, false)
  assert.ok(g.errors.includes('expires_at_required'))
})

test('expired auth refuses', () => {
  const plan = makePlan('exp')
  const a = plan.assignments.find((x) => x.status === 'planned')
  const auth = makeAuth(plan, a.session_id, {
    expires_at: new Date(Date.now() - 1000).toISOString(),
  })
  const g = validateAuthorization(auth, plan)
  assert.equal(g.ok, false)
  assert.ok(g.errors.includes('auth_expired'))
})

test('bad plan hash refuses', () => {
  const plan = makePlan('hash')
  const a = plan.assignments.find((x) => x.status === 'planned')
  const auth = makeAuth(plan, a.session_id, { plan_hash: 'deadbeef' })
  const g = gateExecution({
    env: { CORTEX_SESSION_RUNNER_V1: '1' },
    argv: ['--execute'],
    plan,
    auth,
    assignment: a,
  })
  assert.equal(g.ok, false)
})

test('validateMissionPlanV2 runs before execute', async () => {
  const plan = makePlan('val')
  plan.assignments[0].model = null
  plan.assignments[0].status = 'planned'
  plan.metadata.plan_hash = planHash(plan)
  const a = plan.assignments[0]
  const auth = makeAuth(plan, a.session_id)
  const r = await runSessionV1({
    plan,
    auth,
    sessionId: a.session_id,
    env: { ...process.env, CORTEX_SESSION_RUNNER_V1: '1' },
    argv: ['--execute'],
    forceFake: true,
    copyFixtureFrom: FIXTURE,
  })
  assert.equal(r.status, 'blocked')
  assert.ok((r.errors || []).some((e) => String(e).includes('plan_validation') || String(e).includes('planned_missing')))
})

test('existing worktree refused', async () => {
  const plan = makePlan(`exists-${Date.now()}`)
  const a = plan.assignments.find((x) => x.status === 'planned')
  const auth = makeAuth(plan, a.session_id)
  const dest = resolveWorktreePath(plan.mission.id, a.session_id)
  fs.mkdirSync(dest, { recursive: true })
  fs.writeFileSync(path.join(dest, 'marker'), '1')
  const r = await runSessionV1({
    plan,
    auth,
    sessionId: a.session_id,
    env: { ...process.env, CORTEX_SESSION_RUNNER_V1: '1' },
    argv: ['--execute'],
    forceFake: true,
    copyFixtureFrom: FIXTURE,
  })
  assert.equal(r.status, 'blocked')
  assert.equal(r.reason, 'worktree_already_exists')
})

test('worktree path stays under .cortex/worktrees', () => {
  const p = resolveWorktreePath('MIS-X', 'ses_1')
  assert.ok(p.startsWith(getWorktreeRoot()))
  assert.throws(() => resolveWorktreePath('../escape', 'x'))
})

test('createWorktree refuses existing path', () => {
  const id = `MIS-WT-${Date.now()}`
  const sid = 'ses_dup'
  const dest = resolveWorktreePath(id, sid)
  fs.mkdirSync(dest, { recursive: true })
  assert.throws(() => createWorktree({ missionId: id, sessionId: sid }), /worktree_already_exists/)
})

test('redact secrets', () => {
  const s = redactText('token sk-abcdefghijklmnop and ghp_ABCDEFG1234567890')
  assert.equal(s.includes('sk-abcdefghijklmnop'), false)
  assert.equal(s.includes('ghp_ABCDEFG1234567890'), false)
})

test('claude argv audit has no prompt text', () => {
  const argv = buildArgv({ model: 'claude-sonnet-5', effort: 'low' })
  assert.ok(Array.isArray(argv))
  assert.ok(argv.includes('--model'))
  assert.equal(argv.includes('--dangerously-skip-permissions'), false)
  assert.equal(
    argv.some((x) => String(x).includes('You are executing') || String(x).includes('Mission:')),
    false,
  )
  const pf = claudePreflight({ model: 'claude-sonnet-5', effort: 'low' })
  assert.equal(typeof pf.ok, 'boolean')
})

test('evaluateSessionSuccess rejects red tests after and empty diff on bugfix', () => {
  const r1 = evaluateSessionSuccess({
    adapterResult: { status: 'completed', truncated: false },
    testsBefore: { ok: false },
    testsAfter: { ok: false },
    evidence: { changed_files: ['buggy.js'] },
  })
  assert.equal(r1.ok, false)
  assert.equal(r1.reason, 'tests_red_after')

  const r2 = evaluateSessionSuccess({
    adapterResult: { status: 'completed', truncated: false },
    testsBefore: { ok: false },
    testsAfter: { ok: true },
    evidence: { changed_files: [], git_diff: '' },
    expectBugFix: true,
  })
  assert.equal(r2.ok, false)
  assert.equal(r2.reason, 'empty_diff_on_bugfix')

  const r3 = evaluateSessionSuccess({
    adapterResult: { status: 'failed', truncated: true },
    testsBefore: { ok: false },
    testsAfter: { ok: true },
    evidence: { changed_files: ['buggy.js'] },
  })
  assert.equal(r3.ok, false)
})

test('E2E fixture fake: red→green, no prompt in evidence, model_applied distinct', async () => {
  const plan = makePlan(`e2e-${Date.now()}`)
  const a = plan.assignments.find((x) => x.status === 'planned')
  plan.metadata.plan_hash = planHash(plan)
  const auth = makeAuth(plan, a.session_id)
  const srcBefore = fs.readFileSync(path.join(FIXTURE, 'buggy.js'), 'utf8')
  const ledger = path.join(os.tmpdir(), `e2e-runner-${Date.now()}.ndjson`)

  const r = await runSessionV1({
    plan,
    auth,
    sessionId: a.session_id,
    env: { ...process.env, CORTEX_SESSION_RUNNER_V1: '1' },
    argv: ['node', 'run', '--execute'],
    forceFake: true,
    copyFixtureFrom: FIXTURE,
    ledgerPath: ledger,
    testCommand: VERIFY_CMD,
    expectBugFix: true,
  })

  assert.equal(r.status, 'succeeded', JSON.stringify({ errors: r.errors, reason: r.reason, fail: r.fail_reason }))
  assert.equal(r.evidence.tests_before.ok, false)
  assert.equal(r.evidence.tests_after.ok, true)
  assert.ok(
    (r.evidence.changed_files || []).some((f) => f.includes('buggy.js')) ||
      /return a \+ b/.test(fs.readFileSync(path.join(r.workspace, 'buggy.js'), 'utf8')),
  )
  assert.equal(r.evidence.model_requested, 'claude-sonnet-5')
  assert.equal(r.evidence.model_applied, null)
  assert.ok(r.events.every((e) => e.type !== 'mission.closure' && e.type !== 'agent.result'))
  assert.ok(r.events.some((e) => e.type === 'session.succeeded.v2'))
  const joined = JSON.stringify(r.events) + JSON.stringify(r.adapterResult?.argv_audit || [])
  assert.equal(joined.includes('You are executing a single Cortex'), false)
  assert.equal(fs.readFileSync(path.join(FIXTURE, 'buggy.js'), 'utf8'), srcBefore)
  assert.ok(fs.existsSync(ledger))
})

test('blocked plan refuses execution', async () => {
  const plan = makePlan('blocked')
  plan.status = 'blocked'
  plan.organization.status = 'blocked'
  plan.metadata.plan_hash = planHash(plan)
  const a = plan.assignments[0]
  const auth = makeAuth(plan, a.session_id)
  const r = await runSessionV1({
    plan,
    auth,
    sessionId: a.session_id,
    env: { ...process.env, CORTEX_SESSION_RUNNER_V1: '1' },
    argv: ['--execute'],
    forceFake: true,
    copyFixtureFrom: FIXTURE,
  })
  assert.equal(r.status, 'blocked')
})
