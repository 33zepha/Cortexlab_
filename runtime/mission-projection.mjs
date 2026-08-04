/**
 * mission-projection.mjs — vue Mission Control dérivée du ledger Cortex.
 *
 * Le ledger reste la source de vérité append-only. Ce module ne modifie rien :
 * il regroupe les événements en missions lisibles pour l'API et l'interface.
 */

const CLOSURE_STATUS = Object.freeze({
  LIVRAISON_AUTONOME: 'autonomous',
  AVEC_INFORMATION: 'information',
  ESCALADE_HUMAINE: 'escalated',
})

const PHASE_BY_EVENT = Object.freeze({
  'mission.start': 'starting',
  'check.run': 'checking',
  'budget.eval': 'budget',
  'mission.closure': 'closed',
})

function isEvent(value) {
  return Boolean(value && typeof value === 'object' && typeof value.type === 'string')
}

function eventTime(event) {
  const value = Date.parse(event?.ts)
  return Number.isFinite(value) ? value : null
}

function missionId(startEvent, index) {
  if (typeof startEvent.hash === 'string' && startEvent.hash) {
    return `mission-${startEvent.hash}`
  }
  const ts = eventTime(startEvent)
  return `mission-${ts ?? 'unknown'}-${index}`
}

function latestDescriptor(event) {
  if (!event) return null
  return {
    type: event.type,
    ts: event.ts || null,
    hash: event.hash || null,
  }
}

function normalizeBudget(data = {}) {
  const limits = data.limits && typeof data.limits === 'object' ? data.limits : {}
  return {
    explorations: Number.isFinite(data.explorations) ? data.explorations : 0,
    reworks: Number.isFinite(data.reworks) ? data.reworks : 0,
    cost: Number.isFinite(data.cost) ? data.cost : 0,
    limits: {
      maxExplorations: Number.isFinite(limits.maxExplorations) ? limits.maxExplorations : null,
      maxReworks: Number.isFinite(limits.maxReworks) ? limits.maxReworks : null,
      maxCost: Number.isFinite(limits.maxCost) ? limits.maxCost : null,
    },
    over: Array.isArray(data.over) ? [...data.over] : [],
  }
}

function createMission(startEvent, index) {
  const data = startEvent.data || {}
  return {
    id: missionId(startEvent, index),
    name: data.mission || 'mission sans nom',
    domain: data.domain || null,
    target: data.target || null,
    rules: Number.isFinite(data.rules) ? data.rules : null,
    started_at: startEvent.ts || null,
    start_event: latestDescriptor(startEvent),
    events: [startEvent],
    checks: [],
    budget: null,
    closure_event: null,
  }
}

function finalizeMission(mission, { incomplete = false } = {}) {
  const closureData = mission.closure_event?.data || {}
  const closure = closureData.closure || null
  const status = closure
    ? (CLOSURE_STATUS[closure] || 'closed')
    : incomplete
      ? 'incomplete'
      : 'running'

  const violations = mission.checks.filter((check) => check.violation === true).length
  const findings = mission.checks.reduce(
    (total, check) => total + (Number.isFinite(check.findings) ? check.findings : 0),
    0
  )
  const passed = mission.checks.filter((check) => check.violation !== true).length
  const latest = mission.events[mission.events.length - 1] || null
  const startedMs = eventTime(mission.events[0])
  const finishedMs = eventTime(mission.closure_event)

  return {
    id: mission.id,
    name: mission.name,
    domain: mission.domain,
    target: mission.target,
    rules: mission.rules,
    status,
    phase: PHASE_BY_EVENT[latest?.type] || 'unknown',
    started_at: mission.started_at,
    finished_at: mission.closure_event?.ts || null,
    duration_ms:
      startedMs != null && finishedMs != null ? Math.max(0, finishedMs - startedMs) : null,
    closure,
    escalations: Number.isFinite(closureData.escalations) ? closureData.escalations : 0,
    checks: {
      total: mission.checks.length,
      passed,
      violations,
      findings,
      items: mission.checks.map((check) => ({ ...check })),
    },
    budget: mission.budget ? normalizeBudget(mission.budget) : null,
    event_count: mission.events.length,
    latest_event: latestDescriptor(latest),
  }
}

/**
 * Regroupe les événements du ledger en missions, de la plus récente à la plus ancienne.
 * Les événements sans mission.start sont ignorés.
 */
export function projectMissions(events = []) {
  const source = Array.isArray(events) ? events.filter(isEvent) : []
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
  return {
    total: safe.length,
    running: safe.filter((mission) => mission.status === 'running').length,
    needs_attention: safe.filter(
      (mission) => mission.status === 'escalated' || mission.status === 'incomplete'
    ).length,
    autonomous: safe.filter((mission) => mission.status === 'autonomous').length,
    information: safe.filter((mission) => mission.status === 'information').length,
    escalated: safe.filter((mission) => mission.status === 'escalated').length,
    incomplete: safe.filter((mission) => mission.status === 'incomplete').length,
    checks_failed: safe.reduce(
      (total, mission) => total + (mission.checks?.violations || 0),
      0
    ),
    latest_activity: safe[0]?.latest_event?.ts || null,
  }
}

/** Contrat prêt à servir par /api/missions. */
export function buildMissionControl(events = []) {
  const missions = projectMissions(events)
  return {
    summary: summarizeMissions(missions),
    missions,
  }
}
