import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const CACHE_TTL_MS = 2_000
const DEFAULT_SERVICES = ['hermes-gateway.service', 'hermes-serve.service']
const SAFE_COLUMN = /^(id|name|title|status|state|type|role|agent|agent_id|model|provider|created_at|updated_at|started_at|finished_at|completed_at|timestamp|ts|session_id|parent_id|tool_name|success|duration_ms|input_tokens|output_tokens|total_tokens|cost|progress)$/i
const MISSION_TABLE = /(mission|run|task|session)/i
const OBSERVABLE_TABLE = /(mission|run|task|session|event|message|tool)/i

let cache = null

function expandHome(value) {
  if (!value) return value
  if (value === '~') return os.homedir()
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2))
  return value
}

function envList(name, fallback) {
  const raw = process.env[name]
  if (!raw) return fallback
  return raw.split(',').map((value) => value.trim()).filter(Boolean)
}

export function parseKeyValue(text = '') {
  return Object.fromEntries(
    String(text)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf('=')
        return separator === -1
          ? [line, '']
          : [line.slice(0, separator), line.slice(separator + 1)]
      })
  )
}

export function redactSecrets(value = '') {
  return String(value)
    .replace(/(authorization:\s*bearer\s+)[^\s]+/gi, '$1[redacted]')
    .replace(/((?:api[_-]?key|token|secret|password)\s*[=:]\s*)[^\s,;]+/gi, '$1[redacted]')
    .replace(/\b(sk-[A-Za-z0-9_-]{12,})\b/g, '[redacted]')
    .slice(0, 800)
}

async function runReadOnly(command, args = [], { timeout = 4_000, maxBuffer = 2 * 1024 * 1024 } = {}) {
  try {
    const { stdout = '', stderr = '' } = await execFileAsync(command, args, {
      timeout,
      maxBuffer,
      encoding: 'utf8',
      windowsHide: true,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        LANG: process.env.LANG || 'C.UTF-8',
      },
    })
    return { ok: true, stdout: stdout.trim(), stderr: redactSecrets(stderr.trim()) }
  } catch (error) {
    return {
      ok: false,
      stdout: redactSecrets(error?.stdout || ''),
      stderr: redactSecrets(error?.stderr || error?.message || String(error)),
      code: error?.code || null,
    }
  }
}

function normalizeService(name, fields, probe) {
  const active = fields.ActiveState === 'active' && fields.SubState !== 'failed'
  return {
    name,
    loaded: fields.LoadState === 'loaded',
    active,
    active_state: fields.ActiveState || 'unknown',
    sub_state: fields.SubState || 'unknown',
    pid: Number(fields.MainPID || 0) || null,
    restarts: Number(fields.NRestarts || 0) || 0,
    started_at: fields.ExecMainStartTimestamp || null,
    exit_status: Number(fields.ExecMainStatus || 0),
    result: fields.Result || null,
    available: probe.ok,
    error: probe.ok ? null : probe.stderr,
  }
}

async function readService(name) {
  const probe = await runReadOnly('systemctl', [
    'show',
    name,
    '--no-page',
    '--property=Id,LoadState,ActiveState,SubState,MainPID,NRestarts,ExecMainStartTimestamp,ExecMainStatus,Result',
  ])
  return normalizeService(name, parseKeyValue(probe.stdout), probe)
}

function journalTimestamp(entry) {
  const micros = Number(entry.__REALTIME_TIMESTAMP)
  if (Number.isFinite(micros) && micros > 0) return new Date(Math.floor(micros / 1000)).toISOString()
  return entry.SYSLOG_TIMESTAMP || null
}

function journalEventType(message) {
  if (/connected as/i.test(message)) return 'hermes.gateway.connected'
  if (/thread created by hermes/i.test(message)) return 'hermes.thread.created'
  if (/could not create.*thread/i.test(message)) return 'hermes.gateway.warning'
  if (/traceback|\berror\b|\bfailed\b|exception/i.test(message)) return 'hermes.log.error'
  if (/warning|\bwarn\b/i.test(message)) return 'hermes.log.warning'
  return 'hermes.log'
}

