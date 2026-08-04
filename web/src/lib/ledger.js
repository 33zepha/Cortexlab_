// Pure helpers + live data hook for the Cortex ledger (NDJSON event stream).
// Mirrors the semantics that used to live in public/app.js, ported to React.
// Single source of truth for the INV-006 closure -> badge mapping:
//   LIVRAISON_AUTONOME -> success · AVEC_INFORMATION -> warning · ESCALADE_HUMAINE -> error
import { useCallback, useEffect, useState } from 'react'

const DAY = 24 * 60 * 60 * 1000

/** Ticking clock so relative timestamps stay honest without a reload. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function relativeTime(ts, now = Date.now()) {
  if (!ts) return '—'
  const t = new Date(ts).getTime()
  if (Number.isNaN(t)) return '—'
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 60) return `il y a ${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `il y a ${h} h`
  return `il y a ${Math.round(h / 24)} j`
}

/** Budget thresholds from ui/DESIGN.md: <60% green, 60–85% amber, >85% red. */
export function budgetTone(pct) {
  if (pct == null) return 'neutral'
  if (pct > 85) return 'error'
  if (pct >= 60) return 'warning'
  return 'success'
}

export function closureVariant(closure) {
  switch (closure) {
    case 'LIVRAISON_AUTONOME':
      return 'success'
    case 'AVEC_INFORMATION':
      return 'warning'
    case 'ESCALADE_HUMAINE':
      return 'error'
    default:
      return 'running'
  }
}

