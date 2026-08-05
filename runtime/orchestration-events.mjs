/**
 * orchestration-events.mjs — pure V2 planning events + legacy prep (no EventStore prod write).
 */
import crypto from 'node:crypto'

export function createPlanningEvents(plan) {
  const events = []
  const hash = plan.metadata?.plan_hash || 'unknown'
  const missionId = plan.mission?.id

  if (plan.status === 'needs_clarification' || plan.organization?.status === 'needs_clarification') {
    events.push(ev('mission.clarification.required.v2', {
      mission_id: missionId,
      plan_hash: hash,
      questions: plan.organization?.clarification_questions || [],
    }))
    return events
  }

  events.push(ev('mission.plan.created.v2', {
    mission_id: missionId,
    plan_hash: hash,
    status: plan.status,
    risk: plan.mission?.risk,
  }))

  for (const mid of plan.organization?.manager_role_ids || []) {
    events.push(ev('manager.assigned.v2', {
      mission_id: missionId,
      manager_role_id: mid,
      plan_hash: hash,
    }))
  }

  for (const a of plan.assignments || []) {
    events.push(ev('agent.role.assigned.v2', {
      mission_id: missionId,
      manager_role_id: a.manager_id,
      agent_role_id: a.agent_role_id,
      plan_hash: hash,
      order: a.order,
    }))
    if (a.status === 'planned' && a.model) {
      events.push(ev('model.selected.v2', {
        mission_id: missionId,
        manager_role_id: a.manager_id,
        agent_role_id: a.agent_role_id,
        model_family: a.model.family,
        model_variant: a.model.variant,
        access_channel: a.model.access_channel,
        selection_reason: a.selection?.reason,
        fallback_count: (a.selection?.fallback_chain || []).length,
        plan_hash: hash,
      }))
      events.push(ev('effort.selected.v2', {
        mission_id: missionId,
        agent_role_id: a.agent_role_id,
        canonical_effort: a.effort?.canonical,
        provider_effort: a.effort?.provider,
        effort_semantics: a.effort?.semantics,
        mapping_reason: a.effort?.mapping_reason,
        plan_hash: hash,
      }))
      events.push(ev('session.planned.v2', {
        mission_id: missionId,
        session_id: a.session_id,
        agent_role_id: a.agent_role_id,
        manager_role_id: a.manager_id,
        model_family: a.model.family,
        model_variant: a.model.variant,
        access_channel: a.model.access_channel,
        canonical_effort: a.effort?.canonical,
        provider_effort: a.effort?.provider,
        plan_hash: hash,
      }))
    }
  }

  if (plan.status === 'blocked' || plan.organization?.status === 'blocked') {
    events.push(ev('mission.plan.blocked.v2', {
      mission_id: missionId,
      plan_hash: hash,
      reasons: plan.organization?.block_reasons || [],
    }))
  }

  return events
}

export function createLegacyCompatibilityEvents(plan, transitionalBindings) {
  const bindings = transitionalBindings?.bindings || []
  const byRole = {}
  for (const b of bindings) {
    if (b.maps_role_to) byRole[b.maps_role_to] = b
  }
  const events = []
  const hash = plan.metadata?.plan_hash
  for (const a of plan.assignments || []) {
    if (a.status !== 'planned') continue
    const b = byRole[a.manager_id]
    if (!b) {
      events.push(ev('legacy.mapping.unmapped.v2', {
        mission_id: plan.mission?.id,
        agent_role_id: a.agent_role_id,
        manager_id: a.manager_id,
        plan_hash: hash,
      }))
      continue
    }
    // planning-only legacy shadow event — NEVER agent.result
    events.push(ev('legacy.agent.planned.v1', {
      mission_id: plan.mission?.id,
      legacy_agent_id: b.legacy_agent_id,
      manager_role_id: a.manager_id,
      agent_role_id: a.agent_role_id,
      model_family: a.model?.family,
      model_variant: a.model?.variant,
      canonical_effort: a.effort?.canonical,
      deprecated: true,
      note: 'shadow planning only — no execution',
      plan_hash: hash,
    }))
  }
  return events
}

function ev(type, data) {
  return {
    ts: null, // filled by store
    type,
    data,
    id: crypto.randomBytes(8).toString('hex'),
  }
}
