/**
 * Projection Mission Control dérivée du ledger append-only.
 * Le frontend consomme cette vue, sans réimplémenter la gouvernance.
 */

const CLOSURE_STATUS = Object.freeze({
  LIVRAISON_AUTONOME: 'autonomous',
  AVEC_INFORMATION: 'information',
  ESCALADE_HUMAINE: 'escalated',
})

const PHASE_BY_EVENT = Object.freeze({
  'mission.start': 'starting',
  'agent.assigned': 'delegating',
  'agent.result': 'executing',
  'check.run': 'checking',
  'budget.eval': 'budget',
  'mission.closure': 'closed',
})

function eventTime(event) {
  const value = Date.parse(event?.ts)
  return Number.isFinite(value) ? value : null
}

function eventDescriptor(event) {
  if (!event) return null
  return {
    type: event.type,
    ts: event.ts || null,
    hash: event.hash || null,
    data: event.data || {},
  }
}

function missionId(startEvent, index) {
  if (startEvent?.hash) return `m_${String(startEvent.hash).slice(0, 8)}`
  return `m_${eventTime(startEvent) ?? 'unknown'}_${index}`
}

function normalizeBudget(data = {}) {
  const limits = data.limits || {}
  const cost = Number.isFinite(data.cost) ? data.cost : 0
  const maxCost = Number.isFinite(limits.maxCost) ? limits.maxCost : null
  return {
    explorations: Number.isFinite(data.explorations) ? data.explorations : 0,
    reworks: Number.isFinite(data.reworks) ? data.reworks : 0,
    cost,
    limits: {
      maxExplorations: Number.isFinite(limits.maxExplorations) ? limits.maxExplorations : null,
      maxReworks: Number.isFinite(limits.maxReworks) ? limits.maxReworks : null,
      maxCost,
    },
    percentage: maxCost && maxCost > 0 ? Math.min(999, Math.round((cost / maxCost) * 100)) : null,
    over: Array.isArray(data.over) ? [...data.over] : [],
  }
}

function createMission(startEvent, index) {
  const data = startEvent.data || {}
  return {
    id: missionId(startEvent, index),
    name: data.mission || 'Mission sans nom',
    domain: data.domain || null,
    target: data.target || null,
    rules: Number.isFinite(data.rules) ? data.rules : null,
    started_at: startEvent.ts || null,
    events: [startEvent],
    checks: [],
    assignments: [],
    results: [],
    budget: null,
    closure_event: null,
  }
}

function assignmentSummary(assignments, results) {
  const byAgent = new Map()

  for (const assignment of assignments) {
    const data = assignment.data || {}
    const id = data.agent || data.name || 'unknown'
    const current = byAgent.get(id) || {
      id,
      name: data.name || id,
      model: data.model || null,
      mandates: 0,
      cost: 0,
      latest_rule: null,
      latest_assignment_at: null,
      latest_result: null,
    }
    current.mandates += 1
    current.cost = Math.round((current.cost + (data.cost || 0)) * 100) / 100
    current.latest_rule = data.rule || current.latest_rule
    current.latest_assignment_at = assignment.ts || current.latest_assignment_at
    byAgent.set(id, current)
  }

  for (const result of results) {
    const data = result.data || {}
    const id = data.agent || data.name || 'unknown'
    const current = byAgent.get(id)
    if (!current) continue
    current.latest_result = {
      ts: result.ts || null,
      rule: data.rule || null,
      violation: Boolean(data.violation),
      findings: data.findings ?? 0,
      duration_ms: data.duration_ms ?? null,
    }
  }

  return [...byAgent.values()]
}

function estimateProgress({ closed, rules, checks, assignments, latestType }) {
  if (closed) return 100
  if (!rules || rules <= 0) {
    if (latestType === 'budget.eval') return 88
    if (latestType === 'check.run' || latestType === 'agent.result') return 64
    if (latestType === 'agent.assigned') return 32
    return 12
  }
  const completed = Math.min(rules, checks)
  const execution = Math.round((completed / rules) * 76)
  const delegation = assignments > 0 ? 12 : 0
  return Math.max(8, Math.min(92, 8 + delegation + execution))
}

