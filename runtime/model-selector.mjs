/**
 * model-selector.mjs — sélection pure modèle + effort pour un agent_role.
 * Aucun réseau / auth / CLI. Lit le catalogue.
 */
import {
  loadModelCatalog,
  listAvailableModels,
  resolveVariant,
  supportsEffort,
  normalizeEffortForVariant,
  EFFORT_RANK,
} from './model-catalog.mjs'

const HY3_ID = 'tencent/hy3:free'
const LUNA_ID = 'gpt-5.6-luna'
const SOL_ID = 'gpt-5.6-sol'
const TERRA_ID = 'gpt-5.6-terra'

function hasPrior(v, token) {
  return (v.empirical?.strengths_prior || []).includes(token)
}

function isQuotaOk(v, quotaSnapshot = {}) {
  if (/quota_exhausted/i.test(v.status || '')) return false
  const q = quotaSnapshot[v.family_id] || quotaSnapshot[v.id]
  if (q && q.remaining === 0) return false
  if (v.economics?.quota_remaining === 0) return false
  return true
}

function reject(list, v, reason) {
  list.push({ family_id: v.family_id, variant_id: v.id, reason })
}

/**
 * @param {object} input
 * @returns {object} selection result
 */
export function selectModel(input = {}, doc = loadModelCatalog()) {
  const {
    agent_role_id = null,
    task = 'general',
    risk = 'low',
    context_required = 0,
    tools_required = [],
    modalities = [],
    preferred_effort = 'medium',
    quota_snapshot = {},
    latency_preference = 'normal',
    budget_policy = 'balanced',
  } = input

  const rejected = []
  let available = listAvailableModels(doc).filter((v) => {
    if (!isQuotaOk(v, quota_snapshot)) {
      reject(rejected, v, 'quota_exhausted_or_empty')
      return false
    }
    return true
  })

  // capability filters
  if (tools_required.includes('shell')) {
    available = available.filter((v) => {
      const ok = !!(v.capabilities?.shell)
      if (!ok) reject(rejected, v, 'missing_shell')
      return ok
    })
  }
  if (tools_required.includes('web_search')) {
    available = available.filter((v) => {
      const ok = !!v.capabilities?.web_search
      if (!ok) reject(rejected, v, 'missing_web_search')
      return ok
    })
  }
  if (tools_required.includes('x_search')) {
    available = available.filter((v) => {
      const ok = !!v.capabilities?.x_search
      if (!ok) reject(rejected, v, 'missing_x_search')
      return ok
    })
  }
  if (context_required > 0) {
    available = available.filter((v) => {
      const ctx = v.context?.effective_safe || v.context?.advertised || 0
      const ok = ctx >= context_required
      if (!ok) reject(rejected, v, 'context_too_small')
      return ok
    })
  }
  for (const m of modalities) {
    available = available.filter((v) => (v.capabilities?.modalities || []).includes(m) || m === 'text')
  }

  // critical: exclude HY3 by default
  const critical = risk === 'critical' || risk === 'high' || task === 'architecture' || task === 'security' || task === 'migration'
  if (critical) {
    available = available.filter((v) => {
      if (v.family_id === 'hy3') {
        reject(rejected, v, 'hy3_excluded_for_risk_or_task')
        return false
      }
      return true
    })
  }

  // task priors — ordered candidate ids (first match among available wins preference boost)
  const order = candidateOrder({ task, risk, context_required, latency_preference, budget_policy, tools_required })

  // score
  const scored = available.map((v) => {
    let score = 0
    const idx = order.indexOf(v.id)
    if (idx >= 0) score += 100 - idx * 5
    if (budget_policy === 'economical' && (v.family_id === 'hy3' || v.id === LUNA_ID || v.id === 'gpt-5.4-mini' || v.id === 'kimi-for-coding-highspeed')) score += 15
    if (budget_policy === 'quality' && (v.id === SOL_ID || v.id === 'claude-opus-4-8' || v.id === 'grok-4.5')) score += 15
    if (latency_preference === 'fast' && (v.latency_class === 'highspeed' || v.id === 'gpt-5.4-mini' || v.id === 'kimi-for-coding-highspeed' || v.family_id === 'hy3')) score += 10
    if (hasPrior(v, task)) score += 8
    if (v.family_id === 'hy3' && risk === 'low' && isLightTask(task)) score += 40
    if (task === 'long_read' && (v.family_id === 'kimi' || v.id === LUNA_ID || v.id === TERRA_ID)) score += 20
    if (task === 'code' && (v.family_id === 'codex' || v.id === 'grok-build-0.1' || v.id === 'grok-4.5')) score += 18
    if ((task === 'architecture' || task === 'refactor') && (v.id === SOL_ID || v.id === TERRA_ID || v.id === 'claude-opus-4-8')) score += 22
    if (task === 'research_web' && v.family_id === 'grok') score += 25
    if (task === 'research_web' && v.family_id === 'kimi') score += 12
    // prefer selectable discovered
    if (v.availability?.discovered) score += 2
    return { v, score }
  })

  scored.sort((a, b) => b.score - a.score || a.v.id.localeCompare(b.v.id))

  if (!scored.length) {
    return {
      family_id: null,
      variant_id: null,
      access_channel: null,
      canonical_effort: preferred_effort,
      provider_effort: null,
      selection_reason: 'no_available_variant',
      rejected_alternatives: rejected,
      estimated_tradeoffs: {},
      fallback_chain: [],
      confidence: 0,
      agent_role_id,
    }
  }

  // pick first whose preferred effort is supportable OR has explicit fallback suggestion
  let chosen = null
  let effortNorm = null
  let effortUsed = preferred_effort
  if (critical && EFFORT_RANK[preferred_effort] < EFFORT_RANK.high) {
    effortUsed = 'high'
  }

  for (const { v } of scored) {
    let norm = normalizeEffortForVariant(v, effortUsed, doc)
    if (!norm.ok) {
      // try default of variant if preferred unsupported — EXPLICIT reason only
      if (norm.suggested_explicit_remap) {
        const remap = normalizeEffortForVariant(v, norm.suggested_explicit_remap, doc)
        if (remap.ok) {
          // only accept remap if not silent upgrade from hy3 low to max etc. without intermediate —
          // for selector: accept default remap with reason recorded
          chosen = v
          effortNorm = { ...remap, reason: `preferred_${effortUsed}_unsupported_explicit_default_${norm.suggested_explicit_remap}` }
          break
        }
      }
      reject(rejected, v, `effort_unsupported:${effortUsed}`)
      continue
    }
    chosen = v
    effortNorm = norm
    break
  }

  if (!chosen) {
    // last resort: first scored with any supported effort
    chosen = scored[0].v
    const any = (chosen.efforts?.supported || [])[0]
    effortNorm = normalizeEffortForVariant(chosen, any, doc)
    effortUsed = any
  }

  const fallback_chain = scored
    .filter((s) => s.v.id !== chosen.id)
    .slice(0, 5)
    .map((s) => ({ family_id: s.v.family_id, variant_id: s.v.id, score: s.score }))

  const access = (chosen.access_channels || [])[0] || null

  return {
    family_id: chosen.family_id,
    variant_id: chosen.id,
    access_channel: access,
    canonical_effort: effortNorm.canonical_effort || effortUsed,
    provider_effort: effortNorm.provider_effort,
    effort_mapping_reason: effortNorm.reason,
    effort_semantics: effortNorm.semantics || chosen.efforts?.semantics,
    selection_reason: buildReason({ chosen, task, risk, effortUsed, score: scored[0].score }),
    rejected_alternatives: rejected.slice(0, 30),
    estimated_tradeoffs: {
      marginal_cost: chosen.economics?.marginal_cost,
      latency_class: chosen.latency_class || chosen.empirical?.latency_class || null,
      context_safe: chosen.context?.effective_safe || null,
    },
    fallback_chain,
    confidence: Math.min(0.95, 0.4 + scored[0].score / 200),
    agent_role_id,
  }
}

