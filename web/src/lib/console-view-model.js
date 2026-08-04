// Console Overview view-model: pure aggregation over the same ledger data
// used by dashboard-view-model.js. Every KPI here is a direct read or a
// simple count/derivation from real mission/agent/summary fields — nothing
// invented. When the underlying field is absent, the KPI is marked
// unavailable instead of falling back to a fabricated number.

function formatCost(value) {
  return Number.isFinite(value) ? `€${value.toFixed(2)}` : null
}

export function buildConsoleViewModel(ledgerData, now) {
  const hasLedgerData = ledgerData != null
  const { agents = [], events = [], missions = [], summary = {}, connected, lastSync } = ledgerData || {}

  const hasSummary = hasLedgerData && summary && Object.keys(summary).length > 0
  const hasMissions = missions && missions.length > 0

  // DERIVED, LIVE input: distinct managers currently driving an open mission.
  const runningMissions = missions.filter((mission) => mission.status === 'running')
  const activeManagerIds = new Set(
    runningMissions.map((mission) => mission.manager?.id).filter(Boolean)
  )

  // DERIVED, LIVE input: missions started in the last 24h.
  const dayMs = 24 * 60 * 60 * 1000
  const missionsRecent = missions.filter((mission) => {
    const startedMs = mission.started_at ? Date.parse(mission.started_at) : NaN
    return Number.isFinite(startedMs) && now - startedMs <= dayMs
  })

  const autonomousCount = hasSummary && Number.isFinite(summary.autonomous)
    ? summary.autonomous
    : missions.filter((mission) => mission.status === 'autonomous').length
  const closedCount = hasSummary
    ? (summary.autonomous || 0) + (summary.information || 0) + (summary.escalated || 0)
    : missions.filter((mission) => ['autonomous', 'information', 'escalated'].includes(mission.status)).length
  const autonomousRate = closedCount > 0 ? Math.round((autonomousCount / closedCount) * 100) : null

  const budgetCostLive = hasSummary && Number.isFinite(summary.budget_cost)
  const budgetLimitLive = hasSummary && Number.isFinite(summary.budget_limit)

  const kpis = {
    activeManagers: {
      value: hasLedgerData ? activeManagerIds.size : null,
      sub: 'missions en cours',
    },
    missionsRecent: {
      value: hasLedgerData ? missionsRecent.length : null,
      sub: 'dernières 24h',
    },
    autonomousClosures: {
      value: hasLedgerData ? autonomousCount : null,
      sub: autonomousRate == null ? 'aucune clôture' : `${autonomousRate}% des clôtures`,
    },
    lastActivity: {
      value: summary.latest_activity || lastSync || null,
    },
    budget: {
      cost: budgetCostLive ? formatCost(summary.budget_cost) : null,
      limit: budgetLimitLive ? formatCost(summary.budget_limit) : null,
      percent: budgetCostLive && budgetLimitLive && summary.budget_limit > 0
        ? Math.min(100, Math.round((summary.budget_cost / summary.budget_limit) * 100))
        : null,
    },
  }

  return {
    connected,
    lastSync,
    now,
    agents,
    events,
    missions,
    hasMissions,
    kpis,
  }
}
