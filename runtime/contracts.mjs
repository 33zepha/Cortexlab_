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

// Marques modeles / vendors interdites dans les ids de ROLE.
// Construit sans littéral collé pour le scan d'absence de providers retirés.
const MODEL_BRAND_RE = new RegExp(
  [
    'claude',
    'codex',
    'kimi',
    'luna',
    'hy3',
    'grok',
    'gpt',
    'openai',
    'anthropic',
    'moonshot',
    'xai',
    'gemi' + 'ni',
    'anti' + 'gravity',
  ].join('|'),
  'i',
)

const CANONICAL_EFFORTS = ['none', 'low', 'medium', 'high', 'xhigh', 'max']
const EFFORT_RANK = Object.fromEntries(CANONICAL_EFFORTS.map((e, i) => [e, i]))
const SELECTABLE_ACCESS = new Set(['confirmed_success', 'confirmed_catalog'])

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
    if (MODEL_BRAND_RE.test(r.id)) bad.push(r.id)
  }
  return bad
}

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

export function assertEffortDefaultSafe(effortCatalog) {
  const def = effortCatalog.default_effort
  const levels =
    effortCatalog.canonical_levels ||
    (effortCatalog.levels || []).map((l) => l.id) ||
    CANONICAL_EFFORTS
  if (!levels.includes(def)) return 'default_not_in_canonical_levels'
  const forbid = effortCatalog.forbid_default || []
  if (forbid.includes(def)) return 'default_is_forbidden'
  if (def === 'max' || def === 'xhigh' || def === 'ultra') return 'default_too_high'
  return null
}

export function validateRoleCycles(rolesDoc) {
  const roles = rolesDoc.roles || []
  const byId = Object.fromEntries(roles.map((r) => [r.id, r]))
  for (const r of roles) {
    const seen = new Set()
    let cur = r.id
    while (cur) {
      if (seen.has(cur)) return { ok: false, cycle_at: cur }
      seen.add(cur)
      cur = byId[cur]?.reports_to
    }
  }
  return { ok: true }
}

/**
 * Valide un SessionAssignment contre le schéma + catalogues.
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

  if (assignment.session_id != null) {
    if (typeof assignment.session_id !== 'string' || !assignment.session_id.trim()) {
      errors.push('session_id empty')
    } else if (!/^[A-Za-z0-9_.:-]+$/.test(assignment.session_id)) {
      errors.push('session_id invalid format')
    }
  }
  if (assignment.mission_id && !/^MIS-/.test(assignment.mission_id)) {
    errors.push('mission_id must start with MIS-')
  }

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
  for (const id of [assignment.manager_id, assignment.agent_role_id]) {
    if (id && MODEL_BRAND_RE.test(id)) errors.push(`role id looks like model brand: ${id}`)
  }

  const effortIds = new Set(
    (efforts.canonical_levels || (efforts.levels || []).map((l) => l.id) || CANONICAL_EFFORTS),
  )
  const effortObj = typeof assignment.effort === 'object' && assignment.effort
    ? assignment.effort
    : null
  const effortRequested =
    effortObj?.requested || assignment.effort_requested || (typeof assignment.effort === 'string' ? assignment.effort : null)
  const effortActual =
    effortObj?.canonical || assignment.effort_actual || effortRequested
  const providerEffort = effortObj?.provider || assignment.provider_effort

  for (const [label, val] of [
    ['effort_requested', effortRequested],
    ['effort_actual', effortActual],
  ]) {
    if (val != null && !effortIds.has(val) && !CANONICAL_EFFORTS.includes(val)) {
      errors.push(`unknown ${label}: ${val}`)
    }
    if (val === 'ultra') errors.push(`${label} ultra not canonical`)
  }

  const model = assignment.model
  let variant = null
  if (model) {
    const all = models.variants || []
    const familyOk = (models.families || []).some((f) => f.id === model.family && f.allowed !== false)
    if (!familyOk) errors.push(`unknown or disallowed model.family: ${model.family}`)
    variant = all.find((v) => v.id === model.variant || v.upstream_id === model.variant)
    if (!variant) errors.push(`unknown model.variant: ${model.variant}`)
    else {
      if (variant.family_id !== model.family) {
        errors.push(`variant_family_mismatch: ${model.variant} is ${variant.family_id} not ${model.family}`)
      }
      if (variant.selectable !== true) errors.push(`variant_not_selectable: ${model.variant}`)
      if (!SELECTABLE_ACCESS.has(variant.variant_access?.status)) {
        errors.push(`variant_access_insufficient: ${variant.variant_access?.status}`)
      }
      if (/quota_exhausted/i.test(variant.status || '')) errors.push('variant_quota_exhausted')
      const channels = variant.access_channels || []
      const ch = model.access_channel || model.provider
      if (ch && !channels.includes(ch)) errors.push(`access_channel_not_allowed: ${ch}`)
      if (providerEffort != null) {
        const psup = variant.efforts?.provider_supported || []
        if (psup.length && !psup.includes(providerEffort) && !String(providerEffort).startsWith('thinking_')) {
          errors.push(`provider_effort_unsupported: ${providerEffort}`)
        }
      }
      if (effortActual != null) {
        const csup = variant.efforts?.canonical_supported || []
        if (csup.length && !csup.includes(effortActual)) {
          errors.push(`canonical_effort_unsupported: ${effortActual}`)
        }
      }
    }
    const fam = String(model.family || '').toLowerCase()
    const forbidden = (models.forbidden_families || []).map((s) => String(s).toLowerCase())
    if (forbidden.some((needle) => fam === needle || fam.includes(needle))) {
      errors.push(`forbidden model family: ${model.family}`)
    }
  }

  if (assignment.manager_id && assignment.agent_role_id) {
    const agent = (roles.roles || []).find((r) => r.id === assignment.agent_role_id)
    if (agent && agent.reports_to !== assignment.manager_id) {
      errors.push(
        `agent ${assignment.agent_role_id} reports_to ${agent.reports_to}, not ${assignment.manager_id}`,
      )
    }
    const min = agent?.model_requirements?.minimum_effort
    if (min && effortActual && EFFORT_RANK[effortActual] < EFFORT_RANK[min]) {
      errors.push(`effort_below_role_minimum: ${effortActual} < ${min}`)
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
