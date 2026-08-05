/**
 * orchestrator-v2.test.mjs — flux Mission Planner V2 + Session Runner V1.
 * Derrière CORTEX_ORCHESTRATION_V2=1. Un seul assignment réel, Claude adapter.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runOrchestrationV2, isV2Enabled } from '../runtime/orchestrator-v2.mjs'
import { planMissionV2, planHash } from '../runtime/mission-planner-v2.mjs'
import { runSessionV1 } from '../runtime/session-runner-v1.mjs'

function makePlan(missionId) {
  return planMissionV2(
    { id: missionId, goal: 'Corrige le scoping Mission Control', domains: ['frontend'], risk: 'medium' },
    { adapter_snapshot: { installed_access_channels: ['claude_code_subscription'] }, max_assignments: 1 },
  )
}

function makeAuth(plan, sessionId, extra = {}) {
  return {
    mission_id: plan.mission.id,
    plan_hash: plan.metadata.plan_hash,
    assignment_session_ids: [sessionId],
    scope: 'worktree',
    approved_by: 'boss',
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    allow_commit: false,
    allow_push: false,
    allow_merge: false,
    base_commit_sha: plan.metadata.base_commit_sha,
    ...extra,
  }
}

test('isV2Enabled reflects CORTEX_ORCHESTRATION_V2 flag', () => {
  assert.equal(isV2Enabled({ CORTEX_ORCHESTRATION_V2: '1' }), true)
  assert.equal(isV2Enabled({ CORTEX_ORCHESTRATION_V2: '0' }), false)
  assert.equal(isV2Enabled({}), false)
})

test('plans but does not execute without auth (no auto-closure)', async () => {
  const plan = makePlan(`MIS-V2-NOAUTH-${Date.now()}`)
  const r = await runOrchestrationV2(
    { mission: plan.mission, adapter_snapshot: { installed_access_channels: ['claude_code_subscription'] }, auth: null },
    { env: { CORTEX_ORCHESTRATION_V2: '1' }, argv: ['node', 'x'] },
  )
  assert.equal(r.enabled, true)
  assert.equal(r.executable, false)
  assert.equal(r.session_result, undefined)
  assert.ok(Array.isArray(r.events_v2) && r.events_v2.length > 0)
  // events V2 contain planning events, no *runner* session events
  assert.ok(r.events_v2.some((e) => e.type === 'mission.plan.created.v2'))
  assert.ok(!r.events_v2.some((e) => e.type.startsWith('session.started') || e.type.startsWith('session.succeeded') || e.type.startsWith('session.failed')))
})

test('execution path emits V2 events into the ledger', async () => {
  const plan = makePlan(`MIS-V2-EXEC-${Date.now()}`)
  const a = plan.assignments.find((x) => x.status === 'planned')
  const auth = makeAuth(plan, a.session_id)
  const ledger = path.join(os.tmpdir(), `v2-ledger-${Date.now()}.ndjson`)
  const r = await runOrchestrationV2(
    {
      mission: plan.mission,
      adapter_snapshot: { installed_access_channels: ['claude_code_subscription'] },
      auth,
      ledgerPath: ledger,
      baseRef: plan.metadata.base_commit_sha,
      forceFake: true, // test-only: prove V2 wiring without a real Claude call
    },
    { env: { CORTEX_ORCHESTRATION_V2: '1', CORTEX_SESSION_RUNNER_V1: '1' }, argv: ['node', 'x', '--execute'] },
  )
  assert.equal(r.enabled, true)
  assert.equal(r.executable, true)
  assert.ok(Array.isArray(r.events_v2))
  assert.ok(fs.existsSync(ledger))
  // V2 planning events + session runner events both present
  assert.ok(r.events_v2.some((e) => e.type === 'mission.plan.created.v2'))
  assert.ok(r.events_v2.some((e) => e.type.startsWith('session.')))
})

test('single assignment only — max_assignments forced to 1', () => {
  const plan = makePlan(`MIS-V2-SINGLE-${Date.now()}`)
  const planned = plan.assignments.filter((a) => a.status === 'planned')
  assert.equal(planned.length, 1)
  const a = planned[0]
  assert.equal(a.model.family, 'claude')
  assert.equal(a.model.access_channel, 'claude_code_subscription')
})
