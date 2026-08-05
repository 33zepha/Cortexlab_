/**
 * contracts.mjs — charge et valide les catalogues rôle / modèle / effort / session.
 *
 * Étape 1 feat/role-model-separation : AUCUN branchement sur
 * router.mjs / chief-of-staff.mjs / ledger. Lecture + validation pure.
 *
 * Les catalogues vivent sous contracts/*.yaml (parallèles au registre AG-*).
 */
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
export const CONTRACTS_DIR = path.join(ROOT, 'contracts')

// Marques modeles dans un id de ROLE (pas la liste d'interdiction familles —
// celle-ci vit dans contracts/models.yaml::forbidden_families).
const MODEL_BRAND_RE = /(claude|codex|kimi|luna|hy3|gpt-|opus|sonnet|haiku)/i

export function readContractYaml(name, dir = CONTRACTS_DIR) {
  const p = path.join(dir, name)
  if (!fs.existsSync(p)) throw new Error(`contrat manquant: ${p}`)
  return yaml.load(fs.readFileSync(p, 'utf8'))
}

export function loadRoleCatalog(dir = CONTRACTS_DIR) {
  return readContractYaml('roles.yaml', dir)
}

export function loadModelCatalog(dir = CONTRACTS_DIR) {
  return readContractYaml('models.yaml', dir)
}

export function loadEffortCatalog(dir = CONTRACTS_DIR) {
  return readContractYaml('effort-profiles.yaml', dir)
}

export function loadSessionAssignmentSchema(dir = CONTRACTS_DIR) {
  return readContractYaml('session-assignment.schema.yaml', dir)
}

export function loadTransitionalBindings(dir = CONTRACTS_DIR) {
  return readContractYaml('transitional-bindings.yaml', dir)
}

/** Ids de rôles ne doivent pas être des marques modèles. */
export function assertRoleIdsAreOrganizational(roles) {
  const bad = []
  for (const r of roles || []) {
    if (MODEL_BRAND_RE.test(r.id) || MODEL_BRAND_RE.test(r.name || '')) {
      // "Mnemosyne" et noms humains OK ; on bloque marques modèles dans id
      if (MODEL_BRAND_RE.test(r.id)) bad.push(r.id)
    }
  }
  return bad
}

/** Aucune famille listée dans forbidden_families n'est active. */
export function assertNoForbiddenFamilies(modelCatalog) {
  const forbidden = (modelCatalog.forbidden_families || []).map((s) =>
    String(s).toLowerCase(),
  )
  const hits = []
  for (const f of modelCatalog.families || []) {
    const id = String(f.id || '').toLowerCase()
    if (forbidden.some((needle) => id === needle || id.includes(needle))) {
      hits.push(f.id)
    }
  }
  return hits
}

/** max ne doit pas être le défaut. */
export function assertEffortDefaultSafe(effortCatalog) {
  const def = effortCatalog.default_effort
  const forbid = effortCatalog.forbid_default || []
  if (def === 'max') return 'default_effort must not be max'
  if (forbid.includes(def) === false && def === 'max') return 'default forbidden'
  if (forbid.includes('max') && def === 'max') return 'default_effort is max'
  if (def !== 'medium') {
    // soft: on accepte medium only as documented default for now
  }
  return null
}

/**
 * Valide un SessionAssignment contre le schéma + catalogues.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateSessionAssignment(assignment, catalogs) {
  const errors = []
  const schema = catalogs.sessionSchema
  const roles = catalogs.roles
  const models = catalogs.models
  const efforts = catalogs.efforts

  if (!assignment || typeof assignment !== 'object') {
    return { ok: false, errors: ['assignment missing'] }
  }

  for (const key of schema.required || []) {
    if (assignment[key] == null || assignment[key] === '') {
      errors.push(`missing required: ${key}`)
    }
  }

  const roleIds = new Set((roles.roles || []).map((r) => r.id))
  const managerIds = new Set(
    (roles.roles || []).filter((r) => r.kind === 'manager').map((r) => r.id),
  )
  const agentIds = new Set(
    (roles.roles || []).filter((r) => r.kind === 'specialized_agent').map((r) => r.id),
  )

  if (assignment.manager_id && !managerIds.has(assignment.manager_id)) {
    errors.push(`unknown manager_id: ${assignment.manager_id}`)
  }
  if (assignment.agent_role_id && !agentIds.has(assignment.agent_role_id)) {
    errors.push(`unknown agent_role_id: ${assignment.agent_role_id}`)
  }
  if (assignment.agent_role_id && String(assignment.agent_role_id).startsWith('AG-')) {
    errors.push('agent_role_id must not use legacy AG- prefix')
  }
  if (assignment.manager_id && MODEL_BRAND_RE.test(assignment.manager_id)) {
    errors.push(`manager_id looks like model brand: ${assignment.manager_id}`)
  }

  const effortIds = new Set((efforts.levels || []).map((l) => l.id))
  const effort = assignment.effort || assignment.effort_requested
  if (effort && !effortIds.has(effort)) {
    errors.push(`unknown effort: ${effort}`)
  }

  const model = assignment.model
  if (model) {
    const family = (models.families || []).find((f) => f.id === model.family)
    if (!family) errors.push(`unknown model.family: ${model.family}`)
    else {
      const variant = (family.variants || []).find((v) => v.id === model.variant)
      if (!variant) errors.push(`unknown model.variant: ${model.variant}`)
    }
    const fam = String(model.family || '').toLowerCase()
    const forbidden = (models.forbidden_families || []).map((s) => String(s).toLowerCase())
    if (forbidden.some((needle) => fam === needle || fam.includes(needle))) {
      errors.push(`forbidden model family: ${model.family}`)
    }
  }

  // reports_to coherence: agent must report to manager
  if (assignment.manager_id && assignment.agent_role_id) {
    const agent = (roles.roles || []).find((r) => r.id === assignment.agent_role_id)
    if (agent && agent.reports_to !== assignment.manager_id) {
      errors.push(
        `agent ${assignment.agent_role_id} reports_to ${agent.reports_to}, not ${assignment.manager_id}`,
      )
    }
  }

  return { ok: errors.length === 0, errors }
}

/** Charge tous les catalogues d'un coup. */
export function loadAllContracts(dir = CONTRACTS_DIR) {
  return {
    roles: loadRoleCatalog(dir),
    models: loadModelCatalog(dir),
    efforts: loadEffortCatalog(dir),
    sessionSchema: loadSessionAssignmentSchema(dir),
    transitional: loadTransitionalBindings(dir),
  }
}
