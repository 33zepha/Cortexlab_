import crypto from 'node:crypto'

const RISK_LEVELS = new Set(['low', 'medium', 'high', 'critical'])

function asArray(value) {
  if (value == null) return []
  return Array.isArray(value) ? value.filter(Boolean) : [value]
}

function finiteNumber(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback
}

/**
 * Compile les entrées libres d'une mission en contrat normalisé et immuable.
 * Le contrat devient la frontière explicite entre intention, permissions,
 * budget, risques et preuves attendues.
 */
export function createTaskContract(bundle, options = {}) {
  if (!bundle?.manifest?.mission) throw new Error('Task contract invalide: mission manquante')
  if (!Array.isArray(bundle.rules)) throw new Error('Task contract invalide: rules manquantes')

  const budget = {
    maxExplorations: finiteNumber(options.budget?.maxExplorations, 3),
    maxReworks: finiteNumber(options.budget?.maxReworks, 1),
    maxCost: finiteNumber(options.budget?.maxCost, 1),
  }
  if (Object.values(budget).some((value) => value < 0)) {
    throw new Error('Task contract invalide: budget négatif')
  }

  const requestedRisk = options.risk || bundle.manifest.risk || 'medium'
  const risk = RISK_LEVELS.has(requestedRisk) ? requestedRisk : 'medium'
  const objective = options.objective || bundle.manifest.objective || bundle.manifest.mission
  const permissions = [...new Set(asArray(options.permissions || bundle.manifest.permissions))]
  const constraints = [...new Set(asArray(options.constraints || bundle.manifest.constraints))]
  const expectedEvidence = [...new Set(
    asArray(options.expectedEvidence || bundle.manifest.expected_evidence)
      .concat(bundle.rules.filter((rule) => rule.type === 'control').map((rule) => rule.id))
  )]

  const fingerprint = crypto
    .createHash('sha256')
    .update(JSON.stringify({ mission: bundle.manifest.mission, objective, budget, risk, permissions, constraints, expectedEvidence }))
    .digest('hex')
    .slice(0, 16)

  return Object.freeze({
    id: `task-${fingerprint}`,
    version: 1,
    mission: bundle.manifest.mission,
    domain: bundle.manifest.domain || null,
    objective,
    target: options.target || null,
    constraints: Object.freeze(constraints),
    permissions: Object.freeze(permissions),
    risk,
    budget: Object.freeze(budget),
    expected_evidence: Object.freeze(expectedEvidence),
    created_at: new Date().toISOString(),
  })
}

export function validateTaskContract(contract) {
  const errors = []
  if (!contract?.id) errors.push('id manquant')
  if (!contract?.mission) errors.push('mission manquante')
  if (!contract?.objective) errors.push('objectif manquant')
  if (!contract?.budget) errors.push('budget manquant')
  if (!RISK_LEVELS.has(contract?.risk)) errors.push('niveau de risque invalide')
  if (!Array.isArray(contract?.expected_evidence)) errors.push('preuves attendues invalides')
  return { valid: errors.length === 0, errors }
}
