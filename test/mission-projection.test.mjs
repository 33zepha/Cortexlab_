import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMissionControl,
  projectMissions,
  summarizeMissions,
} from '../runtime/mission-projection.mjs'

function event(ts, type, data = {}, hash = `${type}-${ts}`) {
  return { ts, type, data, hash, prev: null }
}

test('projette une mission autonome avec checks, budget et durée', () => {
  const events = [
    event('2026-08-04T08:00:00.000Z', 'mission.start', {
      mission: 'audit-ui', domain: 'frontend', target: '/tmp/ui', rules: 3,
    }, 'a1'),
    event('2026-08-04T08:00:01.000Z', 'check.run', {
      rule: 'CTRL-A', matched: false, violation: false, findings: 0,
    }, 'a2'),
    event('2026-08-04T08:00:02.000Z', 'budget.eval', {
      explorations: 1, reworks: 0, cost: 0.2,
      limits: { maxExplorations: 3, maxReworks: 1, maxCost: 1 }, over: [],
    }, 'a3'),
    event('2026-08-04T08:00:03.000Z', 'mission.closure', {
      closure: 'LIVRAISON_AUTONOME', escalations: 0,
    }, 'a4'),
  ]

  const [mission] = projectMissions(events)
  assert.equal(mission.id, 'mission-a1')
  assert.equal(mission.name, 'audit-ui')
  assert.equal(mission.status, 'autonomous')
  assert.equal(mission.phase, 'closed')
  assert.equal(mission.duration_ms, 3000)
  assert.deepEqual(mission.checks, {
    total: 1,
    passed: 1,
    violations: 0,
    findings: 0,
    items: [{ rule: 'CTRL-A', matched: false, violation: false, findings: 0 }],
  })
  assert.equal(mission.budget.cost, 0.2)
  assert.equal(mission.event_count, 4)
})

test('expose les violations et une closure escaladée', () => {
  const control = buildMissionControl([
    event('2026-08-04T09:00:00.000Z', 'mission.start', { mission: 'unsafe' }, 'b1'),
    event('2026-08-04T09:00:01.000Z', 'check.run', {
      rule: 'CTRL-X', matched: true, violation: true, findings: 2,
    }, 'b2'),
    event('2026-08-04T09:00:02.000Z', 'budget.eval', {
      explorations: 4, reworks: 0, cost: 0,
      limits: { maxExplorations: 3 }, over: ['explorations 4 > max 3'],
    }, 'b3'),
    event('2026-08-04T09:00:03.000Z', 'mission.closure', {
      closure: 'ESCALADE_HUMAINE', escalations: 2,
    }, 'b4'),
  ])

  assert.equal(control.missions[0].status, 'escalated')
  assert.equal(control.missions[0].checks.violations, 1)
  assert.equal(control.missions[0].checks.findings, 2)
  assert.equal(control.missions[0].budget.over.length, 1)
  assert.equal(control.summary.needs_attention, 1)
  assert.equal(control.summary.checks_failed, 1)
})

test('sépare plusieurs missions et retourne la plus récente en premier', () => {
  const missions = projectMissions([
    event('2026-08-04T07:00:00.000Z', 'mission.start', { mission: 'first' }, 'c1'),
    event('2026-08-04T07:00:01.000Z', 'mission.closure', {
      closure: 'AVEC_INFORMATION', escalations: 0,
    }, 'c2'),
    event('2026-08-04T08:00:00.000Z', 'mission.start', { mission: 'second' }, 'c3'),
    event('2026-08-04T08:00:01.000Z', 'mission.closure', {
      closure: 'LIVRAISON_AUTONOME', escalations: 0,
    }, 'c4'),
  ])

  assert.deepEqual(missions.map((mission) => mission.name), ['second', 'first'])
  assert.equal(missions[0].status, 'autonomous')
  assert.equal(missions[1].status, 'information')
})

test('marque une ancienne mission non clôturée comme incomplete et la dernière comme running', () => {
  const missions = projectMissions([
    event('2026-08-04T07:00:00.000Z', 'mission.start', { mission: 'lost' }, 'd1'),
    event('2026-08-04T07:00:01.000Z', 'check.run', { violation: false }, 'd2'),
    event('2026-08-04T08:00:00.000Z', 'mission.start', { mission: 'live' }, 'd3'),
    event('2026-08-04T08:00:01.000Z', 'check.run', { violation: false }, 'd4'),
  ])

  assert.equal(missions[0].name, 'live')
  assert.equal(missions[0].status, 'running')
  assert.equal(missions[1].name, 'lost')
  assert.equal(missions[1].status, 'incomplete')
})

test('ignore les événements orphelins et ne modifie pas le tableau source', () => {
  const events = [
    event('2026-08-04T06:00:00.000Z', 'check.run', { violation: true }, 'e0'),
    event('2026-08-04T06:00:01.000Z', 'mission.start', { mission: 'valid' }, 'e1'),
  ]
  const snapshot = structuredClone(events)
  const missions = projectMissions(events)

  assert.equal(missions.length, 1)
  assert.equal(missions[0].name, 'valid')
  assert.deepEqual(events, snapshot)
})

test('résume les principaux états Mission Control', () => {
  const summary = summarizeMissions([
    { status: 'running', checks: { violations: 0 }, latest_event: { ts: '2026-08-04T10:00:00Z' } },
    { status: 'autonomous', checks: { violations: 0 }, latest_event: { ts: '2026-08-04T09:00:00Z' } },
    { status: 'information', checks: { violations: 0 }, latest_event: { ts: '2026-08-04T08:00:00Z' } },
    { status: 'escalated', checks: { violations: 2 }, latest_event: { ts: '2026-08-04T07:00:00Z' } },
    { status: 'incomplete', checks: { violations: 1 }, latest_event: { ts: '2026-08-04T06:00:00Z' } },
  ])

  assert.deepEqual(summary, {
    total: 5,
    running: 1,
    needs_attention: 2,
    autonomous: 1,
    information: 1,
    escalated: 1,
    incomplete: 1,
    checks_failed: 3,
    latest_activity: '2026-08-04T10:00:00Z',
  })
})
