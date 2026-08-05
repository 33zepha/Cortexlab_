/**
 * organization-router.mjs — routage organisationnel pur.
 * Choisit managers + agents spécialisés. Ne choisit AUCUN modèle.
 */
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const ROLES_PATH = path.join(ROOT, 'contracts', 'roles.yaml')

export function loadRoles(rolesPath = ROLES_PATH) {
  return yaml.load(fs.readFileSync(rolesPath, 'utf8'))
}

/**
 * @param {object} mission
 * @param {string} mission.goal
 * @param {string[]} [mission.domains]
 * @param {string} [mission.risk]
 * @param {boolean} [mission.needs_evaluation]
 * @returns {{ manager_role_ids, agent_role_ids, dependencies, proofs_required, rationale }}
 */
export function routeOrganization(mission = {}, rolesDoc = loadRoles()) {
  const {
    goal = '',
    domains = [],
    risk = 'medium',
    needs_evaluation = true,
  } = mission

  const text = `${goal} ${(domains || []).join(' ')}`.toLowerCase()
  const roles = rolesDoc.roles || []
  const byId = Object.fromEntries(roles.map((r) => [r.id, r]))

  const managers = new Set()
  const agents = new Set()
  const deps = []
  const proofs = new Set()
  const rationale = []

  const addManager = (id) => {
    if (byId[id]) managers.add(id)
  }
  const addAgent = (id) => {
    if (byId[id]) agents.add(id)
  }

  // domain detection
  const wantEng =
    domains.includes('engineering') ||
    domains.includes('frontend') ||
    domains.includes('backend') ||
    domains.includes('implementation') ||
    /code|bug|fix|implement|refactor|test|api|runtime|deploy|migration/i.test(text)

  const wantPx =
    domains.includes('product_experience') ||
    domains.includes('ui') ||
    domains.includes('ux') ||
    /ui|ux|mobile|design|interface|visuel|visual|accessib|produit|experience/i.test(text)

  const wantResearch =
    domains.includes('research') ||
    domains.includes('data') ||
    /research|source|paper|benchmark|compar|documentaire|long.?context|synth/i.test(text)

  if (wantEng) {
    addManager('MGR-ENGINEERING')
    rationale.push('engineering signals → MGR-ENGINEERING')
    if (/archi/i.test(text)) addAgent('AGENT-ARCHITECTURE')
    if (/front|ui|react|css|mobile/i.test(text) || domains.includes('frontend')) {
      addAgent('AGENT-FRONTEND-ENGINEER')
    }
    if (/back|api|server|runtime/i.test(text) || domains.includes('backend')) {
      addAgent('AGENT-BACKEND-ENGINEER')
    }
    if (/test|qa|proof/i.test(text) || risk !== 'low') addAgent('AGENT-TEST-ENGINEER')
    if (/debug|bug|crash/i.test(text)) addAgent('AGENT-DEBUGGING')
    if (/secur|auth|token|xss|injection/i.test(text) || risk === 'critical') {
      addAgent('AGENT-SECURITY-REVIEWER')
    }
    if (/release|ship|deploy/i.test(text)) addAgent('AGENT-RELEASE-REVIEWER')
    // default eng pair
    if (![...agents].some((a) => byId[a]?.reports_to === 'MGR-ENGINEERING')) {
      addAgent('AGENT-FRONTEND-ENGINEER')
      addAgent('AGENT-TEST-ENGINEER')
    }
    proofs.add('tests')
  }

  if (wantPx) {
    addManager('MGR-PRODUCT-EXPERIENCE')
    rationale.push('product/UX signals → MGR-PRODUCT-EXPERIENCE')
    addAgent('AGENT-UX-ANALYST')
    if (/design|interface|layout/i.test(text)) addAgent('AGENT-INTERFACE-DESIGNER')
    if (/anim|interaction|state/i.test(text)) addAgent('AGENT-INTERACTION-DESIGNER')
    if (/visuel|visual|capture|screenshot|mobile/i.test(text) || risk !== 'low') {
      addAgent('AGENT-VISUAL-REVIEWER')
    }
    if (/a11y|accessib|contrast|clavier|keyboard/i.test(text)) {
      addAgent('AGENT-ACCESSIBILITY-REVIEWER')
    }
    if (/produit|scope|criterion|objectif/i.test(text)) addAgent('AGENT-PRODUCT-ANALYST')
    proofs.add('visual-proof')
  }

  if (wantResearch) {
    addManager('MGR-RESEARCH')
    rationale.push('research signals → MGR-RESEARCH')
    addAgent('AGENT-RESEARCH')
    if (/source|cite|verif/i.test(text)) addAgent('AGENT-SOURCE-VERIFIER')
    if (/long|huge|massif|1m|context/i.test(text)) addAgent('AGENT-LONG-CONTEXT-READER')
    addAgent('AGENT-SYNTHESIS')
    if (/fact|claim|contradict/i.test(text)) addAgent('AGENT-FACT-CHECKER')
    proofs.add('sources')
  }

  // default if nothing matched
  if (managers.size === 0) {
    addManager('MGR-ENGINEERING')
    addAgent('AGENT-FRONTEND-ENGINEER')
    addAgent('AGENT-TEST-ENGINEER')
    rationale.push('fallback default engineering pair')
    proofs.add('tests')
  }

  // evaluation / Mnemosyne
  if (needs_evaluation || risk === 'high' || risk === 'critical') {
    addManager('MGR-LEARNING-EVALUATION')
    addAgent('AGENT-MISSION-EVALUATOR')
    if (wantEng || wantPx) addAgent('AGENT-EVIDENCE-AUDITOR')
    if (risk === 'critical') {
      addAgent('AGENT-ROUTING-EVALUATOR')
      addAgent('AGENT-MODEL-EVALUATOR')
    }
    addAgent('AGENT-PEDAGOGY')
    rationale.push('evaluation → MGR-LEARNING-EVALUATION (Mnemosyne)')
    proofs.add('evaluation-brief')
  }

  // dependencies: UX before frontend when both
  if (agents.has('AGENT-UX-ANALYST') && agents.has('AGENT-FRONTEND-ENGINEER')) {
    deps.push({ before: 'AGENT-UX-ANALYST', after: 'AGENT-FRONTEND-ENGINEER' })
  }
  if (agents.has('AGENT-INTERFACE-DESIGNER') && agents.has('AGENT-FRONTEND-ENGINEER')) {
    deps.push({ before: 'AGENT-INTERFACE-DESIGNER', after: 'AGENT-FRONTEND-ENGINEER' })
  }
  if (agents.has('AGENT-FRONTEND-ENGINEER') && agents.has('AGENT-TEST-ENGINEER')) {
    deps.push({ before: 'AGENT-FRONTEND-ENGINEER', after: 'AGENT-TEST-ENGINEER' })
  }
  if (agents.has('AGENT-TEST-ENGINEER') && agents.has('AGENT-MISSION-EVALUATOR')) {
    deps.push({ before: 'AGENT-TEST-ENGINEER', after: 'AGENT-MISSION-EVALUATOR' })
  }

  // validate no model brands in role ids
  for (const id of [...managers, ...agents]) {
    if (/claude|codex|kimi|luna|hy3|gemini|grok/i.test(id)) {
      throw new Error(`organization router produced model-branded role id: ${id}`)
    }
    if (!byId[id]) throw new Error(`unknown role ${id}`)
    // agents must not carry provider/model fields
    if (byId[id].provider || byId[id].model) {
      throw new Error(`role ${id} must not carry provider/model`)
    }
  }

  return {
    manager_role_ids: [...managers].sort(),
    agent_role_ids: [...agents].sort(),
    dependencies: deps,
    proofs_required: [...proofs].sort(),
    rationale,
    risk,
    // explicit: no model selection here
    model_selection: null,
  }
}

/**
 * Build session assignment stubs (role only) for later model-selector.
 */
export function buildRoleAssignments(orgPlan, missionId = 'MIS-UNKNOWN') {
  const roles = loadRoles()
  const byId = Object.fromEntries((roles.roles || []).map((r) => [r.id, r]))
  return (orgPlan.agent_role_ids || []).map((agent_role_id, i) => {
    const agent = byId[agent_role_id]
    return {
      mission_id: missionId,
      manager_id: agent?.reports_to,
      agent_role_id,
      session_id: null,
      model: null,
      effort: null,
      order: i,
    }
  })
}
