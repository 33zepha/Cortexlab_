#!/usr/bin/env node
/**
 * Serveur local Cortex : API runtime, SSE et application React compilée.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runMission } from '../runtime/chief-of-staff.mjs'
import { EventStore, readEvents } from '../runtime/event-store.mjs'
import { buildMissionControl } from '../runtime/mission-projection.mjs'
import { compile } from '../compile-bundle.mjs'
import { runOrchestrationV2, isV2Enabled } from '../runtime/orchestrator-v2.mjs'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const PUBLIC = path.join(ROOT, 'web', 'dist')
const REGISTRY = path.join(ROOT, 'registry', 'registry.json')
const LEDGER_DIR = path.join(ROOT, 'ledger')
const LEDGER_FILE = path.join(LEDGER_DIR, 'events.ndjson')
fs.mkdirSync(LEDGER_DIR, { recursive: true })

const PORT = Number(process.argv.includes('--port') && process.argv[process.argv.indexOf('--port') + 1]) || 4173

function getAgents() {
  const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'))
  return registry.entries
    .filter((entry) => entry.type === 'agent')
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      tier: agent.tier,
      provider: agent.provider,
      model: agent.model,
      role: agent.role,
      status: agent.status,
      cost_index: agent.cost_index,
      quality_index: agent.quality_index,
      strengths: agent.strengths || [],
    }))
}

function getEvents() {
  return readEvents(LEDGER_FILE)
}

const sseClients = new Set()
function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`
  for (const response of sseClients) response.write(data)
}

let lastSize = fs.existsSync(LEDGER_FILE) ? fs.statSync(LEDGER_FILE).size : 0
function startWatch() {
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

  // Fallback SPA pour les futures routes React.
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
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0]
  try {
    if (url === '/api/agents') return sendJson(res, { agents: getAgents() })
    if (url === '/api/events') return sendJson(res, { events: getEvents() })
    if (url === '/api/missions') return sendJson(res, buildMissionControl(getEvents()))

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

    if (url === '/api/mission' && req.method === 'POST') {
      const token = process.env.CORTEX_API_TOKEN
      const auth = req.headers['authorization'] || ''
      if (!token || !auth.startsWith('Bearer ') || auth.slice(7) !== token) {
        return sendJson(res, { error: 'Unauthorized' }, 401)
      }
      let body = ''
      for await (const chunk of req) body += chunk
      const { domain = 'frontend', mission = 'manual', fixture = 'clean' } = JSON.parse(body || '{}')
      const { outPath } = compile({ mission, domain, level: 'standard' })
      const target = path.join(ROOT, 'test', 'fixtures', fixture)
      const store = new EventStore(LEDGER_FILE)
      const report = await runMission({ bundlePath: outPath, target, eventStore: store })
      store.close()
      return sendJson(res, {
        report,
        events: getEvents(),
        missionControl: buildMissionControl(getEvents()),
      })
    }

    if (url === '/api/mission-v2' && req.method === 'POST') {
      if (!isV2Enabled()) {
        return sendJson(res, { error: 'CORTEX_ORCHESTRATION_V2 not enabled' }, 403)
      }
      const token = process.env.CORTEX_API_TOKEN
      const auth = req.headers['authorization'] || ''
      if (!token || !auth.startsWith('Bearer ') || auth.slice(7) !== token) {
        return sendJson(res, { error: 'Unauthorized' }, 401)
      }
      let body = ''
      for await (const chunk of req) body += chunk
      const parsed = JSON.parse(body || '{}')
      const { mission = null, adapter_snapshot = null, auth: execAuth = null } = parsed
      if (!mission) return sendJson(res, { error: 'mission required' }, 400)
      const ledgerV2 = path.join(LEDGER_DIR, 'e2e-v2.ndjson')
      const result = await runOrchestrationV2(
        {
          mission,
          adapter_snapshot,
          auth: execAuth,
          baseRef: process.env.CORTEX_V2_BASE_REF || null,
          repoRoot: ROOT,
          ledgerPath: ledgerV2,
          expectBugFix: Boolean(parsed.expect_bugfix),
          targetedTestCommand: parsed.targeted_test_command || null,
        },
        { env: process.env, argv: process.argv },
      )
      return sendJson(res, {
        enabled: result.enabled,
        plan_hash: result.plan_hash || null,
        executable: result.executable ?? null,
        events_v2: result.events_v2 || [],
        session_result: result.session_result || null,
        missionControl: buildMissionControl(getEvents()),
      })
    }

    return serveStatic(req, res)
  } catch (error) {
    return sendJson(res, { error: String(error?.message || error) }, 500)
  }
})

server.listen(PORT, () => {
  startWatch()
  console.log(`Cortex Console -> http://localhost:${PORT}`)
})
