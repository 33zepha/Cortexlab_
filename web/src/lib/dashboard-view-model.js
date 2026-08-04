// Dashboard view-model: pure data transformation layer
// Separates operational data from presentation concerns
// Explicitly marks placeholder, estimated, and derived values

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0))
}

function formatNumber(value, digits = 2) {
  return Number(value || 0).toFixed(digits).replace('.', ',')
}

// Static graph structure (source of truth for topology)
const FLOW = [
  { id: 'hermes', label: 'Hermes', role: 'Chief of Staff', x: 50, y: 8 },
  { id: 'planner', label: 'Planner', role: 'Mission Planner', x: 50, y: 25 },
  { id: 'research', label: 'Researcher', role: 'Deep Research', x: 19, y: 46 },
  { id: 'frontend', label: 'Frontend Agent', role: 'UI/UX Specialist', x: 50, y: 46 },
  { id: 'backend', label: 'Backend Agent', role: 'Codex', x: 81, y: 46 },
  { id: 'design', label: 'Design System', role: 'Visual Agent', x: 50, y: 64 },
  { id: 'api', label: 'API Development', role: 'Backend Specialist', x: 81, y: 64 },
  { id: 'review', label: 'Reviewer', role: 'Quality Assurance', x: 50, y: 81 },
  { id: 'human', label: 'Human Approval', role: 'En attente', x: 50, y: 96 },
]

const CONNECTIONS = [
  ['hermes', 'planner'], ['planner', 'research'], ['planner', 'frontend'], ['planner', 'backend'],
  ['frontend', 'design'], ['backend', 'api'], ['research', 'review'], ['design', 'review'], ['api', 'review'], ['review', 'human'],
]

// Determine node execution state based on graph position and selection
function statusFor(nodeId, index, selectedId) {
  if (nodeId === 'human') return 'waiting'
  if (selectedId === nodeId) return 'running'
  if (index < 3) return 'done'
  if (index < 7) return 'running'
  return 'queued'
}

export function buildDashboardViewModel(ledgerData, now) {
  const { agents = [], events = [], missions = [], summary = {} } = ledgerData || {}

  // Mission selection: prefer running/active, fallback to first
  const mission = missions.find((m) => /running|active/i.test(m.status || '')) || missions[0]

  // Active agent count
  const activeAgentCount = agents.filter((a) => /active|running/i.test(a.status || '')).length

  // Progress: derived from mission or fallback // PLACEHOLDER
  const progress = clamp(mission?.progress || 62)

  // Graph state
  const selectedNodeId = null // Will be set by component interaction
  const nodes = FLOW.map((item, index) => ({
    ...item,
    state: statusFor(item.id, index, selectedNodeId),
  }))

  const edges = CONNECTIONS.map(([from, to]) => ({
    from,
    to,
    fromPoint: FLOW.find((n) => n.id === from),
    toPoint: FLOW.find((n) => n.id === to),
  }))

  // Mission summary section
  const budgetCost = summary.budget_cost || 12.45 // PLACEHOLDER if missing
  const budgetLimit = summary.budget_limit || 25 // PLACEHOLDER if missing
  const budgetPct = budgetLimit > 0 ? clamp((budgetCost / budgetLimit) * 100) : 49 // ESTIMATED fallback

  // Inspector for selected node (defaults to Frontend Agent)
  const selectedNode = FLOW[3]
  const inspectorItem = selectedNode

  return {
    // Mission context
    mission,
    connected: ledgerData?.connected || false,
    lastSync: ledgerData?.lastSync,
    now,

    // Summary rail
    summary: {
      mission,
      progress,
      budget: {
        cost: `€${formatNumber(budgetCost)}`, // PLACEHOLDER if from fallback
        limit: `€${formatNumber(budgetLimit)}`, // PLACEHOLDER if from fallback
        percent: budgetPct, // ESTIMATED fallback
      },
      tokens: {
        used: '1.24M', // PLACEHOLDER
        limit: '3M', // PLACEHOLDER
        percent: 41, // PLACEHOLDER
      },
      activeAgent: agents[0] || { name: 'Hermes', role: 'Chief of Staff' }, // FALLBACK
    },

    // Execution graph
    graph: {
      nodes,
      edges,
      selectedNodeId,
      activeAgentCount,
      nodeCount: nodes.length,
    },

    // Inspector
    inspector: {
      item: inspectorItem,
      state: 'running', // PLACEHOLDER
      progress: 80, // PLACEHOLDER
      duration: '1h 24m 17s', // PLACEHOLDER
      cost: '€0.18', // PLACEHOLDER
      tokens: '243,672', // PLACEHOLDER
      model: 'Claude 3.5 Sonnet', // PLACEHOLDER
      mandate: 'Créer l\'interface utilisateur pour le tableau de bord RH en respectant le design system et les composants existants.', // PLACEHOLDER
      context: [
        ['Bundle: RH Platform Guidelines', 'v2.1'], // PLACEHOLDER
        ['Figma: Dashboard Design', 'Updated'], // PLACEHOLDER
        ['Codebase: /frontend/src', 'Latest'], // PLACEHOLDER
      ],
      evidence: [
        ['UI Components', 'Validé'], // PLACEHOLDER
        ['Storybook', 'Validé'], // PLACEHOLDER
        ['Tests E2E', 'En attente'], // PLACEHOLDER
      ],
      dependencies: [
        ['Design System', 'Terminé'], // PLACEHOLDER
        ['API Contracts', 'En cours'], // PLACEHOLDER
      ],
    },

    // Events from ledger, with fallback
    events: events.length > 0 ? events : [
      { ts: new Date().toISOString(), data: { agent: 'Frontend Agent' }, type: 'Démarrage de la génération des composants' },
      { ts: new Date().toISOString(), data: { agent: 'Planner' }, type: 'Mandat décomposé en 5 sous-tâches' },
      { ts: new Date().toISOString(), data: { agent: 'Hermes' }, type: 'Routage vers Frontend Agent (Claude 3.5 Sonnet)' },
      { ts: new Date().toISOString(), data: { agent: 'Researcher' }, type: 'Recherche utilisateur terminée' },
      { ts: new Date().toISOString(), data: { agent: 'Hermes' }, type: 'Mission démarrée par commande externe' },
    ], // PLACEHOLDER fallback events

    // Health panel
    health: {
      status: 'Tout est opérationnel', // PLACEHOLDER
      agents: { online: 12, total: 12 }, // PLACEHOLDER
      services: { online: 8, total: 8 }, // PLACEHOLDER
      memory: 78, // PLACEHOLDER
    },
  }
}

export { FLOW, CONNECTIONS }
