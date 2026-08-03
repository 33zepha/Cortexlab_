/**
 * Chief of Staff — runtime d'orchestration Cortex.
 *
 * Prend un bundle IMMUTABLE (la seule source de règles d'une mission) et
 * gouverne l'exécution :
 *   - applique les controls VERIFIABLES (checks) contre le workspace cible,
 *   - suit le BUDGET de mission (INV-010 : explorations/reworks/cout/arret),
 *   - décide la CLOSURE (INV-006) : LIVRAISON AUTONOME / AVEC INFORMATION /
 *     ESCALADE humaine si dépassement budget, violation de control, ou
 *     check non auto-vérifiable.
 *
 * Le CoS n'exécute AUCUN code métier directement (INV-001) : il délègue,
 * ici symbolisé par l'application des checks + la décision de gouvernance.
 *
 * Usage:
 *   node runtime/chief-of-staff.mjs --bundle bundles/<id>-<hash>.json \
 *       --target /chemin/vers/workspace [--max-reworks N] [--json]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { executeCheck } from './checks.mjs'

const ROOT = path.dirname(fileURLToPath(import.meta.url))

// --- décision de closure (INV-006) ---
const CLOSURE = {
  AUTONOMOUS: 'LIVRAISON_AUTONOME',
  INFO: 'AVEC_INFORMATION',
  ESCALATE: 'ESCALADE_HUMAINE',
}

/**
 * Charge un bundle depuis le disque.
 */
export function loadBundle(bundlePath) {
  const abs = path.isAbsolute(bundlePath) ? bundlePath : path.join(ROOT, '..', bundlePath)
  if (!fs.existsSync(abs)) throw new Error(`Bundle introuvable: ${bundlePath}`)
  const bundle = JSON.parse(fs.readFileSync(abs, 'utf8'))
  if (!bundle.manifest || !Array.isArray(bundle.rules)) {
    throw new Error('Bundle invalide: manifest/rules manquants')
  }
  return bundle
}

/**
 * Exécute la gouvernance de la mission.
 * @param {object} opts
 *   bundlePath: string
 *   target: string (workspace à vérifier)
 *   budget: {maxExplorations, maxReworks, maxCost} (INV-010)
 * @returns {object} rapport de mission (closure + détails)
 */
