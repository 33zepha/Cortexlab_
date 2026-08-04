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

  // Determine provenance for each section
  const isMissionLive = missions && missions.length > 0
  const activeMission = missions.find((m) => /running|active/i.test(m.status || '')) || missions[0]

  const isBudgetCostLive = summary && summary.budget_cost != null
  const isBudgetLimitLive = summary && summary.budget_limit != null
  const isBudgetCompleteLive = isBudgetCostLive && isBudgetLimitLive

  const areEventsLive = events && events.length > 0
  const areAgentsLive = agents && agents.length > 0

  const progressFromMission = activeMission?.progress

  // LIVE: mission selection from ledger, PLACEHOLDER fallback
  const mission = activeMission

  // LIVE: active agent count from ledger
  const activeAgentCount = agents.filter((a) => /active|running/i.test(a.status || '')).length

  // LIVE if mission present, PLACEHOLDER fallback
  const progress = clamp(progressFromMission ?? 62)

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

  // LIVE or PLACEHOLDER: budget from backend or fallback
  const budgetCost = isBudgetCostLive ? summary.budget_cost : 2.5
  const budgetLimit = isBudgetLimitLive ? summary.budget_limit : 5.0
  const budgetPct = budgetLimit > 0 ? clamp((budgetCost / budgetLimit) * 100) : 50

  // Fallback mission structure when no mission is available
  const missionOrFallback = mission || {
    id: 'MIS-UNKNOWN',
    name: 'Aucune mission active',
    domain: null,
    status: 'idle',
    started_at: null,
  }

  return {
    // Mission context (LIVE via useLedger/useNow)
    mission: missionOrFallback,
    connected,
    lastSync,
    now,

    // Summary rail
    summary: {
      mission: missionOrFallback,
      progress, // LIVE if mission present, PLACEHOLDER if fallback
      budget: {
        cost: `€${formatNumber(budgetCost)}`,
        limit: `€${formatNumber(budgetLimit)}`,
        percent: budgetPct,
      },
      tokens: {
        used: '1.24M', // PLACEHOLDER
        limit: '3M', // PLACEHOLDER
        percent: 41, // PLACEHOLDER
      },
      activeAgent: agents[0] || { name: 'unknown', role: 'unassigned' },
    },

    // Execution graph
    graph: {
      nodes, // PLACEHOLDER (FLOW topology is hardcoded, states are simulated)
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
    events: areEventsLive ? events : [
      { ts: new Date().toISOString(), data: { agent: 'Frontend Agent' }, type: 'Démarrage de la génération des composants' },
      { ts: new Date().toISOString(), data: { agent: 'Planner' }, type: 'Mandat décomposé en 5 sous-tâches' },
      { ts: new Date().toISOString(), data: { agent: 'Hermes' }, type: 'Routage vers Frontend Agent (Claude 3.5 Sonnet)' },
      { ts: new Date().toISOString(), data: { agent: 'Researcher' }, type: 'Recherche utilisateur terminée' },
      { ts: new Date().toISOString(), data: { agent: 'Hermes' }, type: 'Mission démarrée par commande externe' },
    ],

    // Terminal output — PLACEHOLDER until runtime exposes a real stream
    terminal: `> cortex mission status MIS-2024-05-24-001\n\nMission: Refonte plateforme RH multi-agent\nStatus: Running\nProgress: 62%\nActive Agents: 7\nBudget: €12.45 / €25.00\nTokens: 1,243,672 / 3,000,000\nStart Time: 2024-05-24 12:47:33\nUptime: 2h 47m 12s\n\n>`,

    // Health panel — PLACEHOLDER until runtime exposes real health metrics
    health: {
      status: 'Tout est opérationnel',
      agents: { online: 12, total: 12 },
      services: { online: 8, total: 8 },
      memory: 78,
    },

    // Provenance metadata: tracks the source and confidence of each section
    provenance: {
      mission: {
        kind: isMissionLive ? 'LIVE' : 'PLACEHOLDER',
        source: isMissionLive ? 'ledger.missions[0] via /api/missions' : 'fallback (no active mission)',
        updatedAt: isMissionLive ? lastSync : null,
        confidence: isMissionLive ? 1 : 0,
      },

      'summary.progress': {
        kind: isMissionLive ? 'LIVE' : 'PLACEHOLDER',
        source: isMissionLive ? 'mission.progress from runtime' : 'fallback (62)',
        updatedAt: isMissionLive ? lastSync : null,
        confidence: isMissionLive ? 1 : 0,
      },

      'summary.budget': {
        kind: isBudgetCompleteLive ? 'LIVE' : isBudgetCostLive || isBudgetLimitLive ? 'DERIVED' : 'PLACEHOLDER',
        source: isBudgetCompleteLive ? 'ledger.summary.budget_* via /api/missions' : 'fallback (2.5 / 5.0)',
        updatedAt: isBudgetCompleteLive ? lastSync : null,
        confidence: isBudgetCompleteLive ? 1 : isBudgetCostLive || isBudgetLimitLive ? 0.5 : 0,
      },

      'summary.tokens': {
        kind: 'PLACEHOLDER',
        source: 'hardcoded (no runtime source yet)',
        updatedAt: null,
        confidence: 0,
      },

      'summary.activeAgent': {
        kind: areAgentsLive ? 'LIVE' : 'PLACEHOLDER',
        source: areAgentsLive ? 'ledger.agents[0] via /api/agents' : 'fallback',
        updatedAt: areAgentsLive ? lastSync : null,
        confidence: areAgentsLive ? 1 : 0,
      },

      graph: {
        kind: 'PLACEHOLDER',
        source: 'hardcoded FLOW/CONNECTIONS arrays + statusFor simulation',
        updatedAt: null,
        confidence: 0,
      },

      inspector: {
        kind: 'PLACEHOLDER',
        source: 'hardcoded values in view-model (no per-node runtime data)',
        updatedAt: null,
        confidence: 0,
      },

      events: {
        kind: areEventsLive ? 'LIVE' : 'PLACEHOLDER',
        source: areEventsLive ? 'ledger.events via /api/events + /api/stream SSE' : 'demo fallback array',
        updatedAt: areEventsLive ? lastSync : null,
        confidence: areEventsLive ? 1 : 0,
      },

      terminal: {
        kind: 'PLACEHOLDER',
        source: 'hardcoded template (no runtime logs)',
        updatedAt: null,
        confidence: 0,
      },

      health: {
        kind: 'PLACEHOLDER',
        source: 'hardcoded values (no runtime health metrics)',
        updatedAt: null,
        confidence: 0,
      },

      connected: {
        kind: 'LIVE',
        source: 'EventSource /api/stream connection state',
        updatedAt: lastSync,
        confidence: 1,
      },

      lastSync: {
        kind: 'LIVE',
        source: 'latest event timestamp from ledger',
        updatedAt: lastSync,
        confidence: 1,
      },
    },
  }
}

export { FLOW, CONNECTIONS, DEFAULT_SELECTED_NODE_ID }
