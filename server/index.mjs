#!/usr/bin/env node
/**
 * server/index.mjs — dashboard local Cortex (observabilite live).
 *
 * Lit le registry (annuaire des agents) + le ledger NDJSON (events en direct)
 * et les sert a l'UI via API REST + Server-Sent Events (SSE).
 * Le bouton "Run Mission" lance VRAIMENT le CoS sur un fixture ; les events
 * apparaissent en direct dans le feed.
 *
 * Usage: node server/index.mjs [--port 4173]
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runMission } from '../runtime/chief-of-staff.mjs'
import { EventStore, readEvents } from '../runtime/event-store.mjs'
import { compile } from '../compile-bundle.mjs'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const PUBLIC = path.join(ROOT, 'public')
const REGISTRY = path.join(ROOT, 'registry', 'registry.json')
const LEDGER_DIR = path.join(ROOT, 'ledger')
const LEDGER_FILE = path.join(LEDGER_DIR, 'events.ndjson')
fs.mkdirSync(LEDGER_DIR, { recursive: true })

const PORT = Number(process.argv.includes('--port') && process.argv[process.argv.indexOf('--port') + 1]) || 4173

// --- lecteurs ---
function getAgents() {
  const reg = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'))
  return reg.entries.filter((e) => e.type === 'agent').map((a) => ({
    id: a.id, name: a.name, tier: a.tier, provider: a.provider, model: a.model,
    role: a.role, status: a.status, cost_index: a.cost_index, quality_index: a.quality_index,
  }))
}

function getEvents() {
  return readEvents(LEDGER_FILE)
}

// --- SSE : diffuse les nouvelles lignes du ledger ---
const sseClients = new Set()
function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`
  for (const res of sseClients) res.write(data)
}
// on surveille le fichier pour tout append externe (ex: CLI CoS direct)
let lastSize = fs.existsSync(LEDGER_FILE) ? fs.statSync(LEDGER_FILE).size : 0
let watchTimer = null
function startWatch() {
  watchTimer = setInterval(() => {
    if (!fs.existsSync(LEDGER_FILE)) return
    const size = fs.statSync(LEDGER_FILE).size
    if (size > lastSize) {
      const buf = fs.readFileSync(LEDGER_FILE, 'utf8')
      const lines = buf.slice(lastSize).split('\n').filter(Boolean)
      for (const l of lines) {
        try { broadcast(JSON.parse(l)) } catch {}
      }
      lastSize = size
    }
  }, 500)
}

// --- router statique ---
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' }
function serveStatic(req, res) {
  let url = req.url.split('?')[0]
  if (url === '/') url = '/index.html'
  const file = path.join(PUBLIC, path.normalize(url))
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) {
    res.writeHead(404); res.end('Not found'); return
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
}

// --- API ---
function sendJson(res, obj, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(obj))
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0]
  try {
    if (url === '/api/agents') return sendJson(res, { agents: getAgents() })
    if (url === '/api/events') return sendJson(res, { events: getEvents() })
    if (url === '/api/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache', 'Connection': 'keep-alive',
      })
      res.write('retry: 3000\n\n')
      sseClients.add(res)
      req.on('close', () => sseClients.delete(res))
      return
    }
    if (url === '/api/mission' && req.method === 'POST') {
      let body = ''
      for await (const c of req) body += c
      const { domain = 'frontend', mission = 'manual', fixture = 'clean' } = JSON.parse(body || '{}')
      // compile un bundle de la meme facon que le CLI
      const { bundle, outPath } = compile({ mission, domain, level: 'standard' })
      const target = path.join(ROOT, 'test', 'fixtures', fixture)
      const store = new EventStore(LEDGER_FILE)
      const report = await runMission({ bundlePath: outPath, target, eventStore: store })
      store.close()
      // le watch diffusera deja les lignes ; on renvoie aussi le rapport
      return sendJson(res, { report, events: readEvents(LEDGER_FILE) })
    }
    if (url.startsWith('/api/')) return sendJson(res, { error: 'unknown endpoint' }, 404)
    return serveStatic(req, res)
  } catch (e) {
    return sendJson(res, { error: String(e?.message || e) }, 500)
  }
})

server.listen(PORT, () => {
  startWatch()
  console.log(`Cortex Console -> http://localhost:${PORT}`)
})
