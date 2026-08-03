/**
 * Exécuteurs de contrôle (checks) du runtime Cortex.
 *
 * Chaque control du bundle porte un `check` (ex: grep). Ici on implémente
 * l'exécution réelle contre le workspace cible. Les checks sont les seuls
 * points où le runtime touche des fichiers — tout le reste est gouvernance.
 */
import fs from 'node:fs'
import path from 'node:path'
import { glob } from 'glob'

/**
 * Exécute un check unique contre targetDir.
 * @returns {{id:string|null, type:string, matched:boolean, findings:Array, error?:string}}
 */
export async function executeCheck(check, targetDir, ruleId = null) {
  if (!check || !check.type) {
    return { id: ruleId, type: 'none', matched: false, findings: [], error: 'no-check' }
  }
  switch (check.type) {
    case 'grep':
      return executeGrep(check, targetDir, ruleId)
    default:
      // Type non implémenté : on ne peut pas vérifier => à traiter comme
      // "non auto-vérifiable" par le Chief of Staff (revue humaine requise).
      return { id: ruleId, type: check.type, matched: false, findings: [], error: 'unsupported-check' }
  }
}

async function executeGrep(check, targetDir, ruleId) {
  const pattern = new RegExp(check.pattern, 'g')
  const targets = await glob(check.target, { cwd: targetDir, nodir: true, dot: false })
  const findings = []
  for (const rel of targets) {
    const abs = path.join(targetDir, rel)
    let content
    try {
      content = fs.readFileSync(abs, 'utf8')
    } catch {
      continue // fichier illisible (binaire, perm) -> ignoré
    }
    const lines = content.split('\n')
    lines.forEach((line, i) => {
      pattern.lastIndex = 0
      if (pattern.test(line)) {
        findings.push({ file: rel, line: i + 1, preview: line.trim().slice(0, 200) })
      }
    })
  }
  pattern.lastIndex = 0
  const matched = findings.length > 0
  return {
    id: ruleId,
    type: 'grep',
    matched, // pour on_match=block, matched=true => violation
    findings,
    on_match: check.on_match || 'block',
    message: check.message || null,
  }
}
