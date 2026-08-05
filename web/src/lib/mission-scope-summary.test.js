/**
 * Tests du scoping summary + inspector Mission Control.
 * node --test web/src/lib/mission-scope-summary.test.js
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  scopeSummaryToMission,
  scopeInspectorToMission,
  scopeAgentsToMission,
} from './mission-scope-summary.js'

const mission = {
  id: 'm_aaaaaaaa',
  name: 'Mission A',
  agents: [{ id: 'AG-1', name: 'Frontend' }],
}

test('scopeSummaryToMission scoping agent + mission', () => {
  const scopedAgents = scopeAgentsToMission(
    [
      { id: 'AG-1', name: 'Frontend' },
      { id: 'AG-2', name: 'Backend' },
    ],
    mission,
  )
  const s = scopeSummaryToMission({ budget_cost: 5, budget_limit: 10 }, mission, scopedAgents)
  assert.equal(s.mission?.id, 'm_aaaaaaaa')
  assert.equal(s.activeAgent?.id, 'AG-1')
  assert.equal(s.activeAgent?.name, 'Frontend')
})

test('scopeSummaryToMission returns null agent when no mission', () => {
  const s = scopeSummaryToMission({}, null, [])
  assert.equal(s.activeAgent, null)
  assert.equal(s.mission, null)
})

test('scopeInspectorToMission never leaks another mission agent', () => {
  // node label matches the scoped agent name -> agent resolved
  const scopedAgents = [{ id: 'AG-1', name: 'Frontend Agent' }]
  const node = { id: 'frontend', label: 'Frontend Agent' }
  const insp = scopeInspectorToMission(
    { item: node, mandate: 'OTHER MISSION MANDATE' },
    mission,
    scopedAgents,
    node,
  )
  assert.equal(insp.agent?.id, 'AG-1')
  assert.equal(insp.scopedMissionId, 'm_aaaaaaaa')
})

test('scopeInspectorToMission keeps placeholder when node maps to no agent', () => {
  const node = { id: 'human', label: 'Human Approval' }
  const insp = scopeInspectorToMission({ item: node }, mission, [], node)
  assert.equal(insp.agent, null)
  assert.equal(insp.scopedMissionId, 'm_aaaaaaaa')
})
