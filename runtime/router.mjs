/**
 * router.mjs — délégation des mandats (INV-001 + INV-011).
 *
 * Le Chief of Staff n'exécute pas : il choisit un agent par règle et lui confie
 * un mandat. Le choix n'est jamais une habitude — il est piloté par l'aptitude
 * (strengths vs domaine de la règle) puis par le rapport qualité/coût, et il est
 * TOUJOURS justifié : la raison est écrite au ledger avec le mandat, donc auditable.
 *
 * Hermes (CEO) orchestre et décide la closure ; il ne prend pas de mandat
 * d'exécution. Seuls les managers actifs sont candidats.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const REGISTRY = path.join(ROOT, 'registry', 'registry.json')

/**
 * Coût d'un mandat = cost_index de l'agent × cette unité.
 * `cost_index` et `maxCost` (INV-010) sont des INDICES SANS UNITÉ, pas une
 * devise. L'unité rend le budget comparable d'une mission à l'autre.
 */
export const DELEGATION_UNIT = 0.1

export function loadAgents(registryPath = REGISTRY) {
  const reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
  return reg.entries.filter((e) => e.type === 'agent')
}

/**
 * Aptitude requise par une règle, déduite de son type et de son domaine.
 *
 * Les valeurs retournées sont des TOKENS comparés à `strengths` du registre —
 * elles doivent correspondre exactement, sinon l'agent ne matche rien et le
 * routage retombe sur le seul ratio qualité/coût.
 */
export function requiredStrengths(rule) {
  if (rule.type !== 'control') return ['conformite', 'raisonnement']
  switch (rule.domain) {
    // Ingénierie du dépôt : domaine d'autorité du Chief Engineer.
    case 'frontend':
    case 'backend':
    case 'engineering':
    case 'implementation':
    case 'testing':
    case 'debugging':
    case 'refactoring':
    case 'code_security':
      return ['code', 'tests', 'correction']
    // UI / UX produit : analyse et specification (Claude) — pas l'implementation.
    // L'implementation frontend reste sous l'ingenierie (Codex).
    case 'ui':
    case 'ux':
      return ['analyse-ux', 'critique-ux', 'specification-ui', 'revue-visuelle']
    // Prototypage / integration frontend executables = ingenierie (Codex).
    case 'prototypage':
    case 'frontend-integration':
      return ['code', 'tests', 'correction']
    case 'analyse':
    case 'critique':
    case 'conseil':
      return ['raisonnement', 'analyse', 'critique', 'conseil']
    case 'recherche':
    case 'data':
      return ['recherche', 'long-context']
    default:
      return ['raisonnement']
  }
}

const r2 = (n) => Math.round(n * 100) / 100

/**
 * Choisit l'agent d'une règle et explique pourquoi.
 * @returns {{agent, cost, rationale, alternatives}|null}
 */
export function selectAgent(rule, agents) {
  const needed = requiredStrengths(rule)
  const candidates = agents.filter((a) => a.tier === 'manager' && a.status === 'active')
  if (!candidates.length) return null

  const scored = candidates
    .map((a) => {
      const matched = (a.strengths || []).filter((s) => needed.includes(s))
      // INV-011 : meilleure qualité au coût le plus bas.
      const ratio = r2((a.quality_index || 0) / (a.cost_index || 1))
      return { agent: a, matched, ratio }
    })
    // aptitude d'abord, puis qualité/coût ; l'id départage pour rester déterministe.
    .sort(
      (x, y) =>
        y.matched.length - x.matched.length ||
        y.ratio - x.ratio ||
        x.agent.id.localeCompare(y.agent.id)
    )

  const win = scored[0]
  const next = scored[1]
  const why = win.matched.length
    ? `aptitude ${win.matched.map((s) => `« ${s} »`).join(', ')}`
    : 'aucune aptitude spécifique requise'
  const versus = next
    ? ` devant ${next.agent.name} (${next.ratio})`
    : ''

  return {
    agent: win.agent,
    cost: r2((win.agent.cost_index || 0) * DELEGATION_UNIT),
    rationale:
      `${why} → ${win.agent.name} : qualité ${win.agent.quality_index} / coût ` +
      `${win.agent.cost_index} = ${win.ratio}${versus}. Meilleure qualité au coût le plus bas (INV-011).`,
    alternatives: scored.slice(1).map((s) => ({ id: s.agent.id, name: s.agent.name, ratio: s.ratio })),
  }
}
