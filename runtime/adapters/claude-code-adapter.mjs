/**
 * claude-code-adapter.mjs — Claude Code CLI via spawn (no shell).
 * Inspected flags: -p/--print, --model, --effort, --output-format json,
 * --permission-mode, --bare. No --dangerously-skip-permissions under root by default.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { redactText } from '../evidence-collector.mjs'
import { ADAPTER_IDS } from './adapter-contract.mjs'

const SUPPORTED_MODELS = new Set([
  'claude-opus-4-8',
  'claude-sonnet-5',
  'claude-opus-5',
  'opus',
  'sonnet',
])
const SUPPORTED_EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max'])

export function resolveClaudeBin() {
  try {
    return execFileSync('which', ['claude'], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

export function preflight({ model, effort } = {}) {
  const bin = resolveClaudeBin()
  if (!bin) return { ok: false, reason: 'claude_binary_missing' }
  let version = null
  try {
    version = execFileSync(bin, ['--version'], { encoding: 'utf8' }).trim()
  } catch (e) {
    return { ok: false, reason: 'claude_version_failed', details: String(e.message || e) }
  }
  // auth presence (file exists only — no content read beyond existence)
  const cred = path.join(process.env.HOME || '/root', '.claude', '.credentials.json')
  const hasCred = fs.existsSync(cred)
  if (!hasCred) return { ok: false, reason: 'claude_credentials_missing', details: { version } }
  if (model && !SUPPORTED_MODELS.has(model)) {
    return { ok: false, reason: 'model_not_supported_by_adapter', details: { model, version } }
  }
  if (effort && !SUPPORTED_EFFORTS.has(effort)) {
    return { ok: false, reason: 'effort_not_supported', details: { effort, version } }
  }
  return {
    ok: true,
    details: {
      bin,
      version,
      auth: 'credentials_file_present',
      supported_models: [...SUPPORTED_MODELS],
      supported_efforts: [...SUPPORTED_EFFORTS],
      note: 'does_not_mutate_global_model_or_login',
    },
  }
}

export function buildArgv({ model, effort, prompt, permissionMode = 'acceptEdits' }) {
  // Array form only — never shell string
  const argv = [
    '-p',
    '--bare',
    '--output-format',
    'json',
    '--model',
    model,
    '--effort',
    effort,
    '--permission-mode',
    permissionMode,
    '--no-session-persistence',
    prompt,
  ]
  return argv
}

export function parseResult(stdout) {
  try {
    const j = JSON.parse(stdout)
    // Claude JSON print shape varies; try common fields
    const text = j.result || j.text || j.content || JSON.stringify(j).slice(0, 2000)
    let parsed = null
    const m = String(text).match(/\{[\s\S]*"status"[\s\S]*\}/)
    if (m) {
      try {
        parsed = JSON.parse(m[0])
      } catch {
        parsed = null
      }
    }
    return { text: String(text), parsed, raw_type: typeof j }
  } catch {
    return { text: stdout, parsed: null, raw_type: 'text' }
  }
}

/**
 * executeSession — bounded spawn
 */
export function executeSession({
  cwd,
  model,
  effort,
  prompt,
  timeoutMs = 180000,
  maxOutputBytes = 500000,
  env = process.env,
  spawnFn = spawn,
}) {
  const pf = preflight({ model, effort })
  if (!pf.ok) {
    return {
      status: 'blocked',
      exit_code: null,
      stdout_redacted: '',
      stderr_redacted: pf.reason,
      duration_ms: 0,
      model_requested: model,
      model_applied: null,
      effort_requested: effort,
      effort_applied: null,
      argv: [],
      parsed: null,
      preflight: pf,
    }
  }
  const bin = pf.details.bin
  const argv = buildArgv({ model, effort, prompt })
  const started = Date.now()
  return new Promise((resolve) => {
    const child = spawnFn(bin, argv, {
      cwd,
      env: filterEnv(env),
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let killed = false
    const onChunk = (buf, which) => {
      const s = buf.toString('utf8')
      if (which === 'out') {
        stdout += s
        if (stdout.length > maxOutputBytes) {
          stdout = stdout.slice(0, maxOutputBytes) + '\n[TRUNCATED]'
          killed = true
          child.kill('SIGKILL')
        }
      } else {
        stderr += s
        if (stderr.length > maxOutputBytes) {
          stderr = stderr.slice(0, maxOutputBytes) + '\n[TRUNCATED]'
        }
      }
    }
    child.stdout.on('data', (b) => onChunk(b, 'out'))
    child.stderr.on('data', (b) => onChunk(b, 'err'))
    const timer = setTimeout(() => {
      killed = true
      child.kill('SIGKILL')
    }, timeoutMs)
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({
        status: 'failed',
        exit_code: null,
        stdout_redacted: redactText(stdout),
        stderr_redacted: redactText(String(err.message || err)),
        duration_ms: Date.now() - started,
        model_requested: model,
        model_applied: null,
        effort_requested: effort,
        effort_applied: null,
        argv: [bin, ...argv],
        parsed: null,
        preflight: pf,
      })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      const parsedWrap = parseResult(stdout)
      const status = killed
        ? code === null || code === 137 || code === 1
          ? stdout.includes('[TRUNCATED]')
            ? 'completed'
            : 'timeout'
          : 'timeout'
        : code === 0
          ? 'completed'
          : 'failed'
      resolve({
        status,
        exit_code: code,
        stdout_redacted: redactText(stdout),
        stderr_redacted: redactText(stderr),
        duration_ms: Date.now() - started,
        model_requested: model,
        model_applied: model,
        effort_requested: effort,
        effort_applied: effort,
        argv: [bin, ...argv],
        parsed: parsedWrap.parsed,
        preflight: pf,
      })
    })
  })
}

function filterEnv(env) {
  const allow = [
    'PATH',
    'HOME',
    'USER',
    'LANG',
    'LC_ALL',
    'TERM',
    'NODE_PATH',
    'TMPDIR',
    'TMP',
    'TEMP',
  ]
  const out = {}
  for (const k of allow) {
    if (env[k] != null) out[k] = env[k]
  }
  // Claude may need its config dir under HOME — no secrets copied
  return out
}

export const adapterId = ADAPTER_IDS.CLAUDE_CODE

export function supportsAssignment(assignment) {
  if (assignment?.model?.access_channel !== 'claude_code_subscription') return false
  if (!SUPPORTED_MODELS.has(assignment.model.variant)) return false
  const eff = assignment.effort?.provider || assignment.effort?.canonical
  if (eff && !SUPPORTED_EFFORTS.has(eff)) return false
  return true
}
