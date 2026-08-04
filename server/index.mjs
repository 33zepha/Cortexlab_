#!/usr/bin/env node
/**
 * Cortex Lab : cockpit d'observabilité en lecture seule.
 * Hermes lance et orchestre les missions. Cortex observe les services, le ledger,
 * les sessions et les agents, puis diffuse leur état au frontend.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readEvents } from '../runtime/event-store.mjs'
import { buildMissionControl, summarizeMissions } from '../runtime/mission-projection.mjs'
import { getHermesObservability } from './hermes-observability.mjs'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const PUBLIC = path.join(ROOT, 'web', 'dist')
const REGISTRY = path.join(ROOT, 'registry', 'registry.json')
const LEDGER_DIR = path.join(ROOT, 'ledger')
const LEDGER_FILE = path.join(LEDGER_DIR, 'events.ndjson')
fs.mkdirSync(LEDGER_DIR, { recursive: true })

const PORT = Number(process.argv.includes('--port') && process.argv[process.argv.indexOf('--port') + 1]) || 4173
const RECENT_AGENT_WINDOW_MS = Number(process.env.CORTEX_AGENT_RECENT_MS || 15 * 60 * 1000)

function getLedgerEvents() {
  return readEvents(LEDGER_FILE)
}

function eventTime(event) {
  const value = Date.parse(event?.ts)
  return Number.isFinite(value) ? value : 0
}

function sortEvents(events) {
  return [...events].sort((a, b) => eventTime(a) - eventTime(b))
}

async function getAllEvents(observation = null) {
  const system = observation || await getHermesObservability()
  return sortEvents([...getLedgerEvents(), ...(system.events || [])]).slice(-2_000)
}

function eventMatchesAgent(event, agent) {
  const data = event?.data || {}
  const identifiers = [data.agent, data.agent_id, data.name, data.model]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
  return identifiers.includes(String(agent.id).toLowerCase())
    || identifiers.includes(String(agent.name).toLowerCase())
    || identifiers.includes(String(agent.model).toLowerCase())
}

async function getAgents(observation = null) {
  const system = observation || await getHermesObservability()
  const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'))
  const events = await getAllEvents(system)
  const activeMissions = (system.missions || []).filter((mission) => mission.status === 'running')
  const now = Date.now()

  return registry.entries
    .filter((entry) => entry.type === 'agent')
    .map((agent) => {
      const latestEvent = [...events].reverse().find((event) => eventMatchesAgent(event, agent)) || null
      const activeMission = activeMissions.find((mission) => (
        mission.manager?.id === agent.id
        || mission.manager?.name === agent.name
        || mission.agents?.some((item) => item.id === agent.id || item.name === agent.name)
      )) || null
      const lastSeen = latestEvent?.ts || activeMission?.latest_event?.ts || null
      const recentlySeen = lastSeen && now - eventTime({ ts: lastSeen }) <= RECENT_AGENT_WINDOW_MS

      let runtimeStatus = 'offline'
      if (agent.id === 'AG-HERMES') runtimeStatus = system.hermes.online ? 'online' : 'offline'
      else if (activeMission) runtimeStatus = 'running'
      else if (recentlySeen) runtimeStatus = 'online'
      else if (agent.status === 'active') runtimeStatus = 'available'

      return {
        id: agent.id,
        name: agent.name,
        tier: agent.tier,
        provider: agent.provider,
        model: agent.model,
        role: agent.role,
        configured_status: agent.status,
        runtime_status: runtimeStatus,
        status: ['running', 'online'].includes(runtimeStatus) ? 'active' : runtimeStatus,
        last_seen_at: lastSeen,
        current_mission_id: activeMission?.id || null,
        cost_index: agent.cost_index,
        quality_index: agent.quality_index,
        strengths: agent.strengths || [],
      }
    })
}

function mergeMissions(ledgerEvents, hermesMissions = []) {
  const native = buildMissionControl(ledgerEvents).missions
  const byId = new Map()
  for (const mission of [...native, ...hermesMissions]) byId.set(mission.id, mission)
  return [...byId.values()].sort((a, b) => (
    eventTime(b.latest_event) - eventTime(a.latest_event)
    || eventTime({ ts: b.started_at }) - eventTime({ ts: a.started_at })
  ))
}

async function getMissionControl(observation = null) {
  const system = observation || await getHermesObservability()
  const missions = mergeMissions(getLedgerEvents(), system.missions || [])
  return {
    summary: summarizeMissions(missions),
    missions,
    sources: {
      ledger: LEDGER_FILE,
      hermes_state: system.database.available,
    },
  }
}

const sseClients = new Set()
function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`
  for (const response of sseClients) response.write(data)
}

let lastSize = fs.existsSync(LEDGER_FILE) ? fs.statSync(LEDGER_FILE).size : 0
function startLedgerWatch() {
  setInterval(() => {
    if (!fs.existsSync(LEDGER_FILE)) return
    const size = fs.statSync(LEDGER_FILE).size
    if (size < lastSize) lastSize = 0
    if (size <= lastSize) return

    const buffer = fs.readFileSync(LEDGER_FILE, 'utf8')
    const lines = buffer.slice(lastSize).split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        broadcast(JSON.parse(line))
      } catch {
        // Une ligne partielle sera relue au prochain append.
      }
    }
    lastSize = size
  }, 500)
}

let lastSystemSignature = null
function startSystemWatch() {
  setInterval(async () => {
    try {
      const observation = await getHermesObservability({ force: true })
      const signature = JSON.stringify({
        online: observation.hermes.online,
        services: observation.services.map((service) => [service.name, service.active_state, service.sub_state, service.pid, service.restarts]),
        database: observation.database.modified_at,
        issues: observation.issues,
      })
      if (signature === lastSystemSignature) return
      lastSystemSignature = signature
      broadcast({
        ts: observation.generated_at,
        type: 'system.snapshot',
        hash: `system_${Date.now()}`,
        data: {
          source: 'hermes-observability',
          hermes_online: observation.hermes.online,
          issues: observation.issues.length,
        },
      })
    } catch {
      // Le prochain passage retentera la lecture des sources.
    }
  }, Number(process.env.CORTEX_SYSTEM_POLL_MS || 5_000))
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

function serveStatic(req, res) {
  let url = req.url.split('?')[0]
  if (url === '/') url = '/index.html'
  let file = path.join(PUBLIC, path.normalize(url))

  if (!file.startsWith(PUBLIC)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  if (!fs.existsSync(file) && !path.extname(url)) file = path.join(PUBLIC, 'index.html')
  if (!fs.existsSync(file)) {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
}

function sendJson(res, payload, code = 200) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(payload))
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0]
  try {
    if (url === '/api/system') {
      return sendJson(res, await getHermesObservability())
    }

    if (url === '/api/agents') {
      const observation = await getHermesObservability()
      return sendJson(res, { agents: await getAgents(observation) })
    }

    if (url === '/api/events') {
      const observation = await getHermesObservability()
      return sendJson(res, {
        events: await getAllEvents(observation),
        sources: observation.sources,
      })
    }

    if (url === '/api/missions') {
      const observation = await getHermesObservability()
      return sendJson(res, await getMissionControl(observation))
    }

    if (url === '/api/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      res.write('retry: 3000\n\n')
      sseClients.add(res)
      req.on('close', () => sseClients.delete(res))
      return
    }

    if (url === '/api/mission') {
      return sendJson(res, {
        error: 'Cortex Lab est en lecture seule. Les missions sont lancées par Hermes.',
        read_only: true,
        hermes_url: process.env.HERMES_URL || null,
      }, 405)
    }

    if (url.startsWith('/api/')) return sendJson(res, { error: 'unknown endpoint' }, 404)
    return serveStatic(req, res)
  } catch (error) {
    return sendJson(res, { error: String(error?.message || error) }, 500)
  }
})

server.listen(PORT, () => {
  startLedgerWatch()
  startSystemWatch()
  console.log(`Cortex Lab observability -> http://localhost:${PORT}`)
})
