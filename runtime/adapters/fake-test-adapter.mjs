/**
 * fake-test-adapter.mjs — deterministic adapter for unit tests (no IA).
 */
import fs from 'node:fs'
import path from 'node:path'
import { ADAPTER_IDS } from './adapter-contract.mjs'

export const adapterId = ADAPTER_IDS.FAKE

export function preflight() {
  return { ok: true, details: { adapter: 'fake' } }
}

export function supportsAssignment() {
  return true
}

export async function executeSession({ cwd, model, effort, prompt, maxOutputBytes }) {
  const started = Date.now()
  // simulate truncation failure path if asked
  if (maxOutputBytes === 1) {
    return {
      status: 'failed',
      exit_code: 1,
      stdout_redacted: 'x[TRUNCATED]',
      stderr_redacted: '',
      duration_ms: Date.now() - started,
      model_requested: model,
      model_applied: null,
      effort_requested: effort,
      effort_applied: effort,
      argv: ['fake-adapter', '--model', String(model), '--effort', String(effort)],
      argv_audit: ['fake-adapter', '--model', String(model), '--effort', String(effort)],
      parsed: null,
      truncated: true,
      preflight: preflight(),
    }
  }
  const target = path.join(cwd, 'buggy.js')
  let changed = false
  if (fs.existsSync(target)) {
    let src = fs.readFileSync(target, 'utf8')
    if (src.includes('return a - b')) {
      src = src.replace('return a - b', 'return a + b')
      fs.writeFileSync(target, src)
      changed = true
    }
  }
  const parsed = {
    status: 'completed',
    summary: changed ? 'fixed subtraction bug' : 'no known bug pattern',
    changed_files: changed ? ['buggy.js'] : [],
    tests_requested: [],
    risks: [],
    missing_evidence: [],
  }
  return {
    status: 'completed',
    exit_code: 0,
    stdout_redacted: JSON.stringify(parsed),
    stderr_redacted: '',
    duration_ms: Date.now() - started,
    model_requested: model,
    model_applied: null, // fake never proves applied model
    effort_requested: effort,
    effort_applied: effort,
    argv: ['fake-adapter', '--model', String(model), '--effort', String(effort)],
    argv_audit: ['fake-adapter', '--model', String(model), '--effort', String(effort)],
    parsed,
    truncated: false,
    preflight: preflight(),
  }
}