function finalizeMission(mission, { incomplete = false } = {}) {
  const latest = mission.events[mission.events.length - 1] || null
  const closureData = mission.closure_event?.data || {}
  const closure = closureData.closure || null
  const status = closure
    ? (CLOSURE_STATUS[closure] || 'closed')
    : incomplete
      ? 'incomplete'
      : 'running'

  const violations = mission.checks.filter((check) => check.violation === true).length
  const findings = mission.checks.reduce((sum, check) => sum + (check.findings || 0), 0)
  const passed = mission.checks.filter((check) => check.violation !== true).length
  const agents = assignmentSummary(mission.assignments, mission.results)
  const startedMs = eventTime(mission.events[0])
  const finishedMs = eventTime(mission.closure_event)
  const closed = Boolean(mission.closure_event)

  return {
    id: mission.id,
    source: 'cortex-ledger',
    name: mission.name,
    domain: mission.domain,
    target: mission.target,
    rules: mission.rules,
    status,
    phase: PHASE_BY_EVENT[latest?.type] || 'unknown',
    progress: estimateProgress({
      closed,
      rules: mission.rules,
      checks: mission.checks.length,
      assignments: mission.assignments.length,
      latestType: latest?.type,
    }),
    started_at: mission.started_at,
    finished_at: mission.closure_event?.ts || null,
    duration_ms: startedMs != null && finishedMs != null ? Math.max(0, finishedMs - startedMs) : null,
    closure,
    closure_data: { ...closureData },
    escalations: Number.isFinite(closureData.escalations) ? closureData.escalations : 0,
    checks: {
      total: mission.checks.length,
      passed,
      violations,
      findings,
      items: mission.checks.map((check) => ({ ...check })),
    },
    budget: mission.budget ? normalizeBudget(mission.budget) : null,
    agents,
    manager: agents[0] || null,
    event_count: mission.events.length,
    latest_event: eventDescriptor(latest),
    timeline: mission.events.map(eventDescriptor),
  }
}

export function projectMissions(events = []) {
  const source = Array.isArray(events) ? events.filter((event) => event?.type) : []
  const missions = []
  let current = null

  source.forEach((event, index) => {
    if (event.type === 'mission.start') {
      if (current) missions.push(finalizeMission(current, { incomplete: true }))
      current = createMission(event, index)
      return
    }
    if (!current) return

    current.events.push(event)
    if (event.type === 'agent.assigned') current.assignments.push(event)
    if (event.type === 'agent.result') current.results.push(event)
    if (event.type === 'check.run') current.checks.push({ ...(event.data || {}) })
    if (event.type === 'budget.eval') current.budget = { ...(event.data || {}) }
    if (event.type === 'mission.closure') {
      current.closure_event = event
      missions.push(finalizeMission(current))
      current = null
    }
  })

  if (current) missions.push(finalizeMission(current))
  return missions.reverse()
}

export function summarizeMissions(missions = []) {
  const safe = Array.isArray(missions) ? missions : []
  const budgetCost = safe.reduce((sum, mission) => sum + (mission.budget?.cost || 0), 0)
  const budgetLimit = safe.reduce((sum, mission) => sum + (mission.budget?.limits?.maxCost || 0), 0)
  return {
    total: safe.length,
    running: safe.filter((mission) => mission.status === 'running').length,
    needs_attention: safe.filter((mission) => ['escalated', 'incomplete'].includes(mission.status)).length,
    autonomous: safe.filter((mission) => mission.status === 'autonomous').length,
    information: safe.filter((mission) => mission.status === 'information').length,
    escalated: safe.filter((mission) => mission.status === 'escalated').length,
    checks_failed: safe.reduce((sum, mission) => sum + (mission.checks?.violations || 0), 0),
    budget_cost: Math.round(budgetCost * 100) / 100,
    budget_limit: Math.round(budgetLimit * 100) / 100,
    latest_activity: safe[0]?.latest_event?.ts || null,
  }
}

export function buildMissionControl(events = []) {
  const missions = projectMissions(events)
  return { summary: summarizeMissions(missions), missions }
}