export async function runMission({ bundlePath, target, budget = {} }) {
  const bundle = loadBundle(bundlePath)
  const maxReworks = budget.maxReworks ?? 1
  const maxExplorations = budget.maxExplorations ?? 3
  const maxCost = budget.maxCost ?? 1.0

  const startAt = new Date().toISOString()
  const escalationReasons = []
  const budgetState = { explorations: 0, reworks: 0, cost: 0 }

  // 1) Appliquer chaque control vérifiable (INV-005 : preuves pilotées par risque)
  const controlsReport = []
  for (const rule of bundle.rules) {
    if (rule.type !== 'control') {
      // invariant / policy : gouvernance structurelle, pas de check exécutable
      // ici. Noté comme "non auto-vérifiable" -> revue humaine (INV-005).
      controlsReport.push({
        id: rule.id,
        type: rule.type,
        verifiable: false,
        note: 'control de gouvernance structurelle (revue humaine requise)',
      })
      continue
    }
    if (!rule.check) {
      controlsReport.push({
        id: rule.id,
        type: rule.type,
        verifiable: false,
        note: 'aucun check associé (revue humaine requise)',
      })
      continue
    }
    budgetState.explorations += 1
    const result = await executeCheck(rule.check, target, rule.id)
    const isViolation = result.matched && result.on_match === 'block'
    if (isViolation) {
      escalationReasons.push(
        `VIOLATION control ${rule.id} : ${result.message || 'check=block déclenché'} ` +
          `(${result.findings.length} occurrence(s))`
      )
    }
    controlsReport.push({
      id: rule.id,
      type: rule.type,
      verifiable: true,
      matched: result.matched,
      on_match: result.on_match,
      violation: isViolation,
      findings: result.findings,
      message: result.message,
    })
  }

  // 2) Budget (INV-010) — dépassement => escalade, jamais silence.
  const overBudget = []
  if (budgetState.explorations > maxExplorations) {
    overBudget.push(`explorations ${budgetState.explorations} > max ${maxExplorations}`)
  }
  if (budgetState.reworks > maxReworks) {
    overBudget.push(`reworks ${budgetState.reworks} > max ${maxReworks}`)
  }
  if (budgetState.cost > maxCost) {
    overBudget.push(`cout ${budgetState.cost} > max ${maxCost}`)
  }
  if (overBudget.length) escalationReasons.push(`BUDGET DEPASSE : ${overBudget.join(' ; ')}`)

  // 3) Décision de closure (INV-006)
  let closure, rationale
  if (escalationReasons.length) {
    closure = CLOSURE.ESCALATE
    rationale =
      "Violation de control et/ou dépassement de budget détecté(s). " +
      "L'humain est décisionnaire sur ce qui n'est pas calibré, réversible " +
      "et contrôlé (INV-006)."
  } else {
    // Aucune violation, budget respecté. Calibré + réversible + contrôlé.
    const needsInfo =
      controlsReport.some((c) => c.verifiable === false) // présence de règles non auto-vérifiables
    closure = needsInfo ? CLOSURE.INFO : CLOSURE.AUTONOMOUS
    rationale = needsInfo
      ? "Aucune violation, budget respecté. Certains controls ne sont pas " +
        "auto-vérifiables (gouvernance structurelle) : livraison AVEC INFORMATION à l'humain."
      : "Mission calibrée, réversible et contrôlée : aucune violation, budget " +
        "respecté, tous les controls sont auto-vérifiés. LIVRAISON AUTONOME."
  }

  return {
    mission: bundle.manifest.mission,
    domain: bundle.manifest.domain || null,
    bundle_hash: path.basename(bundlePath),
    started_at: startAt,
    finished_at: new Date().toISOString(),
    closure,
    rationale,
    budget: { ...budgetState, limits: { maxExplorations, maxReworks, maxCost } },
    controls: controlsReport,
    escalations: escalationReasons,
    ruled_count: bundle.rules.length,
  }
}

// --- CLI (uniquement si lancé directement, pas à l'import) ---
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  const args = process.argv.slice(2)
  const get = (k) => {
    const i = args.indexOf(k)
    return i >= 0 ? args[i + 1] : null
  }
  const bundlePath = get('--bundle')
  const target = get('--target')
  const asJson = args.includes('--json')

if (!bundlePath || !target) {
  console.error('Usage: node runtime/chief-of-staff.mjs --bundle <path> --target <dir> [--max-reworks N] [--json]')
  process.exit(2)
}

const budget = {}
const mr = get('--max-reworks')
if (mr != null) budget.maxReworks = Number(mr)
const me = get('--max-explorations')
if (me != null) budget.maxExplorations = Number(me)
const mc = get('--max-cost')
if (mc != null) budget.maxCost = Number(mc)

const report = await runMission({ bundlePath, target, budget })
if (asJson) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(`\n=== MISSION ${report.mission} (${report.domain || 'all'}) ===`)
  console.log(`Closure      : ${report.closure}`)
  console.log(`Rationale    : ${report.rationale}`)
  console.log(`Controls     : ${report.ruled_count} regle(s), ${report.controls.filter((c) => c.verifiable).length} verifiable(s)`)
  for (const c of report.controls) {
    const tag = c.verifiable ? (c.violation ? 'VIOLATION' : 'ok') : 'manuel'
    console.log(`  [${tag}] ${c.id}${c.findings?.length ? ` (${c.findings.length})` : ''}`)
  }
  if (report.escalations.length) {
    console.log('Escalade     :')
    for (const e of report.escalations) console.log(`   - ${e}`)
  }
  console.log(`Budget       : explorations=${report.budget.explorations}/${report.budget.limits.maxExplorations}`)
}

process.exit(report.closure === CLOSURE.ESCALATE ? 3 : 0)
}
