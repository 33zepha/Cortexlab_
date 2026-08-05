#!/usr/bin/env node
/**
 * scripts/plan-mission-v2.mjs — shadow CLI (no model execution).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { planMissionV2 } from '../runtime/mission-planner-v2.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function arg(name, def = null) {
  const i = process.argv.indexOf(name)
  if (i < 0) return def
  return process.argv[i + 1] ?? def
}
function flag(name) {
  return process.argv.includes(name)
}

function usage() {
  console.error(`Usage: node scripts/plan-mission-v2.mjs --mission MIS-... --goal "..." [options]
Options:
  --domains a,b
  --risk low|medium|high|critical
  --context-required N
  --tools a,b
  --modalities a,b
  --budget-policy balanced|economical|quality
  --latency normal|fast
  --needs-evaluation
  --needs-pedagogy
  --quota-snapshot <file>
  --capability-snapshot <file>
  --adapter-snapshot <file>   JSON { installed_access_channels: [...] }
  --max-assignments N
  --base-commit-sha SHA
  --preferred-effort none|low|medium|high|xhigh|max
  --out <file>   (refuses overwrite; plans/ or tmp only)
  --json
`)
}

if (flag('--help') || !arg('--mission') || !arg('--goal')) {
  usage()
  process.exit(flag('--help') ? 0 : 2)
}

const mission = {
  id: arg('--mission'),
  goal: arg('--goal'),
  domains: (arg('--domains', '') || '').split(',').map((s) => s.trim()).filter(Boolean),
  risk: arg('--risk', 'medium'),
  context_required: Number(arg('--context-required', '0')) || 0,
  tools_required: (arg('--tools', '') || '').split(',').map((s) => s.trim()).filter(Boolean),
  modalities: (arg('--modalities', '') || '').split(',').map((s) => s.trim()).filter(Boolean),
  budget_policy: arg('--budget-policy', 'balanced'),
  latency_preference: arg('--latency', 'normal'),
  needs_evaluation: flag('--needs-evaluation'),
  needs_pedagogy: flag('--needs-pedagogy'),
  preferred_effort: arg('--preferred-effort', null),
}

function loadJsonOpt(p) {
  if (!p) return {}
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

const plan = planMissionV2(mission, {
  quota_snapshot: loadJsonOpt(arg('--quota-snapshot')),
  access_capability_snapshot: loadJsonOpt(arg('--capability-snapshot')),
  adapter_snapshot: arg('--adapter-snapshot') ? loadJsonOpt(arg('--adapter-snapshot')) : null,
  max_assignments: arg('--max-assignments') ? Number(arg('--max-assignments')) : null,
  base_commit_sha: arg('--base-commit-sha', null),
})

const out = arg('--out')
if (out) {
  const abs = path.resolve(out)
  const plansDir = path.join(ROOT, 'plans')
  const tmp = '/tmp'
  if (!abs.startsWith(plansDir + path.sep) && !abs.startsWith(tmp + path.sep) && abs !== plansDir) {
    console.error('ERROR: --out must be under plans/ or /tmp')
    process.exit(3)
  }
  if (fs.existsSync(abs)) {
    console.error('ERROR: refuse overwrite', abs)
    process.exit(4)
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, JSON.stringify(plan, null, 2))
  console.error('wrote', abs)
}

if (flag('--json') || out) {
  if (!out) console.log(JSON.stringify(plan, null, 2))
} else {
  console.log(`status=${plan.status} managers=${plan.organization.manager_role_ids?.join(',') || '—'} agents=${plan.organization.agent_role_ids?.length || 0} hash=${plan.metadata.plan_hash}`)
}
