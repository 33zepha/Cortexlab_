/**
 * model-catalog.mjs v3 — pure catalog (no network/auth/CLI).
 */
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const DEFAULT_CATALOG = path.join(ROOT, 'contracts', 'models.yaml')

export const CANONICAL_EFFORTS = ['none', 'low', 'medium', 'high', 'xhigh', 'max']
export const EFFORT_RANK = Object.fromEntries(CANONICAL_EFFORTS.map((e, i) => [e, i]))

const SELECTABLE_ACCESS = new Set(['confirmed_success', 'confirmed_catalog'])

export function loadModelCatalog(catalogPath = DEFAULT_CATALOG) {
  if (!fs.existsSync(catalogPath)) throw new Error(`model catalog missing: ${catalogPath}`)
  return yaml.load(fs.readFileSync(catalogPath, 'utf8'))
}

export function catalogSnapshotHash(doc = loadModelCatalog()) {
  const stable = {
    schema_version: doc.schema_version,
    families: doc.families,
    variants: (doc.variants || []).map((v) => ({
      id: v.id,
      family_id: v.family_id,
      selectable: v.selectable,
      variant_access: v.variant_access,
      efforts: v.efforts,
      capabilities: v.capabilities,
      access_channels: v.access_channels,
    })),
    forbidden_families: doc.forbidden_families,
  }
  return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex').slice(0, 16)
}

export function validateModelCatalog(doc = loadModelCatalog()) {
  const errors = []
  if (doc.kind !== 'model_catalog') errors.push('kind must be model_catalog')
  const famIds = new Set((doc.families || []).map((f) => f.id))
  const forbidden = (doc.forbidden_families || []).map((s) => String(s).toLowerCase())
  if (![...famIds].includes('grok')) errors.push('grok family missing')

  const seen = new Set()
  for (const v of doc.variants || []) {
    if (!v.id) errors.push('variant missing id')
    if (seen.has(v.id)) errors.push(`duplicate variant ${v.id}`)
    seen.add(v.id)
    if (!famIds.has(v.family_id)) errors.push(`variant ${v.id} unknown family ${v.family_id}`)
    const fam = String(v.family_id || '').toLowerCase()
    if (forbidden.some((n) => fam === n || fam.includes(n))) errors.push(`forbidden family on ${v.id}`)

    const access = v.variant_access?.status
    if (v.selectable === true) {
      if (!SELECTABLE_ACCESS.has(access)) {
        errors.push(`selectable without sufficient variant_access: ${v.id} (${access})`)
      }
      if (/quota_exhausted/i.test(v.status || '')) errors.push(`selectable while quota_exhausted: ${v.id}`)
    }
    // ultra never canonical
    const canon = v.efforts?.canonical_supported || []
    if (canon.includes('ultra')) errors.push(`ultra must not be canonical on ${v.id}`)
  }
  return { ok: errors.length === 0, errors }
}

export function listVariants(doc = loadModelCatalog()) {
  return [...(doc.variants || [])]
}

export function listAvailableModels(doc = loadModelCatalog()) {
  return listVariants(doc).filter((v) => {
    if (v.selectable !== true) return false
    if (!SELECTABLE_ACCESS.has(v.variant_access?.status)) return false
    if (/quota_exhausted/i.test(v.status || '')) return false
    if (v.economics?.quota_remaining === 0) return false
    return true
  })
}

export function resolveVariant(idOrAlias, doc = loadModelCatalog()) {
  if (!idOrAlias) return null
  const all = listVariants(doc)
  const direct = all.find((v) => v.id === idOrAlias || v.upstream_id === idOrAlias)
  if (direct) return direct
  if (idOrAlias === 'luna' || idOrAlias === 'luna-max') return all.find((v) => v.id === 'gpt-5.6-luna') || null
  return null
}

export function getAccessChannels(variantOrId, doc = loadModelCatalog()) {
  const v = typeof variantOrId === 'string' ? resolveVariant(variantOrId, doc) : variantOrId
  return v?.access_channels || []
}

/**
 * Resolve a capability with tri-state + conditional snapshot.
 * NEVER use !!string.
 */