async function readJournal(service) {
  const probe = await runReadOnly('journalctl', [
    '-u',
    service,
    '-n',
    process.env.HERMES_JOURNAL_LIMIT || '100',
    '--no-pager',
    '-o',
    'json',
  ], { timeout: 6_000, maxBuffer: 4 * 1024 * 1024 })

  if (!probe.ok) return { service, available: false, events: [], error: probe.stderr }

  const events = probe.stdout
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const entry = JSON.parse(line)
        const message = redactSecrets(entry.MESSAGE || '')
        if (!message) return []
        const ts = journalTimestamp(entry)
        const hash = crypto
          .createHash('sha256')
          .update(`${service}\u0000${ts}\u0000${message}`)
          .digest('hex')
        return [{
          ts,
          type: journalEventType(message),
          hash: `hermes_${hash.slice(0, 20)}`,
          data: {
            source: 'journalctl',
            service,
            note: message,
            priority: Number(entry.PRIORITY ?? 6),
            pid: Number(entry._PID || 0) || null,
          },
        }]
      } catch {
        return []
      }
    })

  return { service, available: true, events, error: null }
}

async function readHermesVersion() {
  const probe = await runReadOnly('hermes', ['--version'])
  return {
    available: probe.ok,
    version: probe.ok ? redactSecrets(probe.stdout.split('\n')[0]) : null,
    error: probe.ok ? null : probe.stderr,
  }
}

async function readProcesses() {
  const probe = await runReadOnly('ps', ['-eo', 'pid=,etimes=,comm=,args='])
  if (!probe.ok) return { available: false, items: [], error: probe.stderr }

  const items = probe.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /hermes/i.test(line) && !/grep|cortex/i.test(line))
    .slice(0, 30)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/)
      if (!match) return { raw: redactSecrets(line) }
      return {
        pid: Number(match[1]),
        uptime_seconds: Number(match[2]),
        command: match[3],
        args: redactSecrets(match[4]),
      }
    })
  return { available: true, items, error: null }
}

async function readTailscale() {
  const [ipProbe, statusProbe] = await Promise.all([
    runReadOnly('tailscale', ['ip', '-4']),
    runReadOnly('tailscale', ['status', '--json'], { timeout: 6_000 }),
  ])

  let status = null
  if (statusProbe.ok) {
    try {
      const parsed = JSON.parse(statusProbe.stdout)
      status = {
        backend_state: parsed.BackendState || null,
        dns_name: parsed.Self?.DNSName || null,
        ips: parsed.TailscaleIPs || parsed.Self?.TailscaleIPs || [],
        tailnet: parsed.CurrentTailnet?.Name || null,
      }
    } catch {
      status = null
    }
  }

  return {
    available: ipProbe.ok || statusProbe.ok,
    ip: ipProbe.ok ? ipProbe.stdout.split('\n')[0] || null : null,
    ...status,
    error: ipProbe.ok || statusProbe.ok ? null : (statusProbe.stderr || ipProbe.stderr),
  }
}

function safeIdentifier(value) {
  return /^[A-Za-z0-9_]+$/.test(value) ? value : null
}

