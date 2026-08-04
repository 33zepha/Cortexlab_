// Dashboard view-model: pure data transformation layer
// Single source of truth for dashboard presentation data.
// Explicitly marks LIVE, DERIVED, ESTIMATED and PLACEHOLDER values.

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0))
}

function formatNumber(value, digits = 2) {
  return Number(value || 0).toFixed(digits).replace('.', ',')
}

// Static graph structure (source of truth for topology) // PLACEHOLDER topology
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

// Default selected node id, equivalent to the original useState(FLOW[3]) default.
const DEFAULT_SELECTED_NODE_ID = FLOW[3].id

// DERIVED: node execution state from graph position and current selection
function statusFor(nodeId, index, selectedId) {
  if (nodeId === 'human') return 'waiting'
  if (selectedId === nodeId) return 'running'
  if (index < 3) return 'done'
  if (index < 7) return 'running'
  return 'queued'
}

function progressLabelFor(state) {
  if (state === 'done') return '100%'
  if (state === 'waiting') return 'En attente'
  if (state === 'queued') return '40%'
  return '80%'
}

export function buildDashboardViewModel(ledgerData, now, selectedNodeId = DEFAULT_SELECTED_NODE_ID) {
  const { agents = [], events = [], missions = [], summary = {}, connected = false, lastSync = null } = ledgerData || {}

  // LIVE: mission selection from ledger, DERIVED fallback to first entry
  const mission = missions.find((m) => /running|active/i.test(m.status || '')) || missions[0]

  // LIVE: active agent count from ledger
  const activeAgentCount = agents.filter((a) => /active|running/i.test(a.status || '')).length

  // DERIVED from mission, ESTIMATED fallback
  const progress = clamp(mission?.progress || 62)

  // Graph: DERIVED state per node from static topology + current selection
  const nodes = FLOW.map((item, index) => ({
    ...item,
    state: statusFor(item.id, index, selectedNodeId),
    progressLabel: progressLabelFor(statusFor(item.id, index, selectedNodeId)),
  }))

  const edges = CONNECTIONS.map(([from, to]) => ({
    from,
    to,
    fromPoint: FLOW.find((n) => n.id === from),
    toPoint: FLOW.find((n) => n.id === to),
  }))

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[3]

  // ESTIMATED/PLACEHOLDER: budget not yet fully exposed by backend
  const budgetCost = summary.budget_cost || 12.45 // PLACEHOLDER if missing from ledger
  const budgetLimit = summary.budget_limit || 25 // PLACEHOLDER if missing from ledger
  const budgetPct = budgetLimit > 0 ? clamp((budgetCost / budgetLimit) * 100) : 49 // ESTIMATED fallback

  return {
    // Mission context (LIVE via useLedger/useNow)
    mission,
    connected,
    lastSync,
    now,

    // Summary rail
    summary: {
      mission,
      progress, // DERIVED
      budget: {
        cost: `€${formatNumber(budgetCost)}`, // PLACEHOLDER if from fallback
        limit: `€${formatNumber(budgetLimit)}`, // PLACEHOLDER if from fallback
        percent: budgetPct, // ESTIMATED
      },
      tokens: {
        used: '1.24M', // PLACEHOLDER
        limit: '3M', // PLACEHOLDER
        percent: 41, // PLACEHOLDER
      },
      activeAgent: agents[0] || { name: 'Hermes', role: 'Chief of Staff' }, // LIVE with PLACEHOLDER fallback
    },

    // Execution graph
    graph: {
      nodes, // DERIVED (topology PLACEHOLDER, state DERIVED)
      edges, // PLACEHOLDER topology
      selectedNodeId,
      activeAgentCount, // LIVE
      nodeCount: nodes.length,
    },

    // Inspector for the currently selected node — all metrics PLACEHOLDER
    // until the backend exposes real per-node execution data.
    inspector: {
      item: selectedNode,
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
      contextTokens: '3,240 tokens', // PLACEHOLDER
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

    // Events: LIVE from ledger, PLACEHOLDER fallback when empty
    events: events.length > 0 ? events : [
      { ts: new Date().toISOString(), data: { agent: 'Frontend Agent' }, type: 'Démarrage de la génération des composants' },
      { ts: new Date().toISOString(), data: { agent: 'Planner' }, type: 'Mandat décomposé en 5 sous-tâches' },
      { ts: new Date().toISOString(), data: { agent: 'Hermes' }, type: 'Routage vers Frontend Agent (Claude 3.5 Sonnet)' },
      { ts: new Date().toISOString(), data: { agent: 'Researcher' }, type: 'Recherche utilisateur terminée' },
      { ts: new Date().toISOString(), data: { agent: 'Hermes' }, type: 'Mission démarrée par commande externe' },
    ], // PLACEHOLDER fallback events

    // Terminal output — PLACEHOLDER until runtime exposes a real stream
    terminal: `> cortex mission status MIS-2024-05-24-001\n\nMission: Refonte plateforme RH multi-agent\nStatus: Running\nProgress: 62%\nActive Agents: 7\nBudget: €12.45 / €25.00\nTokens: 1,243,672 / 3,000,000\nStart Time: 2024-05-24 12:47:33\nUptime: 2h 47m 12s\n\n>`,

    // Health panel — PLACEHOLDER until runtime exposes real health metrics
    health: {
      status: 'Tout est opérationnel', // PLACEHOLDER
      agents: { online: 12, total: 12 }, // PLACEHOLDER
      services: { online: 8, total: 8 }, // PLACEHOLDER
      memory: 78, // PLACEHOLDER
    },
  }
}

export { FLOW, CONNECTIONS, DEFAULT_SELECTED_NODE_ID }
