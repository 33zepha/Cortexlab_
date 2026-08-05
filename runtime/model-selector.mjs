/**
 * model-selector.mjs v3 — requested/min/selected effort, hy3_eligible, no silent downgrade.
 */
import {
  loadModelCatalog,
  listAvailableModels,
  resolveVariant,
  normalizeEffortForVariant,
  resolveCapability,
  CANONICAL_EFFORTS,
  EFFORT_RANK,
} from './model-catalog.mjs'
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const ROLES_PATH = path.join(ROOT, 'contracts', 'roles.yaml')

const KNOWN_TOOLS = new Set([
  'tools', 'shell', 'filesystem', 'web_search', 'x_search', 'code_execution', 'browser', 'vision',
])
const KNOWN_RISKS = new Set(['low', 'medium', 'high', 'critical'])
const HY3_ID = 'tencent/hy3:free'
const LUNA_ID = 'gpt-5.6-luna'
const SOL_ID = 'gpt-5.6-sol'
const TERRA_ID = 'gpt-5.6-terra'

const LIGHT_PROFILES = new Set([
  'light', 'light_information_processing', 'source_verification', 'pedagogy', 'classification',
  'extraction', 'short_summary', 'simple_transform', 'mandate_prep', 'few_files_read',
])

export function loadRoleProfiles(rolesPath = ROLES_PATH) {
  const doc = yaml.load(fs.readFileSync(rolesPath, 'utf8'))
  const map = {}
  for (const r of doc.roles || []) map[r.id] = r
  return map
}

export function minimumEffortForRisk(risk, roleMin = null) {
  const byRisk = { low: 'none', medium: 'medium', high: 'high', critical: 'high' }
  const base = byRisk[risk] || 'medium'
  if (!roleMin) return base
  return EFFORT_RANK[roleMin] > EFFORT_RANK[base] ? roleMin : base
}

export function validateSelectInput(input = {}) {
  const errors = []
  const { preferred_effort = null, risk = 'low', context_required = 0, tools_required = [] } = input
  if (preferred_effort != null && !CANONICAL_EFFORTS.includes(preferred_effort)) {
    errors.push(`preferred_effort non_canonical: ${preferred_effort}`)
  }
  if (preferred_effort === 'ultra') errors.push('ultra_not_canonical')
  if (!KNOWN_RISKS.has(risk)) errors.push(`unknown_risk: ${risk}`)
  if (typeof context_required === 'number' && context_required < 0) errors.push('context_required_negative')
  for (const t of tools_required || []) {
    if (!KNOWN_TOOLS.has(t)) errors.push(`unknown_tool: ${t}`)
  }
  return { ok: errors.length === 0, errors }
}

function isQuotaOk(v, quotaSnapshot = {}) {
  if (/quota_exhausted/i.test(v.status || '')) return false
  if (v.economics?.quota_remaining === 0) return false
  const q = quotaSnapshot[v.family_id] || quotaSnapshot[v.id]
  if (q && (q.remaining === 0 || q.status === 'quota_exhausted')) return false
  return true
}

function capabilityOk(v, cap, snapshot, rejected) {
  const r = resolveCapability(v, cap, snapshot)
  if (!r.available) {
    rejected.push({ family_id: v.family_id, variant_id: v.id, reason: `missing_cap:${cap}:${r.reason}` })
    return false
  }
  return true
}

function hy3Allowed({ req, risk, task, tools_required, modalities, context_required, access_capability_snapshot }) {
  if (req.hy3_eligible === false) return false
  if (risk !== 'low') return false
  if (!LIGHT_PROFILES.has(task) && req.hy3_eligible !== true) return false
  if ((tools_required || []).some((t) => ['shell', 'web_search', 'x_search', 'code_execution', 'browser'].includes(t))) return false
  if ((modalities || []).includes('image') || (modalities || []).includes('vision')) return false
  if ((context_required || 0) > 200000) return false
  if (task === 'security' || task === 'architecture' || task === 'migration') return false
  return true
}

