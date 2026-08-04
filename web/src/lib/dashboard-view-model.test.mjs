/**
 * Unit tests for dashboard-view-model.js
 * Tests the provenance classification and data transformation logic.
 * Run with: node web/src/lib/dashboard-view-model.test.mjs
 */

import { buildDashboardViewModel } from './dashboard-view-model.js'

const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL: ${message}`)
}

let passed = 0
const test = (name, fn) => {
  try {
    fn()
    passed += 1
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

// --- 1. PROGRESSION ---

test('mission with numeric progress classifies summary.progress as LIVE and uses that value', () => {
  const ledger = mockLedger({
    missions: [mockMission({ progress: 75 })],
    lastSync: new Date().toISOString(),
  })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance['summary.progress'].kind === 'LIVE', 'kind should be LIVE')
  assert(view.provenance['summary.progress'].confidence === 1, 'confidence should be 1')
  assert(view.summary.progress === 75, 'progress should equal mission.progress (75)')
})

test('mission without numeric progress field classifies summary.progress as PLACEHOLDER', () => {
  const ledger = mockLedger({
    missions: [mockMission({ progress: undefined })],
  })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance['summary.progress'].kind === 'PLACEHOLDER', 'kind should be PLACEHOLDER')
  assert(view.provenance['summary.progress'].confidence === 0, 'confidence should be 0')
  assert(view.summary.progress === 62, 'progress should fallback to Phase 1 value 62')
})

test('mission with progress equal to 0 classifies summary.progress as LIVE and preserves the zero value', () => {
  const ledger = mockLedger({
    missions: [mockMission({ progress: 0 })],
    lastSync: new Date().toISOString(),
  })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance['summary.progress'].kind === 'LIVE', 'kind should be LIVE even when progress is 0')
  assert(view.provenance['summary.progress'].confidence === 1, 'confidence should be 1')
  assert(view.summary.progress === 0, 'progress should be 0, not fallback to 62')
})

test('no mission present classifies summary.progress as PLACEHOLDER with fallback 62', () => {
  const ledger = mockLedger({ missions: [] })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance['summary.progress'].kind === 'PLACEHOLDER', 'kind should be PLACEHOLDER')
  assert(view.provenance['summary.progress'].confidence === 0, 'confidence should be 0')
  assert(view.summary.progress === 62, 'progress should fallback to 62')
})

// --- 2. BUDGET ---

test('budget with both cost and limit live classifies cost/limit as LIVE and percent as DERIVED', () => {
  const ledger = mockLedger({
    summary: { budget_cost: 10, budget_limit: 20 },
    lastSync: new Date().toISOString(),
  })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance['summary.budget.cost'].kind === 'LIVE', 'cost.kind should be LIVE')
  assert(view.provenance['summary.budget.limit'].kind === 'LIVE', 'limit.kind should be LIVE')
  assert(view.provenance['summary.budget.percent'].kind === 'DERIVED', 'percent.kind should be DERIVED')
  assert(view.provenance['summary.budget.percent'].confidence === 1, 'percent.confidence should be 1')
  assert(view.summary.budget.percent === 50, 'percent should be 50 (10/20)')
})

test('budget with only cost live classifies cost as LIVE, limit as PLACEHOLDER, percent as ESTIMATED', () => {
  const ledger = mockLedger({
    summary: { budget_cost: 10 },
    lastSync: new Date().toISOString(),
  })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance['summary.budget.cost'].kind === 'LIVE', 'cost.kind should be LIVE')
  assert(view.provenance['summary.budget.limit'].kind === 'PLACEHOLDER', 'limit.kind should be PLACEHOLDER')
  assert(view.provenance['summary.budget.percent'].kind === 'ESTIMATED', 'percent.kind should be ESTIMATED')
  assert(view.provenance['summary.budget.percent'].confidence === 0.5, 'percent.confidence should be 0.5')
})

test('budget with only limit live classifies limit as LIVE, cost as PLACEHOLDER, percent as ESTIMATED', () => {
  const ledger = mockLedger({
    summary: { budget_limit: 20 },
    lastSync: new Date().toISOString(),
  })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance['summary.budget.cost'].kind === 'PLACEHOLDER', 'cost.kind should be PLACEHOLDER')
  assert(view.provenance['summary.budget.limit'].kind === 'LIVE', 'limit.kind should be LIVE')
  assert(view.provenance['summary.budget.percent'].kind === 'ESTIMATED', 'percent.kind should be ESTIMATED')
  assert(view.provenance['summary.budget.percent'].confidence === 0.5, 'percent.confidence should be 0.5')
})

test('budget with live limit explicitly zero classifies percent as PLACEHOLDER with explicit source and avoids division', () => {
  const ledger = mockLedger({
    summary: { budget_cost: 10, budget_limit: 0 },
    lastSync: new Date().toISOString(),
  })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance['summary.budget.limit'].kind === 'LIVE', 'limit.kind should be LIVE (0 is a real value)')
  assert(view.provenance['summary.budget.percent'].kind === 'PLACEHOLDER', 'percent.kind should be PLACEHOLDER')
  assert(view.provenance['summary.budget.percent'].confidence === 0, 'percent.confidence should be 0')
  assert(
    view.provenance['summary.budget.percent'].source === 'visual fallback because live budget limit is zero',
    'percent.source should explain the zero-limit fallback'
  )
  assert(view.summary.budget.percent === 0, 'percent should be 0, not a division result')
})

test('budget entirely absent classifies cost, limit and percent as PLACEHOLDER with Phase 1 fallback values', () => {
  const ledger = mockLedger({ summary: {} })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance['summary.budget.cost'].kind === 'PLACEHOLDER', 'cost.kind should be PLACEHOLDER')
  assert(view.provenance['summary.budget.limit'].kind === 'PLACEHOLDER', 'limit.kind should be PLACEHOLDER')
  assert(view.provenance['summary.budget.percent'].kind === 'PLACEHOLDER', 'percent.kind should be PLACEHOLDER')
  assert(view.summary.budget.cost === '€12,45', 'cost should fallback to Phase 1 value 12.45')
  assert(view.summary.budget.limit === '€25,00', 'limit should fallback to Phase 1 value 25')
})

// --- Mission / ledger null ---

test('ledger null falls back to PLACEHOLDER for all bascule sections', () => {
  const view = buildDashboardViewModel(null, now)

  assert(view.provenance.mission.kind === 'PLACEHOLDER', 'mission should be PLACEHOLDER')
  assert(view.provenance['summary.budget.cost'].kind === 'PLACEHOLDER', 'budget.cost should be PLACEHOLDER')
  assert(view.provenance['summary.budget.limit'].kind === 'PLACEHOLDER', 'budget.limit should be PLACEHOLDER')
  assert(view.provenance.events.kind === 'PLACEHOLDER', 'events should be PLACEHOLDER')
  assert(view.provenance['summary.activeAgent'].kind === 'PLACEHOLDER', 'activeAgent should be PLACEHOLDER')
  assert(view.provenance.connected.kind === 'PLACEHOLDER', 'connected should be PLACEHOLDER when ledgerData is null')
  assert(view.provenance.lastSync.kind === 'PLACEHOLDER', 'lastSync should be PLACEHOLDER when ledgerData is null')
})

test('no active mission preserves Phase 1 behavior: mission stays undefined, no fallback object introduced', () => {
  const ledger = mockLedger({ missions: [] })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.mission === undefined, 'mission should remain undefined, not a fallback object')
  assert(view.summary.mission === undefined, 'summary.mission should remain undefined')
})

test('no agents preserves Phase 1 activeAgent fallback (Hermes / Chief of Staff)', () => {
  const ledger = mockLedger({ agents: [] })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance['summary.activeAgent'].kind === 'PLACEHOLDER', 'activeAgent.kind should be PLACEHOLDER')
  assert(view.summary.activeAgent.name === 'Hermes', 'activeAgent should fallback to Phase 1 value Hermes')
  assert(view.summary.activeAgent.role === 'Chief of Staff', 'activeAgent role should fallback to Chief of Staff')
})

// --- Events ---

test('events present in ledger classifies events as LIVE', () => {
  const ledger = mockLedger({
    events: [mockEvent(), mockEvent()],
    lastSync: new Date().toISOString(),
  })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance.events.kind === 'LIVE', 'events.kind should be LIVE')
  assert(view.provenance.events.confidence === 1, 'events.confidence should be 1')
  assert(view.events.length === 2, 'events should contain 2 items from ledger')
})

test('events empty in ledger classifies events as PLACEHOLDER with demo fallback', () => {
  const ledger = mockLedger({ events: [] })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance.events.kind === 'PLACEHOLDER', 'events.kind should be PLACEHOLDER')
  assert(view.provenance.events.confidence === 0, 'events.confidence should be 0')
  assert(view.events.length === 5, 'events should contain 5 demo fallback items')
})

// --- 3. connected / lastSync ---

test('connected explicitly true in ledgerData classifies connected as LIVE with value true', () => {
  const ledger = mockLedger({ connected: true })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance.connected.kind === 'LIVE', 'connected.kind should be LIVE')
  assert(view.provenance.connected.confidence === 1, 'connected.confidence should be 1')
  assert(view.connected === true, 'connected value should be true')
})

test('connected explicitly false in ledgerData classifies connected as LIVE with value false', () => {
  const ledger = mockLedger({ connected: false })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance.connected.kind === 'LIVE', 'connected.kind should be LIVE even when value is false')
  assert(view.provenance.connected.confidence === 1, 'connected.confidence should be 1')
  assert(view.connected === false, 'connected value should be false')
})

test('connected key absent from ledgerData classifies connected as PLACEHOLDER', () => {
  const ledger = { agents: [], events: [], missions: [], summary: {}, lastSync: null }
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance.connected.kind === 'PLACEHOLDER', 'connected.kind should be PLACEHOLDER')
  assert(view.provenance.connected.confidence === 0, 'connected.confidence should be 0')
})

test('lastSync present (non-null) classifies lastSync as LIVE', () => {
  const ts = new Date().toISOString()
  const ledger = mockLedger({ lastSync: ts })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance.lastSync.kind === 'LIVE', 'lastSync.kind should be LIVE')
  assert(view.provenance.lastSync.confidence === 1, 'lastSync.confidence should be 1')
  assert(view.provenance.lastSync.updatedAt === ts, 'lastSync.updatedAt should equal the provided timestamp')
})

test('lastSync explicitly null classifies lastSync as PLACEHOLDER and never reports confidence 1', () => {
  const ledger = mockLedger({ lastSync: null })
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance.lastSync.kind === 'PLACEHOLDER', 'lastSync.kind should be PLACEHOLDER')
  assert(view.provenance.lastSync.confidence === 0, 'lastSync.confidence should be 0, never 1, when value is null')
  assert(view.provenance.lastSync.updatedAt === null, 'lastSync.updatedAt should be null')
})

test('lastSync absent from ledgerData classifies lastSync as PLACEHOLDER', () => {
  const ledger = { agents: [], events: [], missions: [], summary: {}, connected: true }
  const view = buildDashboardViewModel(ledger, now)

  assert(view.provenance.lastSync.kind === 'PLACEHOLDER', 'lastSync.kind should be PLACEHOLDER')
  assert(view.provenance.lastSync.confidence === 0, 'lastSync.confidence should be 0')
})

// --- Stable PLACEHOLDER sections ---

test('stable PLACEHOLDER sections (tokens, graph, inspector, terminal, health) always have confidence 0', () => {
  const view = buildDashboardViewModel({}, now)

  assert(view.provenance['summary.tokens'].confidence === 0, 'tokens.confidence should be 0')
  assert(view.provenance.graph.confidence === 0, 'graph.confidence should be 0')
  assert(view.provenance.inspector.confidence === 0, 'inspector.confidence should be 0')
  assert(view.provenance.terminal.confidence === 0, 'terminal.confidence should be 0')
  assert(view.provenance.health.confidence === 0, 'health.confidence should be 0')
})

test('provenance object exposes metadata for all 13 tracked keys with required fields', () => {
  const view = buildDashboardViewModel({}, now)
  const requiredKeys = [
    'mission',
    'summary.progress',
    'summary.budget.cost',
    'summary.budget.limit',
    'summary.budget.percent',
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

  for (const key of requiredKeys) {
    assert(view.provenance[key], `provenance.${key} should exist`)
    assert(view.provenance[key].kind, `provenance.${key}.kind should exist`)
    assert(view.provenance[key].source, `provenance.${key}.source should exist`)
    assert(view.provenance[key].updatedAt !== undefined, `provenance.${key}.updatedAt should exist`)
    assert(view.provenance[key].confidence !== undefined, `provenance.${key}.confidence should exist`)
  }
})

// Summary
console.log(`\n✅ All ${passed} test cases passed!`)
