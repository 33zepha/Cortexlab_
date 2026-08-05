#!/usr/bin/env node
/**
 * scripts/run-session-v1.mjs
 * Requires CORTEX_SESSION_RUNNER_V1=1 and --execute
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runSessionV1 } from '../runtime/session-runner-v1.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function arg(n, d = null) {
  const i = process.argv.indexOf(n)
  return i >= 0 ? process.argv[i + 1] : d
}
function flag(n) {
  return process.argv.includes(n)
}

if (flag('--help')) {
  console.log(`Usage:
  CORTEX_SESSION_RUNNER_V1=1 node scripts/run-session-v1.mjs \\
    --plan <plan.json> --auth <auth.json> --session <session_id> --execute \\
    [--fixture <dir>] [--ledger <path>] [--fake] [--json]
`)
  process.exit(0)
}

const planPath = arg('--plan')
const authPath = arg('--auth')
const sessionId = arg('--session')
if (!planPath || !authPath || !sessionId) {
  console.error('missing --plan/--auth/--session')
  process.exit(2)
}

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'))
const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'))
const ledger =
  arg('--ledger') ||
  path.join(ROOT, 'ledger', 'e2e-session-runner-v1.ndjson')

const result = await runSessionV1({
  plan,
  auth,
  sessionId,
  env: process.env,
  argv: process.argv,
  forceFake: flag('--fake'),
  copyFixtureFrom: arg('--fixture'),
  ledgerPath: ledger,
  testCommand: flag('--fake') ? ['node', '--test', 'buggy.test.js'] : null,
})

if (flag('--json')) console.log(JSON.stringify(result, null, 2))
else {
  console.log(
    `status=${result.status} reason=${result.reason || '—'} workspace=${result.workspace || '—'}`,
  )
  if (result.closure_recommendation) {
    console.log('closure_recommendation=', result.closure_recommendation.recommendation)
  }
}
process.exit(result.status === 'succeeded' ? 0 : 1)