/** When adapter_snapshot is provided, only keep variants that share an installed channel. */
export function normalizeInstalledChannels(adapter_snapshot) {
  if (!adapter_snapshot || typeof adapter_snapshot !== 'object') return null
  const list = adapter_snapshot.installed_access_channels
  if (!Array.isArray(list) || list.length === 0) return null
  return new Set(list.map(String))
}

export function pickAccessChannel(variant, installedChannels) {
  const channels = variant?.access_channels || []
  if (!installedChannels) return channels[0] || null
  const hit = channels.find((c) => installedChannels.has(c))
  return hit || null
}

function channelOk(v, installedChannels, rejected) {
  if (!installedChannels) return true
  const ch = pickAccessChannel(v, installedChannels)
  if (!ch) {
    rejected.push({
      family_id: v.family_id,
      variant_id: v.id,
      reason: 'no_installed_access_channel',
      channels: v.access_channels || [],
    })
    return false
  }
  return true
}

function candidateOrder({ task, risk, context_required, budget_policy, tools_required, hy3Ok }) {
  if ((tools_required || []).includes('x_search') || (tools_required || []).includes('web_search') || task === 'research_web') {
    return ['grok-4.5', 'grok-4.3', 'grok-4.20-multi-agent', 'k3', 'claude-opus-4-8', TERRA_ID]
  }
  if (task === 'architecture' || task === 'security' || task === 'refactor' || risk === 'critical') {
    return [SOL_ID, TERRA_ID, 'claude-opus-5', 'claude-opus-4-8', 'grok-4.5', 'k3']
  }
  if (task === 'long_read' || context_required >= 200000) {
    return ['k3', 'k3-256k', LUNA_ID, TERRA_ID, 'claude-sonnet-5', 'grok-4.3']
  }
  if (task === 'implementation' || task === 'code' || task === 'debug') {
    return [LUNA_ID, TERRA_ID, 'grok-build-0.1', 'claude-sonnet-5', 'kimi-for-coding']
  }
  if (task === 'visual_review' || task === 'interface_design' || task === 'ux_analysis') {
    return ['claude-opus-4-8', 'claude-sonnet-5', LUNA_ID, 'grok-4.5']
  }
  if (LIGHT_PROFILES.has(task) || (risk === 'low' && budget_policy === 'economical')) {
    const base = hy3Ok ? [HY3_ID] : []
    return [...base, 'kimi-for-coding-highspeed', LUNA_ID, 'gpt-5.4-mini', 'kimi-for-coding']
  }
  return [LUNA_ID, TERRA_ID, 'claude-sonnet-5', 'k3', 'grok-4.5']
}

/**
 * Remap only UPWARD or equal relative to max(minimum, requested).
 * Never silent downgrade under requested.
 */
function effortCompatible(v, requestedEffort, minimumEffort, doc) {
  const floor = EFFORT_RANK[requestedEffort] >= EFFORT_RANK[minimumEffort] ? requestedEffort : minimumEffort
  // try exact requested first if >= minimum
  const tryOrder = []
  if (EFFORT_RANK[requestedEffort] >= EFFORT_RANK[minimumEffort]) tryOrder.push(requestedEffort)
  // upward only from max(min, requested)
  for (const e of CANONICAL_EFFORTS) {
    if (EFFORT_RANK[e] > EFFORT_RANK[floor] && !tryOrder.includes(e)) tryOrder.push(e)
  }

  for (const e of tryOrder) {
    const norm = normalizeEffortForVariant(v, e, doc, { minimumEffort })
    if (!norm.ok) continue
    const kind = e === requestedEffort ? 'direct' : 'upward_remap'
    // forbid downward relative to requested
    if (EFFORT_RANK[e] < EFFORT_RANK[requestedEffort] && e !== requestedEffort) continue
    return {
      ok: true,
      effort: e,
      norm,
      decision: {
        kind,
        approved_by: 'selector',
        reason: kind === 'direct' ? 'direct' : `upward_remap_${requestedEffort}_to_${e}`,
      },
    }
  }
  return { ok: false, reason: `no_upward_compatible_effort_from_${requestedEffort}_min_${minimumEffort}` }
}