export function resolveCapability(variant, capability, accessCapabilitySnapshot = {}) {
  const caps = variant?.capabilities || {}
  const raw = caps[capability]
  if (raw == null) {
    return { available: false, status: 'unknown', reason: 'missing_capability_field' }
  }
  // legacy bool support
  if (raw === true || raw === false) {
    return { available: raw === true, status: raw === true ? 'true' : 'false', reason: 'legacy_bool' }
  }
  if (typeof raw === 'string') {
    // never treat non-empty string as true
    return { available: false, status: 'unknown', reason: `legacy_string_not_tri_state:${raw}` }
  }
  const status = raw.status
  if (status === true || status === 'true') {
    return { available: true, status: 'true', reason: 'true' }
  }
  if (status === false || status === 'false') {
    return { available: false, status: 'false', reason: 'false' }
  }
  if (status === 'unknown') {
    return { available: false, status: 'unknown', reason: 'unknown' }
  }
  if (status === 'conditional') {
    const cond = raw.condition || ''
    // condition like hermes_xai_oauth.web_search
    const [channel, cap] = String(cond).split('.')
    const snap = accessCapabilitySnapshot?.[channel] || accessCapabilitySnapshot?.[cond]
    let val
    if (snap && typeof snap === 'object' && cap) val = snap[cap]
    else if (typeof snap === 'boolean') val = snap
    else val = undefined
    if (val === true) return { available: true, status: 'conditional', reason: `snapshot_true:${cond}` }
    if (val === false) return { available: false, status: 'conditional', reason: `snapshot_false:${cond}` }
    return { available: false, status: 'conditional', reason: `snapshot_missing:${cond}` }
  }
  return { available: false, status: 'unknown', reason: `unhandled_status:${status}` }
}

export function supportsEffort(variantOrId, canonicalEffort, doc = loadModelCatalog()) {
  const v = typeof variantOrId === 'string' ? resolveVariant(variantOrId, doc) : variantOrId
  if (!v) return false
  if (!CANONICAL_EFFORTS.includes(canonicalEffort)) return false
  const supported = v.efforts?.canonical_supported || []
  return supported.includes(canonicalEffort)
}

/**
 * Normalize canonical effort → provider value.
 * Never silent upgrade. Respects declared mapping only.
 */
export function normalizeEffortForVariant(variantOrId, canonicalEffort, doc = loadModelCatalog(), { minimumEffort = null } = {}) {
  const v = typeof variantOrId === 'string' ? resolveVariant(variantOrId, doc) : variantOrId
  if (!v) {
    return { ok: false, provider_effort: null, canonical_effort: canonicalEffort, reason: 'unknown_variant' }
  }
  if (!CANONICAL_EFFORTS.includes(canonicalEffort)) {
    return { ok: false, provider_effort: null, canonical_effort: canonicalEffort, reason: 'non_canonical_effort' }
  }
  if (canonicalEffort === 'ultra') {
    return { ok: false, provider_effort: null, canonical_effort: canonicalEffort, reason: 'ultra_not_canonical' }
  }

  const efforts = v.efforts || {}
  const mapping = efforts.mapping || {}
  const canonSup = efforts.canonical_supported || []
  const semantics = efforts.semantics || 'reasoning_effort'

  let provider = mapping[canonicalEffort]
  if (provider === null || provider === undefined) {
    if (canonSup.includes(canonicalEffort)) provider = canonicalEffort
    else {
      return {
        ok: false,
        provider_effort: null,
        canonical_effort: canonicalEffort,
        reason: `unsupported_for_variant:${v.id}`,
        semantics,
        suggested_explicit_remap: null,
      }
    }
  }

  // minimum floor: cannot remap below minimum
  if (minimumEffort && EFFORT_RANK[canonicalEffort] < EFFORT_RANK[minimumEffort]) {
    return {
      ok: false,
      provider_effort: null,
      canonical_effort: canonicalEffort,
      reason: `below_minimum_effort:${minimumEffort}`,
      semantics,
    }
  }

  const providerSup = efforts.provider_supported || []
  if (providerSup.length && !providerSup.includes(provider) && !String(provider).startsWith('thinking_')) {
    return {
      ok: false,
      provider_effort: null,
      canonical_effort: canonicalEffort,
      reason: `provider_value_not_supported:${provider}`,
      semantics,
    }
  }

  return {
    ok: true,
    provider_effort: provider,
    canonical_effort: canonicalEffort,
    mapped: mapping[canonicalEffort] != null && mapping[canonicalEffort] !== canonicalEffort,
    reason: mapping[canonicalEffort] != null && mapping[canonicalEffort] !== canonicalEffort ? 'explicit_mapping' : 'direct',
    semantics,
  }
}

export function getFallbackVariants(variantOrId, doc = loadModelCatalog()) {
  const v = typeof variantOrId === 'string' ? resolveVariant(variantOrId, doc) : variantOrId
  if (!v) return []
  const avail = listAvailableModels(doc).filter((x) => x.id !== v.id)
  return [...avail.filter((x) => x.family_id === v.family_id), ...avail.filter((x) => x.family_id !== v.family_id)]
}

export function assertEffortDefaultSafe(effortCatalog) {
  const def = effortCatalog.default_effort
  const levels = (effortCatalog.canonical_levels || effortCatalog.levels?.map((l) => l.id) || CANONICAL_EFFORTS)
  if (!levels.includes(def)) return 'default_not_in_canonical_levels'
  const forbid = effortCatalog.forbid_default || []
  if (forbid.includes(def)) return 'default_is_forbidden'
  if (def === 'max' || def === 'xhigh' || def === 'ultra') return 'default_too_high'
  return null
}
