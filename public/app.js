/* Cortex Console — app.js
 * Logique live du dashboard (vanilla JS, aucune lib).
 * - fetch REST (/api/agents, /api/events)
 * - SSE live (/api/stream)
 * - bouton Run Mission (POST /api/mission)
 * - mapping couleurs INV-006 (badge-success / badge-warning / badge-error)
 */

'use strict'

// --- état local (source de vérité du dashboard) ---
const state = {
  agents: [],
  events: [],   // tous les events connus (depuis GET + incréments SSE)
  es: null,     // EventSource
}

// --- helpers DOM ---
const $ = (sel) => document.querySelector(sel)
const el = (tag, cls, text) => {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

// --- mapping couleurs INV-006 ---
// LIVRAISON_AUTONOME -> success (vert)
// AVEC_INFORMATION   -> warning (ambre)
// ESCALADE_HUMAINE   -> error (rouge)
function closureBadgeClass(closure) {
  switch (closure) {
    case 'LIVRAISON_AUTONOME': return 'badge-success'
    case 'AVEC_INFORMATION': return 'badge-warning'
    case 'ESCALADE_HUMAINE': return 'badge-error'
    default: return 'badge-running'
  }
}

// --- formatage ---
function shortTs(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (isNaN(d)) return '—'
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const DAY = 24 * 60 * 60 * 1000

// --- KPI ---
function computeKpis() {
  const now = Date.now()
  const managers = state.agents.filter(
    (a) => a.tier === 'manager' && a.status === 'active'
  ).length

  const missions24h = state.events.filter(
    (e) => e.type === 'mission.start' && new Date(e.ts).getTime() > now - DAY
  ).length

  const closuresAuto = state.events.filter(
    (e) => e.type === 'mission.closure' && e.data && e.data.closure === 'LIVRAISON_AUTONOME'
  ).length

  let lastRun = null
  for (const e of state.events) {
    const t = new Date(e.ts).getTime()
    if (!isNaN(t) && (lastRun === null || t > lastRun)) lastRun = t
  }

  return {
    managers,
    missions24h,
    closuresAuto,
    lastRun: lastRun === null ? '—' : shortTs(new Date(lastRun).toISOString()),
  }
}

function renderKpis() {
  const k = computeKpis()
  const set = (id, val) => {
    const node = document.getElementById(id)
    if (node) node.textContent = val
  }
  set('kpi-managers', k.managers)
  set('kpi-missions', k.missions24h)
  set('kpi-closures', k.closuresAuto)
  set('kpi-last-run', k.lastRun)
}

// --- cartes agents ---
function renderAgents() {
  const grid = $('#agents-grid')
  if (!grid) return
  grid.innerHTML = ''
  if (!state.agents.length) {
    grid.appendChild(el('div', 'muted', 'Aucun agent enregistré.'))
    return
  }
  for (const a of state.agents) {
    const card = el('div', 'card agent-card')

    // header : nom + badge tier
    const header = el('div', 'agent-head')
    const tierBadge = el(
      'span',
      'badge ' + (a.tier === 'ceo' ? 'badge-success' : a.tier === 'manager' ? 'badge-running' : 'badge-warning'),
      (a.tier || 'agent').toUpperCase()
    )
    header.appendChild(el('span', 'agent-name', a.name || a.id))
    header.appendChild(tierBadge)
    card.appendChild(header)

    // provider + modèle
    card.appendChild(el('div', 'agent-provider', `${a.provider || '—'} · ${a.model || '—'}`))

    // rôle
    card.appendChild(el('div', 'agent-role', a.role || '—'))

    // métriques cost / quality
    const metrics = el('div', 'agent-metrics')
    const c = el('div', 'metric')
    c.appendChild(el('span', 'metric-label', 'COST'))
    c.appendChild(el('span', 'metric-val', a.cost_index != null ? String(a.cost_index) : '—'))
    const q = el('div', 'metric')
    q.appendChild(el('span', 'metric-label', 'QUALITY'))
    q.appendChild(el('span', 'metric-val', a.quality_index != null ? String(a.quality_index) : '—'))
    metrics.appendChild(c)
    metrics.appendChild(q)
    card.appendChild(metrics)

    // footer : toggle on/off selon status
    const footer = el('div', 'agent-foot')
    const active = a.status === 'active'
    const toggle = el('span', 'toggle ' + (active ? 'toggle-on' : 'toggle-off'),
      active ? 'ACTIF' : 'PAUSÉ')
    footer.appendChild(toggle)
    footer.appendChild(el('span', 'agent-status-text', a.status || 'unknown'))
    card.appendChild(footer)

    grid.appendChild(card)
  }
}

// --- feed (SSE + historique) ---
// résume lisible par type d'event
function eventSummary(e) {
  const d = e.data || {}
  switch (e.type) {
    case 'mission.start':
      return `${d.mission || 'mission'} (${d.domain || '—'}), ${d.rules != null ? d.rules : '?'} règle(s)`
    case 'check.run':
      return `check ${d.rule || '?'} — ${d.violation ? 'VIOLATION' : d.matched ? 'match' : 'ok'} (${d.findings != null ? d.findings : 0} findings)`
    case 'budget.eval':
      return `budget explorations=${d.explorations}/${d.limits?.maxExplorations ?? '?'} · reworks=${d.reworks} · coût=${d.cost}${d.over && d.over.length ? ' ⚠ DÉPASSEMENT' : ''}`
    case 'mission.closure': {
      const badge = closureBadgeClass(d.closure)
      return `closure <span class="badge ${badge}">${d.closure || '—'}</span> · escalades=${d.escalations ?? 0}`
    }
    default:
      return JSON.stringify(d)
  }
}

function appendFeed(e) {
  const feed = $('#feed')
  if (!feed) return
  const row = el('div', 'feed-row')
  const ts = el('span', 'feed-ts mono', shortTs(e.ts))
  const type = el('span', 'feed-type', e.type)

  // badge de statut live pour closure / running
  if (e.type === 'mission.closure' && e.data) {
    type.classList.add(closureBadgeClass(e.data.closure))
  } else if (e.type === 'mission.start') {
    type.classList.add('badge-running')
  }

  const detail = el('span', 'feed-detail')
  detail.innerHTML = eventSummary(e)

  row.appendChild(ts)
  row.appendChild(type)
  row.appendChild(detail)
  feed.appendChild(row)
  feed.scrollTop = feed.scrollHeight
}

function renderFeedHistory() {
  const feed = $('#feed')
  if (!feed) return
  feed.innerHTML = ''
  for (const e of state.events) appendFeed(e)
}

// --- chargement initial ---
async function loadAgents() {
  try {
    const r = await fetch('/api/agents')
    const j = await r.json()
    state.agents = j.agents || []
    renderAgents()
    renderKpis()
  } catch (err) {
    console.error('loadAgents:', err)
  }
}

async function loadEvents() {
  try {
    const r = await fetch('/api/events')
    const j = await r.json()
    state.events = j.events || []
    renderFeedHistory()
    renderKpis()
  } catch (err) {
    console.error('loadEvents:', err)
  }
}

// --- SSE live ---
function connectStream() {
  if (state.es) state.es.close()
  state.es = new EventSource('/api/stream')

  state.es.onmessage = (ev) => {
    let e
    try { e = JSON.parse(ev.data) } catch { return }
    if (!e || !e.type) return
    // évite les doublons (hash comme clé naturelle)
    const key = e.hash
    if (key && state.events.some((x) => x.hash === key)) return
    state.events.push(e)
    appendFeed(e)
    renderKpis()
  }

  state.es.onerror = () => {
    // EventSource gère le reconnect (retry:3000 côté serveur). Log discret.
    appendFeed({ ts: new Date().toISOString(), type: 'stream', data: { note: 'reconnexion SSE…' } })
  }
}

// --- Run Mission ---
async function runMission() {
  const btn = $('#run-mission') || document.querySelector('.button-primary')
  const original = btn ? btn.textContent : ''
  if (btn) { btn.disabled = true; btn.textContent = 'Exécution…' }

  appendFeed({ ts: new Date().toISOString(), type: 'mission.request', data: { note: 'Run Mission déclenché' } })

  try {
    const r = await fetch('/api/mission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'frontend', mission: 'manual', fixture: 'clean' }),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = await r.json()
    // recharge agents + events (les events live arrivent aussi via SSE ; on fusionne)
    await loadAgents()
    await loadEvents()
    const closure = j.report && j.report.closure
    appendFeed({
      ts: new Date().toISOString(),
      type: 'mission.done',
      data: { note: `rapport reçu · closure=${closure || '—'}` },
    })
  } catch (err) {
    console.error('runMission:', err)
    appendFeed({
      ts: new Date().toISOString(),
      type: 'mission.error',
      data: { note: `échec Run Mission : ${err.message}` },
    })
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = original }
  }
}

// --- init ---
function init() {
  const btn = $('#run-mission') || document.querySelector('.button-primary')
  if (btn) btn.addEventListener('click', runMission)

  loadAgents()
  loadEvents()
  connectStream()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
