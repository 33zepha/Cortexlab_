import { useCallback, useEffect, useState } from 'react'
import { demoAgents, demoEvents, demoMissions, demoSummary } from './demo.js'

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
  const value = new Date(ts).getTime()
  if (Number.isNaN(value)) return '—'
  const seconds = Math.max(0, Math.round((now - value) / 1000))
  if (seconds < 60) return `il y a ${seconds} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  return `il y a ${Math.round(hours / 24)} j`
}

export function shortTs(ts) {
  if (!ts) return '—'
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

export function closureVariant(closure) {
  switch (closure) {
    case 'LIVRAISON_AUTONOME': return 'success'
    case 'AVEC_INFORMATION': return 'warning'
    case 'ESCALADE_HUMAINE': return 'error'
    default: return 'neutral'
  }
}

export function agentActivity(agentId, events) {
  let currentMission = null
  let assignment = null
  let result = null
  let mandates = 0
  let violations = 0
  let cost = 0
  let missionOfAssignment = null

  for (const event of events) {
    if (event.type === 'mission.start') currentMission = event.data?.mission || null
    if (event.type === 'agent.assigned' && event.data?.agent === agentId) {
      mandates += 1
      cost += event.data?.cost || 0
      assignment = event
      result = null
      missionOfAssignment = currentMission
    }
    if (event.type === 'agent.result' && event.data?.agent === agentId) {
      if (event.data?.violation) violations += 1
      result = event
    }
  }

  return {
    hasHistory: mandates > 0,
    running: Boolean(assignment && !result),
    rule: assignment?.data?.rule || null,
    mission: missionOfAssignment,
    since: assignment?.ts || null,
    rationale: assignment?.data?.rationale || null,
    lastResult: result
      ? {
          rule: result.data?.rule || null,
          violation: Boolean(result.data?.violation),
          findings: result.data?.findings ?? 0,
          durationMs: result.data?.duration_ms ?? null,
          ts: result.ts,
        }
      : null,
    mandates,
    violations,
    cost: Math.round(cost * 100) / 100,
  }
}

export function describeEvent(event) {
  const data = event.data || {}
  switch (event.type) {
    case 'mission.start':
      return {
        icon: 'target',
        title: 'Mission démarrée',
        detail: `${data.mission || 'Mission'} · ${data.domain || 'all'}`,
      }
    case 'agent.assigned':
      return {
        icon: 'users',
        title: `Mandat confié à ${data.name || data.agent || 'agent'}`,
        detail: data.rule || 'nouveau mandat',
      }
    case 'agent.result':
      return {
        icon: data.violation ? 'alert' : 'check',
        title: data.violation ? 'Violation détectée' : 'Résultat validé',
        detail: `${data.rule || 'check'} · ${data.findings ?? 0} finding(s)`,
        variant: data.violation ? 'error' : 'success',
      }
    case 'check.run':
      return {
        icon: 'shield',
        title: `Check ${data.rule || '?'}`,
        detail: `${data.violation ? 'violation' : 'conforme'} · ${data.findings ?? 0} finding(s)`,
        variant: data.violation ? 'error' : 'success',
      }
    case 'budget.eval':
      return {
        icon: 'gauge',
        title: 'Budget évalué',
        detail: `${data.cost ?? 0} / ${data.limits?.maxCost ?? '—'}`,
        variant: data.over?.length ? 'warning' : 'neutral',
      }
    case 'mission.closure':
      return {
        icon: 'flag',
        title: 'Mission clôturée',
        detail: data.closure || 'closure',
        variant: closureVariant(data.closure),
      }
    default:
      return {
        icon: 'activity',
        title: event.type,
        detail: data.note || data.rule || data.mission || 'événement Cortex',
      }
  }
}

function isDemoMode() {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1'
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} · HTTP ${response.status}`)
  return response.json()
}

export function useLedger() {
  const demo = isDemoMode()
  const [agents, setAgents] = useState(() => (demo ? demoAgents : []))
  const [events, setEvents] = useState(() => (demo ? demoEvents : []))
  const [missions, setMissions] = useState(() => (demo ? demoMissions : []))
  const [summary, setSummary] = useState(() => (demo ? demoSummary : {}))
  const [connected, setConnected] = useState(demo)
  const [lastSync, setLastSync] = useState(() => (demo ? demoSummary.latest_activity : null))

  const loadAgents = useCallback(async () => {
    if (demo) return
    const payload = await fetchJson('/api/agents')
    setAgents(payload.agents || [])
  }, [demo])

  const loadEvents = useCallback(async () => {
    if (demo) return
    const payload = await fetchJson('/api/events')
    setEvents(payload.events || [])
  }, [demo])

  const loadMissions = useCallback(async () => {
    if (demo) return
    const payload = await fetchJson('/api/missions')
    setMissions(payload.missions || [])
    setSummary(payload.summary || {})
    setLastSync(payload.summary?.latest_activity || new Date().toISOString())
  }, [demo])

  const reload = useCallback(async () => {
    if (demo) return
    await Promise.all([loadAgents(), loadEvents(), loadMissions()])
  }, [demo, loadAgents, loadEvents, loadMissions])

  useEffect(() => {
    if (demo) return undefined
    reload().catch(() => setConnected(false))

    const source = new EventSource('/api/stream')
    source.onopen = () => setConnected(true)
    source.onmessage = (message) => {
      let event
      try {
        event = JSON.parse(message.data)
      } catch {
        return
      }
      if (!event?.type) return
      setEvents((current) => (
        event.hash && current.some((item) => item.hash === event.hash)
          ? current
          : [...current, event]
      ))
      setLastSync(event.ts || new Date().toISOString())
      loadMissions().catch(() => {})
    }
    source.onerror = () => setConnected(false)
    return () => source.close()
  }, [demo, loadMissions, reload])

  const runMission = useCallback(async () => {
    if (demo) {
      await new Promise((resolve) => setTimeout(resolve, 650))
      return { demo: true }
    }
    const response = await fetch('/api/mission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'frontend', mission: 'manual', fixture: 'clean' }),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json()
    await reload()
    return payload
  }, [demo, reload])

  return {
    agents,
    events,
    missions,
    summary,
    connected,
    lastSync,
    runMission,
    reload,
    demo,
  }
}
