// Pure helpers + live data hook for the Cortex ledger (NDJSON event stream).
// Mirrors the semantics that used to live in public/app.js, ported to React.
// Single source of truth for the INV-006 closure -> badge mapping:
//   LIVRAISON_AUTONOME -> success · AVEC_INFORMATION -> warning · ESCALADE_HUMAINE -> error
import { useCallback, useEffect, useState } from 'react'

const DAY = 24 * 60 * 60 * 1000

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

export function computeKpis(agents, events) {
  const now = Date.now()
  const managers = agents.filter((a) => a.tier === 'manager' && a.status === 'active').length

  const missions24h = events.filter(
    (e) => e.type === 'mission.start' && new Date(e.ts).getTime() > now - DAY
  ).length

  const closuresAuto = events.filter(
    (e) => e.type === 'mission.closure' && e.data?.closure === 'LIVRAISON_AUTONOME'
  ).length

  // INV-006: an escalated closure is exactly what awaits a human decision.
  const approvals = events.filter(
    (e) => e.type === 'mission.closure' && e.data?.closure === 'ESCALADE_HUMAINE'
  ).length

  let lastRun = null
  for (const e of events) {
    const t = new Date(e.ts).getTime()
    if (!Number.isNaN(t) && (lastRun === null || t > lastRun)) lastRun = t
  }

  return {
    managers,
    missions24h,
    closuresAuto,
    approvals,
    agents: agents.length,
    lastRun: lastRun === null ? '—' : shortTs(new Date(lastRun).toISOString()),
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