function isLightTask(task) {
  return [
    'classification',
    'extraction',
    'short_summary',
    'reformulation',
    'simple_transform',
    'mandate_prep',
    'light_check',
    'few_files_read',
    'repetitive',
    'light',
  ].includes(task)
}

function candidateOrder({ task, risk, context_required, latency_preference, budget_policy, tools_required }) {
  if (tools_required.includes('x_search') || tools_required.includes('web_search') || task === 'research_web') {
    return ['grok-4.5', 'grok-4.3', 'grok-4.20-multi-agent', 'k3', 'k3-256k', 'claude-opus-4-8', TERRA_ID]
  }
  if (task === 'architecture' || task === 'refactor' || risk === 'critical') {
    return [SOL_ID, TERRA_ID, 'claude-opus-4-8', 'grok-4.5', 'k3', LUNA_ID]
  }
  if (task === 'long_read' || context_required >= 200000) {
    return ['k3', 'k3-256k', LUNA_ID, TERRA_ID, 'claude-opus-4-8', 'grok-4.3']
  }
  if (task === 'code' || task === 'implementation' || task === 'debug') {
    return [LUNA_ID, TERRA_ID, 'grok-build-0.1', 'grok-4.5', 'claude-opus-4-8', 'kimi-for-coding', HY3_ID]
  }
  if (isLightTask(task) || (risk === 'low' && budget_policy === 'economical')) {
    return [HY3_ID, 'kimi-for-coding-highspeed', LUNA_ID, 'gpt-5.4-mini', 'claude-haiku-4-5', 'kimi-for-coding']
  }
  return [LUNA_ID, TERRA_ID, 'claude-opus-4-8', 'k3', 'grok-4.5', HY3_ID]
}

function buildReason({ chosen, task, risk, effortUsed, score }) {
  return (
    `task=${task} risk=${risk} → ${chosen.family_id}/${chosen.id} ` +
    `effort=${effortUsed} (score≈${score}); priors+availability; no silent unsupported effort`
  )
}

export function selectModelsForAgents(agentRoleIds, sharedInput = {}, doc = loadModelCatalog()) {
  return agentRoleIds.map((agent_role_id) =>
    selectModel({ ...sharedInput, agent_role_id }, doc),
  )
}

// re-exports useful in tests
export { supportsEffort, normalizeEffortForVariant, resolveVariant }
