/**
 * Tests du scoping Mission Control (events/agents limités à la mission sélectionnée).
 * node --test web/src/lib/mission-scope.test.js
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { segmentEventsByMission, scopeEventsToMission, scopeAgentsToMission } from './mission-scope.js'

const missionAStart = { type: 'mission.start', ts: '2026-08-01T10:00:00Z', hash: 'aaaaaaaa1111', data: { mission: 'Mission A' } }
const missionAEvent = { type: 'agent.step', ts: '2026-08-01T10:01:00Z', data: { agent: 'Frontend' } }
const missionAClose = { type: 'mission.closure', ts: '2026-08-01T10:02:00Z' }

const missionBStart = { type: 'mission.start', ts: '2026-08-01T11:00:00Z', hash: 'bbbbbbbb2222', data: { mission: 'Mission B' } }
const missionBEvent = { type: 'agent.step', ts: '2026-08-01T11:01:00Z', data: { agent: 'Backend' } }

const EVENTS = [missionAStart, missionAEvent, missionAClose, missionBStart, missionBEvent]

test('segmentEventsByMission groups events between mission.start and mission.closure', () => {
  const segments = segmentEventsByMission(EVENTS)
  assert.equal(segments.length, 2)
  assert.equal(segments[0].id, 'm_aaaaaaaa')
  assert.equal(segments[0].name, 'Mission A')
  assert.deepEqual(segments[0].events, [missionAStart, missionAEvent, missionAClose])
  assert.equal(segments[1].id, 'm_bbbbbbbb')
  assert.deepEqual(segments[1].events, [missionBStart, missionBEvent])
})

test('segmentEventsByMission closes a trailing open segment without mission.closure', () => {
  const segments = segmentEventsByMission([missionBStart, missionBEvent])
  assert.equal(segments.length, 1)
  assert.equal(segments[0].id, 'm_bbbbbbbb')
})

test('segmentEventsByMission ignores events before any mission.start', () => {
  const segments = segmentEventsByMission([missionAEvent, missionBStart, missionBEvent])
  assert.equal(segments.length, 1)
  assert.equal(segments[0].id, 'm_bbbbbbbb')
})

test('scopeEventsToMission returns only the events belonging to the matched mission id', () => {
  const mission = { id: 'm_aaaaaaaa', name: 'Mission A' }
  assert.deepEqual(scopeEventsToMission(EVENTS, mission), [missionAStart, missionAEvent, missionAClose])
})

test('scopeEventsToMission falls back to matching by mission name when the id is unknown', () => {
  const mission = { id: 'm_unknown', name: 'Mission B' }
  assert.deepEqual(scopeEventsToMission(EVENTS, mission), [missionBStart, missionBEvent])
})

test('scopeEventsToMission returns an empty list rather than leaking the unscoped set', () => {
  const mission = { id: 'm_unknown', name: 'Unknown Mission' }
  assert.deepEqual(scopeEventsToMission(EVENTS, mission), [])
})

test('scopeEventsToMission returns an empty list when no mission is provided', () => {
  assert.deepEqual(scopeEventsToMission(EVENTS, null), [])
})

test('scopeAgentsToMission filters the global roster to the mission agents list', () => {
  const agents = [
    { id: 'AG-1', name: 'Frontend' },
    { id: 'AG-2', name: 'Backend' },
    { id: 'AG-3', name: 'Researcher' },
  ]
  const mission = { agents: [{ id: 'AG-1' }, { name: 'Researcher' }] }
  assert.deepEqual(scopeAgentsToMission(agents, mission), [agents[0], agents[2]])
})

test('scopeAgentsToMission returns an empty list when the mission has no agents', () => {
  const agents = [{ id: 'AG-1', name: 'Frontend' }]
  assert.deepEqual(scopeAgentsToMission(agents, { agents: [] }), [])
})

test('scopeAgentsToMission returns an empty list when no mission is provided', () => {
  const agents = [{ id: 'AG-1', name: 'Frontend' }]
  assert.deepEqual(scopeAgentsToMission(agents, null), [])
})
