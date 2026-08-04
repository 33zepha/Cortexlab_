/**
 * Unit tests for dashboard-view-model.js
 * Tests the provenance classification and data transformation logic.
 * Run with: node web/src/lib/dashboard-view-model.test.mjs
 */

import { buildDashboardViewModel } from './dashboard-view-model.js'

const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL: ${message}`)
}

const test = (name, fn) => {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (e) {
    console.error(`✗ ${name}: ${e.message}`)
    process.exit(1)
  }
}

// Test data builders
const mockMission = (overrides = {}) => ({
  id: 'm_test123',
  name: 'Test Mission',
  domain: 'frontend',
  status: 'running',
  progress: 75,
  started_at: new Date().toISOString(),
  ...overrides,
})

const mockAgent = (overrides = {}) => ({
  id: 'ag-test',
  name: 'Test Agent',
  status: 'active',
  ...overrides,
})

const mockEvent = (overrides = {}) => ({
  ts: new Date().toISOString(),
  type: 'mission.start',
  data: {},
  hash: 'abc123',
  ...overrides,
})

const mockLedger = (overrides = {}) => ({
  agents: [],
  events: [],
  missions: [],
  summary: {},
  connected: false,
  lastSync: null,
  ...overrides,
})

const now = Date.now()

// --- TESTS ---

test('Case 1: Mission present → mission.LIVE', () => {
  const ledger = mockLedger({
    missions: [mockMission()],
    lastSync: new Date().toISOString(),
  })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance.mission.kind === 'LIVE', 'mission.kind should be LIVE')
  assert(view.provenance.mission.confidence === 1, 'mission.confidence should be 1')
  assert(view.mission.name === 'Test Mission', 'mission should be populated from ledger')
})

test('Case 2: No mission → mission.PLACEHOLDER', () => {
  const ledger = mockLedger({ missions: [] })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance.mission.kind === 'PLACEHOLDER', 'mission.kind should be PLACEHOLDER')
  assert(view.provenance.mission.confidence === 0, 'mission.confidence should be 0')
  assert(view.mission.name === 'Aucune mission active', 'mission should fallback to default name')
})

test('Case 3: Mission present → summary.progress.LIVE', () => {
  const ledger = mockLedger({
    missions: [mockMission({ progress: 75 })],
    lastSync: new Date().toISOString(),
  })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance['summary.progress'].kind === 'LIVE', 'progress.kind should be LIVE')
  assert(view.provenance['summary.progress'].confidence === 1, 'progress.confidence should be 1')
  assert(view.summary.progress === 75, 'progress should be 75 from mission')
})

test('Case 4: No mission → summary.progress.PLACEHOLDER with fallback 62', () => {
  const ledger = mockLedger({ missions: [] })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance['summary.progress'].kind === 'PLACEHOLDER', 'progress.kind should be PLACEHOLDER')
  assert(view.provenance['summary.progress'].confidence === 0, 'progress.confidence should be 0')
  assert(view.summary.progress === 62, 'progress should fallback to 62')
})

test('Case 5: Budget complete (cost + limit) → summary.budget.LIVE', () => {
  const ledger = mockLedger({
    summary: { budget_cost: 1.5, budget_limit: 3.0 },
    lastSync: new Date().toISOString(),
  })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance['summary.budget'].kind === 'LIVE', 'budget.kind should be LIVE')
  assert(view.provenance['summary.budget'].confidence === 1, 'budget.confidence should be 1')
  assert(view.summary.budget.percent === 50, 'budget.percent should be 50 (1.5/3.0)')
})

test('Case 6: Budget partial (only cost) → summary.budget.DERIVED or PLACEHOLDER', () => {
  const ledger = mockLedger({
    summary: { budget_cost: 1.5 },
    lastSync: new Date().toISOString(),
  })
  const view = buildDashboardViewModel(ledger, now)

  // Cost is LIVE, limit is PLACEHOLDER → mixed → DERIVED confidence 0.5
  assert(
    view.provenance['summary.budget'].kind === 'DERIVED',
    'budget.kind should be DERIVED when partially filled'
  )
  assert(view.provenance['summary.budget'].confidence === 0.5, 'budget.confidence should be 0.5')
})

test('Case 7: Budget missing → summary.budget.PLACEHOLDER', () => {
  const ledger = mockLedger({ summary: {} })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance['summary.budget'].kind === 'PLACEHOLDER', 'budget.kind should be PLACEHOLDER')
  assert(view.provenance['summary.budget'].confidence === 0, 'budget.confidence should be 0')
  assert(view.summary.budget.cost === '€2,50', 'budget.cost should fallback to 2.5')
  assert(view.summary.budget.limit === '€5,00', 'budget.limit should fallback to 5.0')
})

test('Case 8: Events present → events.LIVE', () => {
  const ledger = mockLedger({
    events: [mockEvent(), mockEvent()],
    lastSync: new Date().toISOString(),
  })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance.events.kind === 'LIVE', 'events.kind should be LIVE')
  assert(view.provenance.events.confidence === 1, 'events.confidence should be 1')
  assert(view.events.length === 2, 'events should contain 2 items from ledger')
})

test('Case 9: Events empty → events.PLACEHOLDER with fallback', () => {
  const ledger = mockLedger({ events: [] })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance.events.kind === 'PLACEHOLDER', 'events.kind should be PLACEHOLDER')
  assert(view.provenance.events.confidence === 0, 'events.confidence should be 0')
  assert(view.events.length === 5, 'events should contain 5 demo fallback items')
})

test('Case 10: Agents present → summary.activeAgent.LIVE', () => {
  const ledger = mockLedger({
    agents: [mockAgent()],
    lastSync: new Date().toISOString(),
  })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance['summary.activeAgent'].kind === 'LIVE', 'activeAgent.kind should be LIVE')
  assert(view.provenance['summary.activeAgent'].confidence === 1, 'activeAgent.confidence should be 1')
  assert(view.summary.activeAgent.name === 'Test Agent', 'activeAgent should come from ledger')
})

test('Case 11: No agents → summary.activeAgent.PLACEHOLDER', () => {
  const ledger = mockLedger({ agents: [] })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance['summary.activeAgent'].kind === 'PLACEHOLDER', 'activeAgent.kind should be PLACEHOLDER')
  assert(view.provenance['summary.activeAgent'].confidence === 0, 'activeAgent.confidence should be 0')
  assert(view.summary.activeAgent.name === 'unknown', 'activeAgent should fallback')
})

test('Case 12: Ledger null → all sections PLACEHOLDER', () => {
  const view = buildDashboardViewModel(null, now)

  assert(view.provenance.mission.kind === 'PLACEHOLDER', 'mission should be PLACEHOLDER')
  assert(view.provenance['summary.budget'].kind === 'PLACEHOLDER', 'budget should be PLACEHOLDER')
  assert(view.provenance.events.kind === 'PLACEHOLDER', 'events should be PLACEHOLDER')
  assert(view.provenance['summary.activeAgent'].kind === 'PLACEHOLDER', 'activeAgent should be PLACEHOLDER')
})

test('Case 13: All PLACEHOLDER sections have confidence 0', () => {
  const view = buildDashboardViewModel({}, now)

  assert(view.provenance['summary.tokens'].confidence === 0, 'tokens.confidence should be 0')
  assert(view.provenance.graph.confidence === 0, 'graph.confidence should be 0')
  assert(view.provenance.inspector.confidence === 0, 'inspector.confidence should be 0')
  assert(view.provenance.terminal.confidence === 0, 'terminal.confidence should be 0')
  assert(view.provenance.health.confidence === 0, 'health.confidence should be 0')
})

test('Case 14: LIVE sections always have confidence 1', () => {
  const ledger = mockLedger({
    connected: true,
    lastSync: new Date().toISOString(),
  })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance.connected.confidence === 1, 'connected.confidence should be 1')
  assert(view.provenance.lastSync.confidence === 1, 'lastSync.confidence should be 1')
})

test('Case 15: Provenance has all required fields', () => {
  const view = buildDashboardViewModel({}, now)
  const requiredSections = [
    'mission',
    'summary.progress',
    'summary.budget',
    'summary.tokens',
    'summary.activeAgent',
    'graph',
    'inspector',
    'events',
    'terminal',
    'health',
    'connected',
    'lastSync',
  ]

  for (const section of requiredSections) {
    assert(view.provenance[section], `provenance.${section} should exist`)
    assert(view.provenance[section].kind, `provenance.${section}.kind should exist`)
    assert(view.provenance[section].source, `provenance.${section}.source should exist`)
    assert(view.provenance[section].updatedAt !== undefined, `provenance.${section}.updatedAt should exist`)
    assert(view.provenance[section].confidence !== undefined, `provenance.${section}.confidence should exist`)
  }
})

// Summary
console.log('\n✅ All 15 test cases passed!')
