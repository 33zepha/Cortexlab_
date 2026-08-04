/* Cortex Console — dashboard live, table agents dense */
'use strict'

const state = {
  agents: [],
  events: [],
  es: null,
  query: '',
  statusFilter: 'all',
}

const $ = (selector) => document.querySelector(selector)
const el = (tag, className, text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined && text !== null) node.textContent = text
  return node
}

const DAY = 24 * 60 * 60 * 1000

function closureBadgeClass(closure) {
  switch (closure) {
    case 'LIVRAISON_AUTONOME': return 'badge-success'
    case 'AVEC_INFORMATION': return 'badge-warning'
    case 'ESCALADE_HUMAINE': return 'badge-error'
    default: return 'badge-neutral'
  }
}

function shortTs(ts) {
  if (!ts) return '—'
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function computeKpis() {
  const now = Date.now()
  const managers = state.agents.filter(
    (agent) => agent.tier === 'manager' && agent.status === 'active'
  ).length
  const missions24h = state.events.filter(
    (event) => event.type === 'mission.start' && new Date(event.ts).getTime() > now - DAY
  ).length
  const closuresAuto = state.events.filter(
    (event) => event.type === 'mission.closure' && event.data?.closure === 'LIVRAISON_AUTONOME'
  ).length
  const lastRun = state.events.reduce((latest, event) => {
    const time = new Date(event.ts).getTime()
    return Number.isNaN(time) || time <= latest ? latest : time
  }, 0)

  return {
    managers,
    missions24h,
    closuresAuto,
    lastRun: lastRun ? shortTs(lastRun) : '—',
  }
}

function renderKpis() {
  const values = computeKpis()
  const targets = {
    'kpi-managers': values.managers,
    'kpi-missions': values.missions24h,
    'kpi-closures': values.closuresAuto,
    'kpi-last-run': values.lastRun,
  }
  for (const [id, value] of Object.entries(targets)) {
    const node = document.getElementById(id)
    if (node) node.textContent = value
  }
}

function tierLabel(tier) {
  if (tier === 'ceo') return 'CEO'
  if (tier === 'manager') return 'Manager'
  return tier || 'Agent'
}

function costLabel(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return { label: 'Non mesuré', className: 'metric-neutral', raw: '—' }
  if (number <= 0.6) return { label: 'Bas', className: 'metric-good', raw: number.toFixed(1) }
  if (number <= 1.2) return { label: 'Modéré', className: 'metric-neutral', raw: number.toFixed(1) }
  return { label: 'Élevé', className: 'metric-warning', raw: number.toFixed(1) }
}

function qualityLabel(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return { percent: '—', className: 'quality-neutral', width: 0 }
  const normalized = number <= 1 ? number * 100 : number
  const percent = Math.max(0, Math.min(100, Math.round(normalized)))
  const className = percent >= 92 ? 'quality-high' : percent >= 85 ? 'quality-medium' : 'quality-low'
  return { percent: `${percent}%`, className, width: percent }
}

function filteredAgents() {
  const query = state.query.trim().toLocaleLowerCase('fr-FR')
  return state.agents.filter((agent) => {
    const statusMatch = state.statusFilter === 'all' ||
      (state.statusFilter === 'active' && agent.status === 'active') ||
      (state.statusFilter === 'paused' && agent.status !== 'active')

    if (!statusMatch) return false
    if (!query) return true

    const haystack = [
      agent.name,
      agent.id,
      agent.role,
      agent.provider,
      agent.model,
      agent.tier,
      agent.status,
    ].filter(Boolean).join(' ').toLocaleLowerCase('fr-FR')

    return haystack.includes(query)
  })
}

function renderEmptyRow(message) {
  const body = $('#agents-table-body')
  if (!body) return
  const row = el('tr', 'table-empty-row')
  const cell = el('td', '', message)
  cell.colSpan = 7
  row.appendChild(cell)
  body.appendChild(row)
}

function renderAgents() {
  const body = $('#agents-table-body')
  const count = $('#agents-count')
  if (!body) return

  body.innerHTML = ''
  const agents = filteredAgents()

  if (count) {
    count.textContent = agents.length === state.agents.length
      ? `${state.agents.length} enregistré${state.agents.length > 1 ? 's' : ''}`
      : `${agents.length} / ${state.agents.length} visibles`
  }

  if (!agents.length) {
    renderEmptyRow(state.agents.length ? 'Aucun agent ne correspond aux filtres.' : 'Aucun agent enregistré.')
    return
  }

  for (const agent of agents) {
    const row = el('tr', 'agent-row')

    const agentCell = el('td', 'agent-identity-cell')
    const identity = el('div', 'agent-identity')
    const avatar = el('span', 'agent-avatar', (agent.name || agent.id || '?').slice(0, 1).toUpperCase())
    avatar.setAttribute('aria-hidden', 'true')
    const identityText = el('div', 'agent-identity-text')
    identityText.appendChild(el('strong', 'agent-name', agent.name || agent.id || 'Agent'))
    identityText.appendChild(el('span', 'agent-id mono', agent.id || '—'))
    identity.appendChild(avatar)
    identity.appendChild(identityText)
    agentCell.appendChild(identity)

    const roleCell = el('td', 'agent-role-cell')
    roleCell.appendChild(el('span', 'role-copy', agent.role || 'Aucune fonction déclarée'))

    const modelCell = el('td', 'agent-model-cell')
    modelCell.appendChild(el('strong', 'model-name', agent.model || '—'))
    modelCell.appendChild(el('span', 'provider-name', agent.provider || 'provider inconnu'))

    const tierCell = el('td')
    tierCell.appendChild(el('span', `tier-badge tier-${agent.tier || 'agent'}`, tierLabel(agent.tier)))

    const costCell = el('td')
    const cost = costLabel(agent.cost_index)
    const costWrap = el('div', 'metric-stack')
    costWrap.appendChild(el('span', `metric-label-value ${cost.className}`, cost.label))
    costWrap.appendChild(el('span', 'metric-raw mono', `indice ${cost.raw}`))
    costCell.appendChild(costWrap)

    const qualityCell = el('td')
    const quality = qualityLabel(agent.quality_index)
    const qualityWrap = el('div', 'quality-cell')
    const qualityTop = el('div', 'quality-top')
    qualityTop.appendChild(el('span', 'quality-value', quality.percent))
    const qualityBar = el('span', 'quality-track')
    const qualityFill = el('span', `quality-fill ${quality.className}`)
    qualityFill.style.width = `${quality.width}%`
    qualityBar.appendChild(qualityFill)
    qualityWrap.appendChild(qualityTop)
    qualityWrap.appendChild(qualityBar)
    qualityCell.appendChild(qualityWrap)

    const statusCell = el('td')
    const active = agent.status === 'active'
    const status = el('span', `status-badge ${active ? 'status-active' : 'status-paused'}`)
    status.appendChild(el('span', 'status-dot'))
    status.appendChild(document.createTextNode(active ? 'Actif' : 'En pause'))
    statusCell.appendChild(status)

    row.append(agentCell, roleCell, modelCell, tierCell, costCell, qualityCell, statusCell)
    body.appendChild(row)
  }
}

function eventDetail(event) {
  const data = event.data || {}
  switch (event.type) {
    case 'mission.start':
      return `${data.mission || 'mission'} · ${data.domain || 'domaine inconnu'} · ${data.rules ?? '?'} règle(s)`
    case 'check.run':
      return `${data.rule || 'check'} · ${data.violation ? 'violation' : data.matched ? 'match' : 'ok'} · ${data.findings ?? 0} résultat(s)`
    case 'budget.eval':
      return `explorations ${data.explorations ?? 0}/${data.limits?.maxExplorations ?? '?'} · reprises ${data.reworks ?? 0} · coût ${data.cost ?? 0}`
    case 'mission.closure':
      return `escalades ${data.escalations ?? 0}`
    default:
      return data.note || event.type || 'Événement Cortex'
  }
}

function appendFeed(event) {
  const feed = $('#feed')
  if (!feed) return

  const row = el('div', 'feed-row')
  row.appendChild(el('time', 'feed-ts mono', shortTs(event.ts)))
  row.appendChild(el('span', 'feed-type', event.type || 'event'))
  row.appendChild(el('span', 'feed-detail', eventDetail(event)))

  if (event.type === 'mission.closure') {
    const closure = event.data?.closure || 'INCONNUE'
    row.appendChild(el('span', `closure-badge ${closureBadgeClass(closure)}`, closure.replaceAll('_', ' ')))
  }

  feed.appendChild(row)
  feed.scrollTop = feed.scrollHeight
}

function renderFeedHistory() {
  const feed = $('#feed')
  if (!feed) return
  feed.innerHTML = ''
  if (!state.events.length) {
    feed.appendChild(el('div', 'feed-empty', 'Aucun événement dans le ledger.'))
    return
  }
  for (const event of state.events.slice(-40)) appendFeed(event)
}

async function loadAgents() {
  try {
    const response = await fetch('/api/agents')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    state.agents = Array.isArray(data.agents) ? data.agents : []
    renderAgents()
    renderKpis()
  } catch (error) {
    console.error('loadAgents:', error)
    const body = $('#agents-table-body')
    if (body) body.innerHTML = ''
    renderEmptyRow('Impossible de charger les agents.')
  }
}

async function loadEvents() {
  try {
    const response = await fetch('/api/events')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    state.events = Array.isArray(data.events) ? data.events : []
    renderFeedHistory()
    renderKpis()
  } catch (error) {
    console.error('loadEvents:', error)
    const feed = $('#feed')
    if (feed) {
      feed.innerHTML = ''
      feed.appendChild(el('div', 'feed-empty feed-error', 'Connexion au ledger impossible.'))
    }
  }
}

function connectStream() {
  if (state.es) state.es.close()
  state.es = new EventSource('/api/stream')

  state.es.onmessage = (message) => {
    let event
    try {
      event = JSON.parse(message.data)
    } catch {
      return
    }
    if (!event?.type) return
    if (event.hash && state.events.some((known) => known.hash === event.hash)) return
    state.events.push(event)
    appendFeed(event)
    renderKpis()
  }

  state.es.onerror = () => {
    appendFeed({
      ts: new Date().toISOString(),
      type: 'stream.reconnect',
      data: { note: 'Reconnexion au flux en cours…' },
    })
  }
}

async function runMission() {
  const button = $('#run-mission-btn')
  const original = button?.textContent || 'Run Mission'
  if (button) {
    button.disabled = true
    button.textContent = 'Exécution…'
  }

  appendFeed({
    ts: new Date().toISOString(),
    type: 'mission.request',
    data: { note: 'Demande de mission transmise au Chief of Staff.' },
  })

  try {
    const response = await fetch('/api/mission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'frontend', mission: 'manual', fixture: 'clean' }),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    await Promise.all([loadAgents(), loadEvents()])
  } catch (error) {
    console.error('runMission:', error)
    appendFeed({
      ts: new Date().toISOString(),
      type: 'mission.error',
      data: { note: `Échec de la mission : ${error.message}` },
    })
  } finally {
    if (button) {
      button.disabled = false
      button.textContent = original
    }
  }
}

function bindControls() {
  const search = $('#agent-search')
  const filter = $('#agent-filter-btn')
  const runMissionButton = $('#run-mission-btn')

  search?.addEventListener('input', (event) => {
    state.query = event.target.value
    renderAgents()
  })

  filter?.addEventListener('click', () => {
    const next = state.statusFilter === 'all' ? 'active' : state.statusFilter === 'active' ? 'paused' : 'all'
    state.statusFilter = next
    filter.textContent = next === 'all' ? 'Tous' : next === 'active' ? 'Actifs' : 'En pause'
    filter.classList.toggle('is-filtered', next !== 'all')
    renderAgents()
  })

  runMissionButton?.addEventListener('click', runMission)
}

function init() {
  bindControls()
  loadAgents()
  loadEvents()
  connectStream()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