export function selectModel(input = {}, doc = loadModelCatalog(), roleProfiles = null) {
  const vIn = validateSelectInput(input)
  if (!vIn.ok) {
    return {
      status: 'unassigned',
      requires_escalation: true,
      reason: 'invalid_input',
      errors: vIn.errors,
      rejected_alternatives: [],
      fallback_chain: [],
      confidence: 0,
      requested_effort: input.preferred_effort || null,
      minimum_effort: null,
      canonical_effort: null,
      provider_effort: null,
    }
  }

  const profiles = roleProfiles || loadRoleProfiles()
  const {
    agent_role_id = null,
    task: taskIn = null,
    risk = 'low',
    context_required = 0,
    tools_required = [],
    modalities = [],
    preferred_effort = null,
    quota_snapshot = {},
    latency_preference = 'normal',
    budget_policy = 'balanced',
    access_capability_snapshot = {},
    adapter_snapshot = null,
  } = input

  const installedChannels = normalizeInstalledChannels(adapter_snapshot)

  const role = agent_role_id ? profiles[agent_role_id] : null
  const req = role?.model_requirements || {}
  const task = taskIn || req.task_profile || 'general'
  const requiredCaps = [...new Set([...(req.required_capabilities || []), ...tools_required])]
  const preferredCaps = req.preferred_capabilities || []
  const roleDefault = req.default_effort || preferred_effort || 'medium'
  const roleMin = req.minimum_effort || null
  const minimumEffort = minimumEffortForRisk(risk, roleMin)
  const requestedEffort = preferred_effort || roleDefault
  // floor: cannot start below minimum
  const effectiveRequested =
    EFFORT_RANK[requestedEffort] < EFFORT_RANK[minimumEffort] ? minimumEffort : requestedEffort

  const critical = risk === 'critical' || risk === 'high' || task === 'architecture' || task === 'security' || task === 'migration'
  const hy3Ok = hy3Allowed({
    req, risk, task, tools_required: requiredCaps, modalities, context_required, access_capability_snapshot,
  })

  const rejected = []
  let available = listAvailableModels(doc).filter((v) => {
    if (!isQuotaOk(v, quota_snapshot)) {
      rejected.push({ family_id: v.family_id, variant_id: v.id, reason: 'quota_exhausted_or_empty' })
      return false
    }
    if (!channelOk(v, installedChannels, rejected)) return false
    if (v.family_id === 'hy3' && !hy3Ok) {
      rejected.push({ family_id: v.family_id, variant_id: v.id, reason: 'hy3_not_eligible' })
      return false
    }
    if (critical && v.family_id === 'hy3') {
      rejected.push({ family_id: v.family_id, variant_id: v.id, reason: 'hy3_excluded_for_risk_or_task' })
      return false
    }
    return true
  })

  for (const cap of requiredCaps) {
    available = available.filter((v) => capabilityOk(v, cap, access_capability_snapshot, rejected))
  }
  if ((modalities || []).includes('image') || (modalities || []).includes('vision')) {
    available = available.filter((v) => capabilityOk(v, 'vision', access_capability_snapshot, rejected))
  }
  if (context_required > 0) {
    available = available.filter((v) => {
      const ctx = v.context?.policy_cap ?? v.context?.advertised ?? 0
      const ok = ctx == null ? true : ctx >= context_required
      if (!ok) rejected.push({ family_id: v.family_id, variant_id: v.id, reason: 'context_too_small' })
      return ok
    })
  }

  const order = candidateOrder({
    task, risk, context_required, budget_policy, tools_required: requiredCaps, hy3Ok,
  })
  const scored = available
    .map((v) => {
      let score = 0
      const idx = order.indexOf(v.id)
      if (idx >= 0) score += 100 - idx * 5
      if (budget_policy === 'economical' && (v.family_id === 'hy3' || v.id === LUNA_ID || v.id === 'gpt-5.4-mini')) score += 15
      if (budget_policy === 'quality' && (v.id === SOL_ID || String(v.id).includes('opus') || v.id === 'grok-4.5')) score += 15
      if (latency_preference === 'fast' && (v.latency_class === 'highspeed' || v.id === 'gpt-5.4-mini' || v.family_id === 'hy3')) score += 10
      for (const p of preferredCaps) {
        if (resolveCapability(v, p, access_capability_snapshot).available) score += 5
      }
      if (v.family_id === 'hy3' && hy3Ok) score += 50
      if ((v.empirical?.strengths_prior || []).includes(task)) score += 8
      return { v, score }
    })
    .sort((a, b) => b.score - a.score || a.v.id.localeCompare(b.v.id))

  let chosenEntry = null
  let chosenEffort = null
  let chosenNorm = null
  let chosenDecision = null
  for (const entry of scored) {
    const ec = effortCompatible(entry.v, effectiveRequested, minimumEffort, doc)
    if (!ec.ok) {
      rejected.push({
        family_id: entry.v.family_id,
        variant_id: entry.v.id,
        reason: `effort_incompatible:${effectiveRequested}:${ec.reason || ''}`,
      })
      continue
    }
    chosenEntry = entry
    chosenEffort = ec.effort
    chosenNorm = ec.norm
    chosenDecision = ec.decision
    break
  }

  if (!chosenEntry) {
    return {
      status: 'unassigned',
      requires_escalation: true,
      reason: 'no_compatible_model',
      agent_role_id,
      task,
      risk,
      requested_effort: requestedEffort,
      minimum_effort: minimumEffort,
      canonical_effort: null,
      provider_effort: null,
      rejected_alternatives: rejected.slice(0, 40),
      fallback_chain: [],
      confidence: 0,
      family_id: null,
      variant_id: null,
      access_channel: null,
    }
  }

  const chosen = chosenEntry.v
  const chosenScore = chosenEntry.score
  const fallback_chain = []
  for (const entry of scored) {
    if (entry.v.id === chosen.id) continue
    const ec = effortCompatible(entry.v, effectiveRequested, minimumEffort, doc)
    if (!ec.ok) continue
    let ok = true
    for (const cap of requiredCaps) {
      if (!resolveCapability(entry.v, cap, access_capability_snapshot).available) ok = false
    }
    if (!ok) continue
    const ch = pickAccessChannel(entry.v, installedChannels)
    if (installedChannels && !ch) continue
    fallback_chain.push({
      family_id: entry.v.family_id,
      variant_id: entry.v.id,
      access_channel: ch || (entry.v.access_channels || [])[0] || null,
      canonical_effort: ec.effort,
      provider_effort: ec.norm.provider_effort,
      reason: 'compatible_alternative',
      score: entry.score,
    })
    if (fallback_chain.length >= 5) break
  }

  const chosenChannel = pickAccessChannel(chosen, installedChannels) || (chosen.access_channels || [])[0] || null

  return {
    status: 'assigned',
    requires_escalation: false,
    family_id: chosen.family_id,
    variant_id: chosen.id,
    access_channel: chosenChannel,
    requested_effort: requestedEffort,
    minimum_effort: minimumEffort,
    canonical_effort: chosenNorm.canonical_effort || chosenEffort,
    provider_effort: chosenNorm.provider_effort,
    effort_mapping_reason: chosenDecision?.reason || chosenNorm.reason,
    effort_semantics: chosenNorm.semantics || chosen.efforts?.semantics,
    effort_decision: chosenDecision,
    selection_reason: `task=${task} risk=${risk} role=${agent_role_id || '—'} → ${chosen.family_id}/${chosen.id}@${chosenChannel} requested=${requestedEffort} selected=${chosenEffort} score=${chosenScore}${installedChannels ? ' adapter_filtered' : ''}`,
    rejected_alternatives: rejected.slice(0, 40),
    estimated_tradeoffs: {
      marginal_cost: chosen.economics?.marginal_cost,
      latency_class: chosen.latency_class || null,
      context_policy_cap: chosen.context?.policy_cap ?? null,
      chosen_score: chosenScore,
      adapter_snapshot_applied: !!installedChannels,
    },
    fallback_chain,
    confidence: Math.min(0.95, 0.4 + chosenScore / 200),
    agent_role_id,
    task,
    role_profile: req,
    chosen_score: chosenScore,
  }
}

export { resolveCapability, normalizeEffortForVariant, resolveVariant }
