// Mission Control scoping: derives per-mission events/agents from the
// global ledger so a mission page never leaks another mission's activity.
//
// Events carry no explicit mission id. The backend (runtime/mission-projection.mjs)
// segments the raw event stream into missions delimited by `mission.start` /
// `mission.closure` and derives each mission id as `m_${hash.slice(0, 8)}`.
// This mirrors that same segmentation client-side so ids line up with the
// ids already returned by /api/missions.

function computeSegmentId(startEvent, index) {
  if (startEvent?.hash) return `m_${String(startEvent.hash).slice(0, 8)}`
  const ts = Date.parse(startEvent?.ts)
  return `m_${Number.isFinite(ts) ? ts : 'unknown'}_${index}`
}

export function segmentEventsByMission(events = []) {
  const segments = []
  let current = null

  events.forEach((event, index) => {
    if (!event?.type) return
    if (event.type === 'mission.start') {
      if (current) segments.push(current)
      current = {
        id: computeSegmentId(event, index),
        name: event.data?.mission || null,
        startedAt: event.ts || null,
        events: [event],
      }
      return
    }
    if (!current) return
    current.events.push(event)
    if (event.type === 'mission.closure') {
      segments.push(current)
      current = null
    }
  })
  if (current) segments.push(current)
  return segments
}

// Scope raw ledger events to the ones belonging to `mission`. Matches by
// segment id first (accurate for live data, where ids are hash-derived on
// both sides), falls back to matching by mission name, and returns an empty
// list rather than the unscoped set when no segment can be matched — the
// page must not show another mission's events.
export function scopeEventsToMission(events, mission) {
  if (!mission) return []
  const segments = segmentEventsByMission(events)
  const byId = segments.find((segment) => segment.id === mission.id)
  if (byId) return byId.events
  const byName = mission.name ? segments.find((segment) => segment.name === mission.name) : null
  return byName ? byName.events : []
}

// Scope the global agent roster to the agents assigned to `mission`,
// using the mission's own `agents` list (already computed server-side).
export function scopeAgentsToMission(agents = [], mission) {
  if (!mission) return []
  const missionAgentIds = new Set((mission.agents || []).map((agent) => agent.id || agent.name))
  if (missionAgentIds.size === 0) return []
  return agents.filter((agent) => missionAgentIds.has(agent.id) || missionAgentIds.has(agent.name))
}