async function sqliteJson(databasePath, query) {
  const probe = await runReadOnly('sqlite3', ['-json', '-readonly', databasePath, query], {
    timeout: 6_000,
    maxBuffer: 6 * 1024 * 1024,
  })
  if (!probe.ok) return { ok: false, rows: [], error: probe.stderr }
  if (!probe.stdout) return { ok: true, rows: [], error: null }
  try {
    const parsed = JSON.parse(probe.stdout)
    return { ok: true, rows: Array.isArray(parsed) ? parsed : [], error: null }
  } catch (error) {
    return { ok: false, rows: [], error: `Réponse sqlite3 invalide: ${error.message}` }
  }
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`
}

async function readStateDatabase(databasePath) {
  if (!fs.existsSync(databasePath)) {
    return { available: false, exists: false, tables: [], records: {}, missions: [], error: null }
  }

  const tableProbe = await sqliteJson(
    databasePath,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
  )
  if (!tableProbe.ok) {
    return { available: false, exists: true, tables: [], records: {}, missions: [], error: tableProbe.error }
  }

  const tables = tableProbe.rows.map((row) => row.name).filter((name) => safeIdentifier(name))
  const records = {}

  for (const table of tables.filter((name) => OBSERVABLE_TABLE.test(name)).slice(0, 12)) {
    const columnsProbe = await sqliteJson(databasePath, `PRAGMA table_info(${quoteIdentifier(table)});`)
    if (!columnsProbe.ok) continue
    const columns = columnsProbe.rows
      .map((row) => row.name)
      .filter((name) => safeIdentifier(name) && SAFE_COLUMN.test(name))
    if (!columns.length) continue

    const orderColumn = ['updated_at', 'completed_at', 'finished_at', 'started_at', 'created_at', 'timestamp', 'ts', 'id']
      .find((candidate) => columns.includes(candidate))
    const order = orderColumn ? ` ORDER BY ${quoteIdentifier(orderColumn)} DESC` : ''
    const query = `SELECT ${columns.map(quoteIdentifier).join(', ')} FROM ${quoteIdentifier(table)}${order} LIMIT 100;`
    const rowsProbe = await sqliteJson(databasePath, query)
    if (rowsProbe.ok) records[table] = rowsProbe.rows
  }

  const missions = extractHermesMissions(records)
  return {
    available: true,
    exists: true,
    modified_at: new Date(fs.statSync(databasePath).mtimeMs).toISOString(),
    tables,
    records,
    missions,
    error: null,
  }
}

function firstValue(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') return row[name]
  }
  return null
}

function normalizeMissionStatus(value) {
  const status = String(value || '').toLowerCase()
  if (/running|active|in[_ -]?progress|processing|started/.test(status)) return 'running'
  if (/success|complete|completed|done|closed|finished/.test(status)) return 'closed'
  if (/fail|error|cancel|abort|timeout/.test(status)) return 'incomplete'
  if (/pending|queued|waiting/.test(status)) return 'running'
  return 'unknown'
}

export function extractHermesMissions(records = {}) {
  const missions = []
  for (const [table, rows] of Object.entries(records)) {
    if (!MISSION_TABLE.test(table) || !Array.isArray(rows)) continue
    for (const row of rows) {
      const rawId = firstValue(row, ['id', 'session_id'])
      const name = firstValue(row, ['title', 'name'])
      if (rawId == null || name == null) continue
      const status = normalizeMissionStatus(firstValue(row, ['status', 'state']))
      const startedAt = firstValue(row, ['started_at', 'created_at', 'timestamp', 'ts'])
      const finishedAt = firstValue(row, ['finished_at', 'completed_at'])
      const updatedAt = firstValue(row, ['updated_at', 'finished_at', 'completed_at', 'started_at', 'created_at', 'timestamp', 'ts'])
      const model = firstValue(row, ['model', 'provider'])
      const agent = firstValue(row, ['agent', 'agent_id'])
      const progress = Number(row.progress)
      const normalizedProgress = Number.isFinite(progress)
        ? Math.max(0, Math.min(100, progress <= 1 ? Math.round(progress * 100) : Math.round(progress)))
        : status === 'closed' ? 100 : status === 'running' ? 50 : 0

      missions.push({
        id: `hermes_${table}_${String(rawId)}`,
        external_id: String(rawId),
        source: 'hermes-state',
        source_table: table,
        name: String(name),
        domain: table,
        target: null,
        rules: null,
        status,
        phase: status === 'closed' ? 'closed' : 'executing',
        progress: normalizedProgress,
        started_at: startedAt || null,
        finished_at: finishedAt || null,
        duration_ms: null,
        closure: null,
        escalations: status === 'incomplete' ? 1 : 0,
        checks: { total: 0, passed: 0, violations: 0, findings: 0, items: [] },
        budget: null,
        agents: agent || model ? [{
          id: agent ? String(agent) : `model:${model}`,
          name: agent ? String(agent) : String(model),
          model: model ? String(model) : null,
          mandates: 1,
          cost: Number(row.cost || 0) || 0,
        }] : [],
        manager: agent || model ? {
          id: agent ? String(agent) : `model:${model}`,
          name: agent ? String(agent) : String(model),
          model: model ? String(model) : null,
        } : null,
        event_count: 1,
        latest_event: {
          type: `hermes.state.${status}`,
          ts: updatedAt || startedAt || null,
          hash: null,
          data: { source: 'hermes-state', table },
        },
      })
    }
  }

  return missions
    .sort((a, b) => Date.parse(b.latest_event?.ts || 0) - Date.parse(a.latest_event?.ts || 0))
    .slice(0, 200)
}

function publicDatabaseSnapshot(database) {
  return {
    available: database.available,
    exists: database.exists,
    modified_at: database.modified_at || null,
    tables: database.tables,
    record_counts: Object.fromEntries(
      Object.entries(database.records || {}).map(([table, rows]) => [table, rows.length])
    ),
    error: database.error,
  }
}

function collectIssues({ services, cli, tailscale, database }) {
  const issues = []
  for (const service of services) {
    if (!service.available) issues.push({ level: 'warning', source: service.name, message: service.error || 'Service introuvable' })
    else if (!service.active) issues.push({ level: 'error', source: service.name, message: `${service.active_state}/${service.sub_state}` })
    if (service.restarts > 0) issues.push({ level: 'warning', source: service.name, message: `${service.restarts} redémarrage(s)` })
  }
  if (!cli.available) issues.push({ level: 'warning', source: 'hermes-cli', message: cli.error || 'CLI indisponible' })
  if (!tailscale.available) issues.push({ level: 'warning', source: 'tailscale', message: tailscale.error || 'Tailscale indisponible' })
  if (!database.available) issues.push({ level: 'warning', source: 'state.db', message: database.error || 'Base Hermes indisponible' })
  return issues
}

export async function getHermesObservability({ force = false } = {}) {
  const now = Date.now()
  if (!force && cache && now - cache.at < CACHE_TTL_MS) return cache.value

  const services = envList('HERMES_SYSTEMD_SERVICES', DEFAULT_SERVICES)
  const stateDb = expandHome(process.env.HERMES_STATE_DB || '~/.hermes/state.db')
  const [serviceSnapshots, journals, cli, processes, tailscale, database] = await Promise.all([
    Promise.all(services.map(readService)),
    Promise.all(services.map(readJournal)),
    readHermesVersion(),
    readProcesses(),
    readTailscale(),
    readStateDatabase(stateDb),
  ])

  const journalEvents = journals
    .flatMap((journal) => journal.events)
    .sort((a, b) => Date.parse(a.ts || 0) - Date.parse(b.ts || 0))
  const online = serviceSnapshots.some((service) => service.active)
  const issues = collectIssues({ services: serviceSnapshots, cli, tailscale, database })

  const value = {
    generated_at: new Date().toISOString(),
    read_only: true,
    hermes: {
      online,
      url: process.env.HERMES_URL || null,
      cli,
    },
    services: serviceSnapshots,
    processes,
    tailscale,
    database: publicDatabaseSnapshot(database),
    events: journalEvents,
    missions: database.missions,
    issues,
    sources: [
      { id: 'systemd', available: serviceSnapshots.some((service) => service.available) },
      { id: 'journalctl', available: journals.some((journal) => journal.available) },
      { id: 'hermes-cli', available: cli.available },
      { id: 'state-db', available: database.available },
      { id: 'processes', available: processes.available },
      { id: 'tailscale', available: tailscale.available },
    ],
  }

  cache = { at: now, value }
  return value
}
