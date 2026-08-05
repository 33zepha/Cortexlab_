// Summary + inspector scoping for Mission Control.
// Everything here is derived from the already-scoped mission object so the
// page never shows another mission's budget, agent or inspector data.
import { scopeEventsToMission, scopeAgentsToMission } from './mission-scope.js'

/**
 * Scope the summary rail to one mission.
 * `summary` is the global backend summary ({ budget_cost, budget_limit, ... }).
 * When the mission has no live budget we keep the PLACEHOLDER fallback, but we
 * never mix another mission's agents into the active agent slot.
 */
export function scopeSummaryToMission(summary = {}, mission, scopedAgents = []) {
  if (!mission) return { ...summary, activeAgent: null, mission: null }
  return {
    ...summary,
    mission,
    activeAgent:
      scopedAgents[0] ||
      (mission.agents && mission.agents[0]) ||
      { name: mission.name || 'Hermes', role: 'Chief of Staff' },
  }
}

/**
 * Scope the inspector to the selected node, restricted to the active mission.
 * The inspector is still mostly PLACEHOLDER (no per-node runtime data yet), but
 * it must not surface another mission's mandate/model/agent. We only keep the
 * selected node shape and derive the agent name from the scoped roster when
 * the selected node maps to a real agent of this mission.
 */
export function scopeInspectorToMission(inspector, mission, scopedAgents = [], selectedNode = null) {
  if (!inspector) return inspector
  const node = selectedNode || inspector.item || null
  const agent = scopedAgents.find(
    (a) => a.id === node?.id || a.name === node?.label,
  )
  return {
    ...inspector,
    item: node,
    agent: agent || null,
    // keep placeholder metrics but flag the mission scope so the UI can show
    // "scoped to <mission>" rather than leaking cross-mission context.
    scopedMissionId: mission?.id || null,
  }
}

export { scopeEventsToMission, scopeAgentsToMission }
