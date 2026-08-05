/**
 * Session Runner V1 gates + fake adapter + fixture E2E (no prod ledger).
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
  checkFeatureFlag,
  validateAuthorization,
} from '../runtime/execution-gate.mjs'
import { runSessionV1 } from '../runtime/session-runner-v1.mjs'
import { resolveWorktreePath, getWorktreeRoot } from '../runtime/worktree-manager.mjs'
import { preflight as claudePreflight, buildArgv } from '../runtime/adapters/claude-code-adapter.mjs'
import { redactText } from '../runtime/evidence-collector.mjs'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const FIXTURE = path.join(ROOT, 'test/fixtures/session-runner-bug')

function makePlan(suffix = '1') {
  // Force a planned Claude-compatible assignment by crafting after plan
  const plan = planMissionV2({
    id: `MIS-RUNNER-${suffix}`,
    goal: 'Corriger le scoping de Mission Control.',
    domains: ['frontend'],
    risk: 'medium',
  })
  if (plan.status !== 'planned') {
    plan.status = 'planned'
    plan.organization.status = 'ok'
    plan.mission = plan.mission || { id: `MIS-RUNNER-${suffix}`, goal: 'x', risk: 'medium' }
    plan.assignments = [
      {
        mission_id: `MIS-RUNNER-${suffix}`,
        manager_id: 'MGR-ENGINEERING',
        agent_role_id: 'AGENT-FRONTEND-ENGINEER',
        session_id: `ses_MIS-RUNNER-${suffix}_0_FE`,
        status: 'planned',
        model: {
          family: 'claude',
          variant: 'claude-sonnet-5',
          access_channel: 'claude_code_subscription',
        },
        effort: {
          requested: 'medium',
          minimum: 'medium',
          canonical: 'medium',
          provider: 'medium',
          semantics: 'claude_effort',
          mapping_reason: 'direct',
          decision: { kind: 'direct', approved_by: 'test', reason: 'direct' },
        },
        selection: { reason: 'test', confidence: 1, chosen_score: 1, rejected_alternatives: [], fallback_chain: [] },
        requirements: { capabilities: ['filesystem'], tools: [], modalities: [], context: 0 },
        budget: { token_limit: 10000, time_limit_minutes: 10, retry_limit: 1, correction_limit: 1 },
        proofs_expected: ['tests'],
        order: 0,
      },
    ]
    plan.metadata = plan.metadata || {}
    plan.metadata.plan_hash = planHash(plan)
  } else {
    const a = plan.assignments.find((x) => x.status === 'planned')
    if (a) {
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
      plan.metadata.plan_hash = planHash(plan)
    }
  }
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
  assert.ok(r.errors?.includes('feature_flag_off') || r.reason === 'gate_failed')
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

test('worktree path stays under .cortex/worktrees', () => {
  const p = resolveWorktreePath('MIS-X', 'ses_1')
  assert.ok(p.startsWith(getWorktreeRoot()))
  assert.throws(() => resolveWorktreePath('../escape', 'x'))
})

test('redact secrets', () => {
  const s = redactText('token sk-abcdefghijklmnop and ghp_ABCDEFG1234567890')
  assert.equal(s.includes('sk-abcdefghijklmnop'), false)
  assert.equal(s.includes('ghp_ABCDEFG1234567890'), false)
})

test('claude adapter builds argv array without shell and without dangerous skip by default', () => {
  const argv = buildArgv({
    model: 'claude-sonnet-5',
    effort: 'low',
    prompt: 'ping',
  })
  assert.ok(Array.isArray(argv))
  assert.ok(argv.includes('-p'))
  assert.ok(argv.includes('--model'))
  assert.ok(argv.includes('claude-sonnet-5'))
  assert.equal(argv.includes('--dangerously-skip-permissions'), false)
  const pf = claudePreflight({ model: 'claude-sonnet-5', effort: 'low' })
  // may be ok if credentials present
  assert.equal(typeof pf.ok, 'boolean')
})

test('E2E fixture with fake adapter: red then green, source branch intact', async () => {
  const plan = makePlan(`e2e-${Date.now()}`)
  const a = plan.assignments.find((x) => x.status === 'planned')
  assert.ok(a)
  // use fake regardless of model channel
  a.model.access_channel = 'claude_code_subscription'
  a.model.variant = 'claude-sonnet-5'
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
    testCommand: [
      'node',
      '--input-type=module',
      '-e',
      "import { add } from './buggy.js'; const v=add(2,3); if(v!==5){console.error('FAIL',v); process.exit(1)}; console.log('PASS',v)",
    ],
  })

  assert.equal(r.status, 'succeeded', JSON.stringify({ errors: r.errors, reason: r.reason, before: r.evidence?.tests_before, after: r.evidence?.tests_after }))
  assert.equal(r.evidence.tests_before.ok, false, JSON.stringify(r.evidence.tests_before))
  assert.equal(r.evidence.tests_after.ok, true, JSON.stringify(r.evidence.tests_after))
  assert.ok(
    (r.evidence.changed_files || []).some((f) => f.includes('buggy.js')) ||
      /return a \+ b/.test(fs.readFileSync(path.join(r.workspace, 'buggy.js'), 'utf8')),
  )
  assert.ok(r.events.every((e) => e.type !== 'mission.closure' && e.type !== 'agent.result'))
  assert.ok(r.events.some((e) => e.type === 'session.succeeded.v2'))
  assert.ok(r.closure_recommendation)

  // source fixture intact
  const srcAfter = fs.readFileSync(path.join(FIXTURE, 'buggy.js'), 'utf8')
  assert.equal(srcAfter, srcBefore)
  assert.ok(fs.existsSync(ledger))
  const lines = fs.readFileSync(ledger, 'utf8').trim().split('\n')
  assert.ok(lines.length >= 3)
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
