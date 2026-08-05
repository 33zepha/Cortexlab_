/**
 * model-catalog.mjs — catalogue modèles pur (pas de réseau, pas d'auth, pas de CLI).
 * Lit contracts/models.yaml (+ optionnellement proof discovery pour cross-check).
 */
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const DEFAULT_CATALOG = path.join(ROOT, 'contracts', 'models.yaml')

export function loadModelCatalog(catalogPath = DEFAULT_CATALOG) {
  if (!fs.existsSync(catalogPath)) throw new Error(`model catalog missing: ${catalogPath}`)
  const doc = yaml.load(fs.readFileSync(catalogPath, 'utf8'))
  return doc
}

export function validateModelCatalog(doc = loadModelCatalog()) {
  const errors = []
  if (doc.kind !== 'model_catalog') errors.push('kind must be model_catalog')
  const famIds = new Set((doc.families || []).map((f) => f.id))
  const forbidden = (doc.forbidden_families || []).map((s) => String(s).toLowerCase())

  for (const f of doc.families || []) {
    const id = String(f.id || '').toLowerCase()
    if (forbidden.some((n) => id === n || id.includes(n))) {
      errors.push(`forbidden family present: ${f.id}`)
    }
    if (f.allowed === false) continue
  }

  const seen = new Set()
  for (const v of doc.variants || []) {
    if (!v.id) errors.push('variant missing id')
    if (seen.has(v.id)) errors.push(`duplicate variant ${v.id}`)
    seen.add(v.id)
    if (!famIds.has(v.family_id)) errors.push(`variant ${v.id} unknown family ${v.family_id}`)
    const fam = String(v.family_id || '').toLowerCase()
    if (forbidden.some((n) => fam === n || fam.includes(n))) {
      errors.push(`variant on forbidden family: ${v.id}`)
    }
    if (v.selectable && v.availability?.account_access === false) {
      errors.push(`selectable but no account_access: ${v.id}`)
    }
    if (v.selectable && v.status && /quota_exhausted/i.test(v.status)) {
      errors.push(`selectable while quota_exhausted: ${v.id}`)
    }
    if (v.selectable && v.availability?.discovered === false && v.availability?.account_access !== true) {
      // soft: documented-only should not be selectable
      if (v.availability?.account_access !== true) {
        errors.push(`selectable without discovery/account: ${v.id}`)
      }
    }
  }

  // Grok must be allowed family
  if (![...famIds].includes('grok')) errors.push('grok family missing')

  return { ok: errors.length === 0, errors }
}

export function listVariants(doc = loadModelCatalog()) {
  return [...(doc.variants || [])]
}

export function listAvailableModels(doc = loadModelCatalog(), { includeHidden = false } = {}) {
  return listVariants(doc).filter((v) => {
    if (v.selectable !== true) return false
    if (v.availability?.account_access === false) return false
    if (/quota_exhausted/i.test(v.status || '')) return false
    if (!includeHidden && /hidden|deprecated|legacy/i.test(v.status || '') && v.selectable !== true) return false
    return true
  })
}

export function resolveVariant(idOrAlias, doc = loadModelCatalog()) {
  if (!idOrAlias) return null
  const all = listVariants(doc)
  const direct = all.find((v) => v.id === idOrAlias || v.upstream_id === idOrAlias)
  if (direct) return direct
  // aliases
  if (idOrAlias === 'luna' || idOrAlias === 'luna-max') {
    return all.find((v) => v.id === 'gpt-5.6-luna') || null
  }
  return null
}

export function getAccessChannels(variantOrId, doc = loadModelCatalog()) {
  const v = typeof variantOrId === 'string' ? resolveVariant(variantOrId, doc) : variantOrId
  if (!v) return []
  return v.access_channels || []
}

export function supportsEffort(variantOrId, canonicalEffort, doc = loadModelCatalog()) {
  const v = typeof variantOrId === 'string' ? resolveVariant(variantOrId, doc) : variantOrId
  if (!v) return false
  const supported = v.efforts?.supported || []
  return supported.includes(canonicalEffort)
}

/**
 * Normalize canonical effort → provider value for a variant.
 * Never silently maps unsupported → stronger effort.
 * @returns {{ ok, provider_effort, canonical_effort, mapped, reason, fallback_effort }}
 */
export function normalizeEffortForVariant(variantOrId, canonicalEffort, doc = loadModelCatalog()) {
  const v = typeof variantOrId === 'string' ? resolveVariant(variantOrId, doc) : variantOrId
  if (!v) {
    return { ok: false, provider_effort: null, canonical_effort: canonicalEffort, mapped: false, reason: 'unknown_variant', fallback_effort: null }
  }
  const supported = v.efforts?.supported || []
  const unsupported = v.efforts?.unsupported_canonical || []
  const semantics = v.efforts?.semantics || 'reasoning_effort'
  const def = v.efforts?.default || null

  if (supported.includes(canonicalEffort)) {
    // boolean thinking special case
    if (semantics === 'boolean_thinking') {
      const provider = canonicalEffort === 'none' ? 'thinking_off' : 'thinking_on'
      return {
        ok: true,
        provider_effort: provider,
        canonical_effort: canonicalEffort,
        mapped: true,
        reason: 'boolean_thinking',
        fallback_effort: null,
        semantics,
      }
    }
    return {
      ok: true,
      provider_effort: canonicalEffort,
      canonical_effort: canonicalEffort,
      mapped: false,
      reason: 'direct',
      fallback_effort: null,
      semantics,
    }
  }

  // unsupported — do NOT silently escalate
  return {
    ok: false,
    provider_effort: null,
    canonical_effort: canonicalEffort,
    mapped: false,
    reason: unsupported.includes(canonicalEffort)
      ? `unsupported_for_variant:${v.id}`
      : `not_in_supported:${v.id}`,
    fallback_effort: def && supported.includes(def) ? def : supported[0] || null,
    semantics,
    suggested_explicit_remap: def && supported.includes(def) ? def : null,
  }
}

export function listModelsForCapability(need = {}, doc = loadModelCatalog()) {
  const {
    tools = null,
    shell = null,
    web_search = null,
    x_search = null,
    min_context = null,
    family = null,
    modality = null,
  } = need

  return listAvailableModels(doc).filter((v) => {
    if (family && v.family_id !== family) return false
    const caps = v.capabilities || {}
    if (tools === true && !caps.tools) return false
    if (shell === true && !caps.shell) return false
    if (web_search === true && !caps.web_search) return false
    if (x_search === true && !caps.x_search) return false
    if (min_context != null) {
      const ctx = v.context?.effective_safe || v.context?.advertised || 0
      if (ctx < min_context) return false
    }
    if (modality && !(caps.modalities || []).includes(modality)) return false
    return true
  })
}

export function getFallbackVariants(variantOrId, doc = loadModelCatalog()) {
  const v = typeof variantOrId === 'string' ? resolveVariant(variantOrId, doc) : variantOrId
  if (!v) return []
  // same family first, then economical ladders
  const avail = listAvailableModels(doc).filter((x) => x.id !== v.id)
  const same = avail.filter((x) => x.family_id === v.family_id)
  const others = avail.filter((x) => x.family_id !== v.family_id)
  return [...same, ...others].slice(0, 8)
}

/** Effort rank helper */
export const EFFORT_RANK = { none: 0, low: 1, medium: 2, high: 3, xhigh: 4, max: 5, ultra: 6 }
