/**
 * legacy-compat.mjs — read-only transitional AG-* ↔ V2 mapping.
 */
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const BINDINGS = path.join(ROOT, 'contracts', 'transitional-bindings.yaml')

export function loadTransitionalBindings(p = BINDINGS) {
  return yaml.load(fs.readFileSync(p, 'utf8'))
}

export function validateTransitionalBindings(doc = loadTransitionalBindings()) {
  const errors = []
  if (doc.kind !== 'transitional_bindings') errors.push('kind')
  const seen = new Set()
  for (const b of doc.bindings || []) {
    if (!b.legacy_agent_id) errors.push('missing legacy_agent_id')
    if (seen.has(b.legacy_agent_id)) errors.push(`dup ${b.legacy_agent_id}`)
    seen.add(b.legacy_agent_id)
    if (!b.legacy_agent_id?.startsWith('AG-')) errors.push(`not AG- ${b.legacy_agent_id}`)
  }
  return { ok: errors.length === 0, errors }
}

export function legacyAgentToV2(legacyId, doc = loadTransitionalBindings()) {
  const b = (doc.bindings || []).find((x) => x.legacy_agent_id === legacyId)
  if (!b) return { status: 'unmapped', legacy_agent_id: legacyId }
  return {
    status: 'mapped',
    legacy_agent_id: legacyId,
    role_id: b.maps_role_to,
    default_model_family: b.default_model_family,
    default_model_variant: b.default_model_variant,
    default_effort: b.default_effort || null,
    deprecated: true,
    removal_condition: ['e2e_v2_green', 'all_consumers_migrated', 'boss_approved_cutover'],
    note: b.note || null,
  }
}

export function v2AssignmentToLegacy(assignment, doc = loadTransitionalBindings()) {
  const candidates = (doc.bindings || []).filter(
    (b) => b.maps_role_to === assignment.manager_id || b.maps_role_to === assignment.agent_role_id,
  )
  if (!candidates.length) {
    return { status: 'unmapped', assignment_agent: assignment.agent_role_id }
  }
  if (candidates.length > 1) {
    return {
      status: 'ambiguous',
      candidates: candidates.map((c) => c.legacy_agent_id),
      assignment_agent: assignment.agent_role_id,
    }
  }
  const b = candidates[0]
  return {
    status: 'mapped',
    legacy_agent_id: b.legacy_agent_id,
    deprecated: true,
    model_family: assignment.model?.family || b.default_model_family,
    model_variant: assignment.model?.variant || b.default_model_variant,
    effort: assignment.effort?.canonical || b.default_effort,
    removal_condition: ['e2e_v2_green', 'all_consumers_migrated', 'boss_approved_cutover'],
    note: 'read-only compat — not authority',
  }
}
