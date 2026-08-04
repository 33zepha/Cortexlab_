import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadBundle, runMission } from './chief-of-staff.mjs'
import { EventStore } from './event-store.mjs'
import { createTaskContract, validateTaskContract } from './task-contract.mjs'
import { compileContextPack } from './context-compiler.mjs'
import { evaluateMission } from './eval-harness.mjs'

/**
 * Point d'entrée canonique Cortex.
 * Compile le contrat et le contexte avant l'exécution du CoS, puis produit
 * une évaluation factuelle après closure. L'ancien runMission reste intact.
 */
export async function runGovernedMission(options) {
  const { bundlePath, target, eventStore = null } = options
  const bundle = loadBundle(bundlePath)
  const contract = createTaskContract(bundle, {
    target,
    budget: options.budget,
    objective: options.objective,
    constraints: options.constraints,
    permissions: options.permissions,
    risk: options.risk,
    expectedEvidence: options.expectedEvidence,
  })
  const validation = validateTaskContract(contract)
  if (!validation.valid) throw new Error(`Task contract invalide: ${validation.errors.join(', ')}`)

  const contextPack = compileContextPack({
    contract,
    bundle,
    artifacts: options.artifacts || [],
    summary: options.summary || null,
    tokenBudget: options.contextTokenBudget || 4000,
  })

  eventStore?.emit('task.contract.created', {
    task_id: contract.id,
    mission: contract.mission,
    objective: contract.objective,
    risk: contract.risk,
    budget: contract.budget,
  })
  eventStore?.emit('context.compiled', {
    task_id: contract.id,
    estimated_tokens: contextPack.meta.estimated_tokens,
    rule_count: contextPack.meta.rule_count,
    artifact_count: contextPack.meta.artifact_count,
  })

  const startedAt = Date.now()
  const report = await runMission({
    bundlePath,
    target,
    budget: contract.budget,
    eventStore,
  })
  const evaluation = evaluateMission({
    contract,
    report,
    durationMs: Date.now() - startedAt,
  })
  eventStore?.emit('mission.evaluated', {
    task_id: contract.id,
    score: evaluation.score,
    success: evaluation.success,
    metrics: evaluation.metrics,
  })

  return { contract, context: contextPack.meta, report, evaluation }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  const args = process.argv.slice(2)
  const get = (key) => {
    const index = args.indexOf(key)
    return index >= 0 ? args[index + 1] : null
  }
  const bundlePath = get('--bundle')
  const target = get('--target')
  if (!bundlePath || !target) {
    console.error('Usage: node runtime/mission-runtime.mjs --bundle <path> --target <dir> [--json]')
    process.exit(2)
  }

  const budget = {}
  if (get('--max-reworks') != null) budget.maxReworks = Number(get('--max-reworks'))
  if (get('--max-explorations') != null) budget.maxExplorations = Number(get('--max-explorations'))
  if (get('--max-cost') != null) budget.maxCost = Number(get('--max-cost'))

  const eventsPath = get('--events') || path.join(path.dirname(bundlePath), 'events.ndjson')
  fs.mkdirSync(path.dirname(eventsPath), { recursive: true })
  const eventStore = new EventStore(eventsPath)
  try {
    const result = await runGovernedMission({ bundlePath, target, budget, eventStore })
    if (args.includes('--json')) console.log(JSON.stringify(result, null, 2))
    else {
      console.log(`\n=== CORTEX TASK ${result.contract.id} ===`)
      console.log(`Mission      : ${result.contract.mission}`)
      console.log(`Closure      : ${result.report.closure}`)
      console.log(`Evaluation   : ${result.evaluation.score}/100`)
      console.log(`Context      : ~${result.context.estimated_tokens} tokens`)
    }
    process.exitCode = result.report.closure === 'ESCALADE_HUMAINE' ? 3 : 0
  } finally {
    eventStore.close()
  }
}