export function shortTs(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/**
 * Decision-oriented metrics, split between *health* (is anything wrong, what
 * does it cost, is autonomy holding) and *activity* (what is moving right now).
 *
 * Every figure below is derived from data the runtime actually emits. Notably
 * `budget.eval.cost` is a unitless index bounded by `limits.maxCost` — it is
 * NOT a currency, so it is reported as consumption against its limit.
 */
export function computeKpis(agents, events) {
  const now = Date.now()
  const within = (e, from, to = 0) => {
    const t = new Date(e.ts).getTime()
    return t > now - from && t <= now - to
  }

  const starts = events.filter((e) => e.type === 'mission.start')
  const closures = events.filter((e) => e.type === 'mission.closure')

  // Missions are closed in order, so anything started past the last closure is live.
  const missionsActive = Math.max(0, starts.length - closures.length)
  const missions24h = starts.filter((e) => within(e, DAY)).length

  const closuresAuto = closures.filter((e) => e.data?.closure === 'LIVRAISON_AUTONOME').length

  // INV-006: an escalated closure is exactly what awaits a human decision.
  const approvals = closures.filter((e) => e.data?.closure === 'ESCALADE_HUMAINE').length

  // Autonomy rate today vs the 24h before — no previous data means no delta,
  // rather than a fabricated trend.
  const rateOf = (list) =>
    list.length
      ? Math.round(
          (100 * list.filter((e) => e.data?.closure === 'LIVRAISON_AUTONOME').length) / list.length
        )
      : null
  const autonomyRate = rateOf(closures.filter((e) => within(e, DAY)))
  const autonomyPrev = rateOf(closures.filter((e) => within(e, 2 * DAY, DAY)))
  const autonomyDelta =
    autonomyRate != null && autonomyPrev != null ? autonomyRate - autonomyPrev : null

  // Budget consumed today against the limits the missions declared.
  const budgets = events.filter((e) => e.type === 'budget.eval' && within(e, DAY))
  const budgetCost = budgets.reduce((s, e) => s + (e.data?.cost || 0), 0)
  const budgetLimit = budgets.reduce((s, e) => s + (e.data?.limits?.maxCost || 0), 0)
  const budgetPct = budgetLimit > 0 ? Math.round((100 * budgetCost) / budgetLimit) : null
  const budgetOver = budgets.some((e) => e.data?.over?.length > 0)

  const agentsTotal = agents.length
  const agentsAvailable = agents.filter((a) => a.status === 'active').length

  const lastEvent = events.length ? events[events.length - 1] : null

  return {
    // health
    approvals,
    autonomyRate,
    autonomyDelta,
    budgetCost,
    budgetLimit,
    budgetPct,
    budgetOver,
    // activity
    missionsActive,
    missions24h,
    closuresAuto,
    agentsAvailable,
    agentsTotal,
    lastEvent,
    // sidebar readouts
    agents: agentsTotal,
    lastRun: lastEvent ? shortTs(lastEvent.ts) : '—',
  }
}

/**
 * What an agent is actually doing, straight from its mandates in the ledger.
 * A mandate is `agent.assigned`; its outcome is the matching `agent.result`.
 * An assignment with no result yet is still running.
 */
export function agentActivity(agentId, events) {
  let mission = null
  let assigned = null
  let result = null
  let mandates = 0
  let violations = 0
  let cost = 0
  let missionOfAssignment = null

  for (const e of events) {
    if (e.type === 'mission.start') mission = e.data?.mission || null

    if (e.type === 'agent.assigned' && e.data?.agent === agentId) {
      mandates += 1
      cost += e.data.cost || 0
      assigned = e
      result = null
      missionOfAssignment = mission
    }

    if (e.type === 'agent.result' && e.data?.agent === agentId) {
      if (e.data.violation) violations += 1
      result = e
    }
  }

  const running = assigned != null && result == null

  return {
    hasHistory: mandates > 0,
    running,
    // rule under mandate right now, or the last one handled
    rule: assigned?.data?.rule || null,
    mission: missionOfAssignment,
    since: assigned?.ts || null,
    rationale: assigned?.data?.rationale || null,
    lastResult: result
      ? {
          rule: result.data.rule,
          violation: !!result.data.violation,
          findings: result.data.findings ?? 0,
          durationMs: result.data.duration_ms ?? null,
          ts: result.ts,
        }
      : null,
    mandates,
    violations,
    cost: Math.round(cost * 100) / 100,
  }
}

/** Structured, renderer-agnostic description of a ledger event (no HTML strings). */
export function describeEvent(e) {
  const d = e.data || {}
  switch (e.type) {
    case 'mission.start':
      return {
        icon: 'search',
        title: 'Mission démarrée',
        detail: `${d.mission || 'mission'} (${d.domain || '—'}), ${d.rules ?? '?'} règle(s)`,
      }
    case 'check.run':
      return {
        icon: 'shield',
        title: `Check ${d.rule || '?'}`,
        detail: `${d.violation ? 'VIOLATION' : d.matched ? 'match' : 'ok'} · ${d.findings ?? 0} findings`,
        variant: d.violation ? 'error' : undefined,
      }
    case 'agent.assigned':
      return {
        icon: 'users',
        title: `Mandat → ${d.name || d.agent}`,
        detail: `${d.rule} · coût ${d.cost}`,
      }
    case 'agent.result':
      return {
        icon: d.violation ? 'alert' : 'shield',
        title: `${d.name || d.agent} — ${d.violation ? 'violation' : 'conforme'}`,
        detail: `${d.rule} · ${d.findings ?? 0} finding(s)${d.duration_ms != null ? ` · ${d.duration_ms} ms` : ''}`,
        variant: d.violation ? 'error' : undefined,
      }
    case 'budget.eval':
      return {
        icon: 'gauge',
        title: 'Budget évalué',
        detail: `explorations=${d.explorations}/${d.limits?.maxExplorations ?? '?'} · reworks=${d.reworks} · coût=${d.cost}${d.over?.length ? ' ⚠ dépassement' : ''}`,
        variant: d.over?.length ? 'warning' : undefined,
      }
    case 'mission.closure':
      return {
        icon: 'flag',
        title: 'Closure',
        detail: `escalades=${d.escalations ?? 0}`,
        variant: closureVariant(d.closure),
        badgeLabel: d.closure || '—',
      }
    default:
      return { icon: 'dot', title: e.type, detail: JSON.stringify(d) }
  }
}

/**
 * Events from the last (or currently running) mission only — i.e. everything
 * from the most recent `mission.start` onward. The ledger has no per-agent
 * attribution today (Hermes/CoS is the sole emitter), so a "reasoning trace"
 * is necessarily mission-scoped, not agent-scoped.
 */
export function lastMissionTrace(events) {
  let startIdx = -1
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].type === 'mission.start') {
      startIdx = i
      break
    }
  }
  return startIdx === -1 ? [] : events.slice(startIdx)
}

/** Live ledger state: initial fetch + SSE stream, matching server/index.mjs's contract. */
export function useLedger() {
  const [agents, setAgents] = useState([])
  const [events, setEvents] = useState([])
  const [connected, setConnected] = useState(false)

  const loadAgents = useCallback(async () => {
    const r = await fetch('/api/agents')
    const j = await r.json()
    setAgents(j.agents || [])
  }, [])

  const loadEvents = useCallback(async () => {
    const r = await fetch('/api/events')
    const j = await r.json()
    setEvents(j.events || [])
  }, [])

  useEffect(() => {
    loadAgents()
    loadEvents()

    const es = new EventSource('/api/stream')
    es.onopen = () => setConnected(true)
    es.onmessage = (ev) => {
      let e
      try {
        e = JSON.parse(ev.data)
      } catch {
        return
      }
      if (!e || !e.type) return
      setEvents((prev) => (e.hash && prev.some((x) => x.hash === e.hash) ? prev : [...prev, e]))
    }
    es.onerror = () => setConnected(false)

    return () => es.close()
  }, [loadAgents, loadEvents])

  const runMission = useCallback(async () => {
    const r = await fetch('/api/mission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'frontend', mission: 'manual', fixture: 'clean' }),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = await r.json()
    await loadAgents()
    await loadEvents()
    return j
  }, [loadAgents, loadEvents])

  return { agents, events, connected, kpis: computeKpis(agents, events), runMission }
}
