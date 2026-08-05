/**
 * organization-router.mjs v2 — lexical tokens, topo order, clarification, Mnemosyne rules.
 */
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const ROLES_PATH = path.join(ROOT, 'contracts', 'roles.yaml')

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

export function loadRoles(rolesPath = ROLES_PATH) {
  return yaml.load(fs.readFileSync(rolesPath, 'utf8'))
}

export function normalizeMissionText(s = '') {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenizeMissionText(s = '') {
  const n = normalizeMissionText(s)
  return n ? n.split(' ').filter(Boolean) : []
}

export function hasAnyToken(tokens, list) {
  const set = new Set(tokens)
  return list.some((t) => set.has(normalizeMissionText(t)))
}

export function hasPhrase(text, phrase) {
  return normalizeMissionText(text).includes(normalizeMissionText(phrase))
}

export function topologicalSortAgents(agentIds, dependencies = []) {
  const ids = [...new Set(agentIds)]
  const idSet = new Set(ids)
  const indeg = Object.fromEntries(ids.map((id) => [id, 0]))
  const adj = Object.fromEntries(ids.map((id) => [id, []]))

  for (const d of dependencies) {
    if (!idSet.has(d.before) || !idSet.has(d.after)) {
      throw new Error(`dependency references missing agent: ${d.before} -> ${d.after}`)
    }
    adj[d.before].push(d.after)
    indeg[d.after] += 1
  }

  // stable: seed queue sorted alphabetically among zero indegree
  const q = ids.filter((id) => indeg[id] === 0).sort()
  const order = []
  while (q.length) {
    const n = q.shift()
    order.push(n)
    const nexts = [...adj[n]].sort()
    for (const m of nexts) {
      indeg[m] -= 1
      if (indeg[m] === 0) {
        // insert keeping sorted
        q.push(m)
        q.sort()
      }
    }
  }
  if (order.length !== ids.length) {
    throw new Error('dependency cycle detected among agents')
  }
  return order
}

/**
 * @returns organization plan
 */
export function routeOrganization(mission = {}, rolesDoc = loadRoles()) {
  const {
    goal = '',
    domains = [],
    risk = 'medium',
    needs_evaluation = false,
    needs_pedagogy = false,
  } = mission

  const text = `${goal} ${(domains || []).join(' ')}`
  const tokens = tokenizeMissionText(text)
  const roles = rolesDoc.roles || []
  const byId = Object.fromEntries(roles.map((r) => [r.id, r]))

  const managers = new Set()
  const agents = new Set()
  const deps = []
  const proofs = new Set()
  const rationale = []

  const addManager = (id) => {
    if (!byId[id]) throw new Error(`unknown manager ${id}`)
    managers.add(id)
  }
  const addAgent = (id) => {
    if (!byId[id]) throw new Error(`unknown agent ${id}`)
    agents.add(id)
  }

  const engTokens = [
    'code', 'bug', 'fix', 'implement', 'implementation', 'refactor', 'test', 'tests',
    'api', 'runtime', 'deploy', 'migration', 'backend', 'frontend', 'engineer', 'engineering',
    'service', 'server', 'build', 'scoping', 'scope', 'contrat', 'contract', 'debug', 'crash',
  ]
  const uiTokens = [
    'ui', 'ux', 'mobile', 'design', 'interface', 'visuel', 'visual', 'accessib', 'accessibility',
    'produit', 'product', 'experience', 'layout', 'css', 'écran', 'ecran', 'responsive', 'polish',
  ]
  // "build" alone is eng, not UI — handled via engTokens only. Avoid bare /ui/ regex on "build".

  const domainEng = domains.some((d) =>
    ['engineering', 'frontend', 'backend', 'implementation', 'testing', 'debugging'].includes(d),
  )
  const domainPx = domains.some((d) => ['product_experience', 'ui', 'ux', 'design'].includes(d))
  const domainResearch = domains.some((d) => ['research', 'data'].includes(d))

  const wantEng =
    domainEng ||
    hasAnyToken(tokens, engTokens) ||
    hasPhrase(text, 'mission control') && hasAnyToken(tokens, ['fix', 'corriger', 'scoping', 'bug'])

  const wantPx =
    domainPx ||
    hasAnyToken(tokens, uiTokens) ||
    hasPhrase(text, 'mission control') && hasAnyToken(tokens, ['mobile', 'visuel', 'visual', 'ux', 'ui', 'design', 'refonte'])

  const wantResearch =
    domainResearch ||
    hasAnyToken(tokens, ['research', 'source', 'paper', 'benchmark', 'documentaire', 'synthèse', 'synthese', 'web', 'twitter', 'x']) ||
    hasPhrase(text, 'orchestration agentique')

  // Ambiguous?
  const signalStrength = (wantEng ? 1 : 0) + (wantPx ? 1 : 0) + (wantResearch ? 1 : 0) + (domains.length ? 1 : 0)
  const goalEmpty = !normalizeMissionText(goal) || ['ameliore le truc', 'improve the thing', 'fix it', 'do something'].includes(normalizeMissionText(goal))
  if (signalStrength === 0 || goalEmpty) {
    return {
      status: 'needs_clarification',
      manager_role_ids: [],
      agent_role_ids: [],
      agent_manager_map: {},
      dependencies: [],
      execution_order: [],
      proofs_required: [],
      rationale: ['insufficient_signal'],
      clarification_questions: [
        'Quel domaine principal : engineering, product/UX, research ?',
        'Quel livrable concret attendu ?',
        'Quel niveau de risque (low/medium/high/critical) ?',
      ],
      risk,
      model_selection: null,
    }
  }

  if (wantEng) {
    addManager('MGR-ENGINEERING')
    rationale.push('engineering signals → MGR-ENGINEERING')
    if (hasAnyToken(tokens, ['archi', 'architecture', 'contrat', 'contract', 'migration'])) {
      addAgent('AGENT-ARCHITECTURE')
    }
    if (
      hasAnyToken(tokens, ['front', 'frontend', 'ui', 'react', 'css', 'mobile']) ||
      domains.includes('frontend') ||
      wantPx
    ) {
      addAgent('AGENT-FRONTEND-ENGINEER')
    }
    if (hasAnyToken(tokens, ['back', 'backend', 'api', 'server', 'runtime', 'service']) || domains.includes('backend')) {
      addAgent('AGENT-BACKEND-ENGINEER')
    }
    if (hasAnyToken(tokens, ['test', 'tests', 'qa', 'proof', 'preuve']) || risk !== 'low') {
      addAgent('AGENT-TEST-ENGINEER')
    }
    if (hasAnyToken(tokens, ['debug', 'bug', 'crash', 'fix', 'corriger', 'scoping'])) {
      addAgent('AGENT-DEBUGGING')
    }
    if (hasAnyToken(tokens, ['secur', 'security', 'auth', 'token', 'xss', 'injection']) || risk === 'critical') {
      addAgent('AGENT-SECURITY-REVIEWER')
    }
    if (hasAnyToken(tokens, ['release', 'ship', 'deploy'])) addAgent('AGENT-RELEASE-REVIEWER')
    // ensure at least one eng agent
    if (![...agents].some((a) => byId[a]?.reports_to === 'MGR-ENGINEERING')) {
      if (domains.includes('backend') || hasAnyToken(tokens, ['backend', 'api', 'service'])) {
        addAgent('AGENT-BACKEND-ENGINEER')
      } else {
        addAgent('AGENT-FRONTEND-ENGINEER')
      }
      addAgent('AGENT-TEST-ENGINEER')
    }
    proofs.add('tests')
  }

  if (wantPx) {
    addManager('MGR-PRODUCT-EXPERIENCE')
    rationale.push('product/UX signals → MGR-PRODUCT-EXPERIENCE')
    addAgent('AGENT-UX-ANALYST')
    if (hasAnyToken(tokens, ['design', 'interface', 'layout', 'refonte'])) addAgent('AGENT-INTERFACE-DESIGNER')
    if (hasAnyToken(tokens, ['anim', 'interaction', 'state'])) addAgent('AGENT-INTERACTION-DESIGNER')
    if (
      hasAnyToken(tokens, ['visuel', 'visual', 'capture', 'screenshot', 'mobile', 'preuve']) ||
      risk !== 'low' ||
      hasPhrase(text, 'preuves visuelles')
    ) {
      addAgent('AGENT-VISUAL-REVIEWER')
    }
    if (hasAnyToken(tokens, ['a11y', 'accessib', 'contrast', 'clavier', 'keyboard'])) {
      addAgent('AGENT-ACCESSIBILITY-REVIEWER')
    }
    if (hasAnyToken(tokens, ['produit', 'product', 'scope', 'objectif'])) addAgent('AGENT-PRODUCT-ANALYST')
    proofs.add('visual-proof')
  }

  if (wantResearch) {
    addManager('MGR-RESEARCH')
    rationale.push('research signals → MGR-RESEARCH')
    addAgent('AGENT-RESEARCH')
    if (hasAnyToken(tokens, ['source', 'cite', 'verif', 'comparer', 'compare'])) addAgent('AGENT-SOURCE-VERIFIER')
    if (hasAnyToken(tokens, ['long', 'huge', 'massif', 'context'])) addAgent('AGENT-LONG-CONTEXT-READER')
    addAgent('AGENT-SYNTHESIS')
    if (hasAnyToken(tokens, ['fact', 'claim', 'contradict'])) addAgent('AGENT-FACT-CHECKER')
    proofs.add('sources')
  }

  // Mnemosyne rules
  const wantMnemo =
    needs_evaluation === true ||
    needs_pedagogy === true ||
    risk === 'high' ||
    risk === 'critical'
  if (wantMnemo) {
    addManager('MGR-LEARNING-EVALUATION')
    rationale.push('evaluation/pedagogy/risk → MGR-LEARNING-EVALUATION')
    if (risk === 'high' || risk === 'critical' || needs_evaluation) {
      addAgent('AGENT-MISSION-EVALUATOR')
    }
    if (wantEng || wantPx) addAgent('AGENT-EVIDENCE-AUDITOR')
    if (risk === 'critical') {
      addAgent('AGENT-ROUTING-EVALUATOR')
      addAgent('AGENT-MODEL-EVALUATOR')
      proofs.add('second_family_review')
    }
    if (needs_pedagogy || risk === 'critical') addAgent('AGENT-PEDAGOGY')
    proofs.add('evaluation-brief')
  }

  // dependencies
  if (agents.has('AGENT-UX-ANALYST') && agents.has('AGENT-INTERFACE-DESIGNER')) {
    deps.push({ before: 'AGENT-UX-ANALYST', after: 'AGENT-INTERFACE-DESIGNER' })
  }
  if (agents.has('AGENT-UX-ANALYST') && agents.has('AGENT-FRONTEND-ENGINEER')) {
    deps.push({ before: 'AGENT-UX-ANALYST', after: 'AGENT-FRONTEND-ENGINEER' })
  }
  if (agents.has('AGENT-INTERFACE-DESIGNER') && agents.has('AGENT-FRONTEND-ENGINEER')) {
    deps.push({ before: 'AGENT-INTERFACE-DESIGNER', after: 'AGENT-FRONTEND-ENGINEER' })
  }
  if (agents.has('AGENT-FRONTEND-ENGINEER') && agents.has('AGENT-TEST-ENGINEER')) {
    deps.push({ before: 'AGENT-FRONTEND-ENGINEER', after: 'AGENT-TEST-ENGINEER' })
  }
  if (agents.has('AGENT-BACKEND-ENGINEER') && agents.has('AGENT-TEST-ENGINEER')) {
    deps.push({ before: 'AGENT-BACKEND-ENGINEER', after: 'AGENT-TEST-ENGINEER' })
  }
  if (agents.has('AGENT-ARCHITECTURE') && agents.has('AGENT-BACKEND-ENGINEER')) {
    deps.push({ before: 'AGENT-ARCHITECTURE', after: 'AGENT-BACKEND-ENGINEER' })
  }
  if (agents.has('AGENT-ARCHITECTURE') && agents.has('AGENT-FRONTEND-ENGINEER')) {
    deps.push({ before: 'AGENT-ARCHITECTURE', after: 'AGENT-FRONTEND-ENGINEER' })
  }
  if (agents.has('AGENT-TEST-ENGINEER') && agents.has('AGENT-MISSION-EVALUATOR')) {
    deps.push({ before: 'AGENT-TEST-ENGINEER', after: 'AGENT-MISSION-EVALUATOR' })
  }
  if (agents.has('AGENT-VISUAL-REVIEWER') && agents.has('AGENT-FRONTEND-ENGINEER')) {
    deps.push({ before: 'AGENT-FRONTEND-ENGINEER', after: 'AGENT-VISUAL-REVIEWER' })
  }

  const agentList = [...agents]
  const execution_order = topologicalSortAgents(agentList, deps)

  // agent_manager_map
  const agent_manager_map = {}
  for (const id of agentList) {
    const mgr = byId[id].reports_to
    agent_manager_map[id] = mgr
    if (!managers.has(mgr)) {
      throw new Error(`agent ${id} reports_to ${mgr} not in manager_role_ids`)
    }
    if (MODEL_BRAND_RE.test(id) || MODEL_BRAND_RE.test(mgr)) {
      throw new Error(`model-branded role id: ${id}/${mgr}`)
    }
    if (byId[id].provider || byId[id].model) {
      throw new Error(`role ${id} must not carry provider/model`)
    }
  }

  // critical dual-family proof note
  if (risk === 'critical') {
    proofs.add('second_family_review')
  }

  return {
    status: 'ok',
    manager_role_ids: [...managers].sort(),
    agent_role_ids: [...agentList].sort(),
    agent_manager_map,
    dependencies: deps,
    execution_order,
    proofs_required: [...proofs].sort(),
    rationale,
    clarification_questions: [],
    risk,
    model_selection: null,
  }
}

export function buildRoleAssignments(orgPlan, missionId = 'MIS-UNKNOWN') {
  const roles = loadRoles()
  const byId = Object.fromEntries((roles.roles || []).map((r) => [r.id, r]))
  const order = orgPlan.execution_order || orgPlan.agent_role_ids || []
  return order.map((agent_role_id, i) => {
    const agent = byId[agent_role_id]
    return {
      mission_id: missionId,
      manager_id: orgPlan.agent_manager_map?.[agent_role_id] || agent?.reports_to,
      agent_role_id,
      session_id: null,
      model: null,
      effort: null,
      order: i,
      role_profile: agent?.model_requirements || null,
    }
  })
}
