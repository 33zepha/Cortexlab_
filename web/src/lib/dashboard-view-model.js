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
  const hasLedgerData = ledgerData != null
  const { agents = [], events = [], missions = [], summary = {}, connected, lastSync } = ledgerData || {}

  // Determine provenance for each section
  const isMissionLive = missions && missions.length > 0
  // /api/missions returns missions reverse-chronological (most recent first).
  // Prefer a genuinely in-progress mission (status running/active); otherwise
  // fall back to the most recent real mission — never a fabricated one.
  const activeMission = missions.find((m) => /running|active/i.test(m.status || '')) || missions[0] || null

  const hasNumericProgress = typeof activeMission?.progress === 'number'

  const isBudgetCostLive = summary && summary.budget_cost != null
  const isBudgetLimitLive = summary && summary.budget_limit != null
  const isBudgetCompleteLive = isBudgetCostLive && isBudgetLimitLive
  const isBudgetLimitZero = isBudgetLimitLive && summary.budget_limit === 0

  const areEventsLive = events && events.length > 0
  const areAgentsLive = agents && agents.length > 0

  const isConnectedLive = hasLedgerData && Object.prototype.hasOwnProperty.call(ledgerData, 'connected')
  const isLastSyncLive = lastSync != null

  // LIVE: mission selection from ledger, undefined when no mission (Phase 1 behavior)
  const mission = activeMission

  // LIVE: active agent count from ledger
  const activeAgentCount = agents.filter((a) => /active|running/i.test(a.status || '')).length

  // LIVE if mission has a numeric progress, PLACEHOLDER fallback (Phase 1 value: 62)
  const progress = clamp(hasNumericProgress ? activeMission.progress : 62)

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

  // LIVE or PLACEHOLDER: budget from backend or Phase 1 fallback values
  const budgetCost = isBudgetCostLive ? summary.budget_cost : 12.45
  const budgetLimit = isBudgetLimitLive ? summary.budget_limit : 25
  // No division when the live limit is explicitly zero; percent is a visual fallback in that case.
  const budgetPct = isBudgetLimitZero
    ? 0
    : budgetLimit > 0
      ? clamp((budgetCost / budgetLimit) * 100)
      : 49

  return {
    // Mission context (LIVE via useLedger/useNow); undefined when no mission (Phase 1 behavior)
    mission,
    connected,
    lastSync,
    now,

    // Summary rail — scoped to the active mission. `agents` here is already the
  // mission-scoped roster (see MissionControl scopedLedger), so the active agent
  // slot never leaks another mission's roster.
    summary: {
      mission,
      progress, // LIVE if mission has numeric progress, PLACEHOLDER fallback otherwise
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
      activeAgent: agents[0] || (mission && (mission.agents?.[0] || { name: mission.name || 'Hermes', role: 'Chief of Staff' })) || { name: 'Hermes', role: 'Chief of Staff' },
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
    // until the backend exposes real per-node execution data. The agent label
    // is derived from the mission-scoped roster (already filtered above) so it
    // never shows another mission's agent.
    inspector: {
      item: selectedNode,
      state: 'running', // PLACEHOLDER
      progress: 80, // PLACEHOLDER
      duration: '1h 24m 17s', // PLACEHOLDER
      cost: '€0.18', // PLACEHOLDER
      tokens: '243,672', // PLACEHOLDER
      model: 'Claude 3.5 Sonnet', // PLACEHOLDER
      agent: agents.find((a) => a.id === selectedNode?.id || a.name === selectedNode?.label) || null,
      mandate: mission?.name
        ? `Mandat de la mission ${mission.name} (scoped to selected mission).`
        : 'Créer l\'interface utilisateur pour le tableau de bord RH en respectant le design system et les composants existants.', // PLACEHOLDER / scoped
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
      scopedMissionId: mission?.id || null,
    },

    // Events: LIVE from ledger, PLACEHOLDER fallback when empty
    events: areEventsLive ? events : [
      { ts: new Date().toISOString(), data: { agent: 'Frontend Agent' }, type: 'Démarrage de la génération des composants' },
      { ts: new Date().toISOString(), data: { agent: 'Planner' }, type: 'Mandat décomposé en 5 sous-tâches' },
      { ts: new Date().toISOString(), data: { agent: 'Hermes' }, type: 'Routage vers Frontend Agent (Claude 3.5 Sonnet)' },
      { ts: new Date().toISOString(), data: { agent: 'Researcher' }, type: 'Recherche utilisateur terminée' },
      { ts: new Date().toISOString(), data: { agent: 'Hermes' }, type: 'Mission démarrée par commande externe' },
    ],

    // Terminal output — DERIVED from the real active mission when one exists,
    // otherwise a plain "no mission" message. No fabricated mission data.
    terminal: isMissionLive
      ? `> cortex mission status ${activeMission.id}\n\nMission: ${activeMission.name || activeMission.mission || activeMission.id}\nDomain: ${activeMission.domain || '—'}\nStatus: ${activeMission.status || '—'}\nProgress: ${hasNumericProgress ? `${activeMission.progress}%` : '—'}\nActive Agents: ${activeAgentCount}\nBudget: ${isBudgetCompleteLive ? `€${formatNumber(budgetCost)} / €${formatNumber(budgetLimit)}` : '—'}\nManager: ${activeMission.manager?.name || '—'}\nStart Time: ${activeMission.started_at || '—'}\nLast Event: ${activeMission.latest_event?.ts || '—'}\n\n>`
      : `> cortex mission status\n\nNo active mission in the ledger.\n\n>`,

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
        kind: hasNumericProgress ? 'LIVE' : 'PLACEHOLDER',
        source: hasNumericProgress ? 'mission.progress from runtime' : 'fallback (62)',
        updatedAt: hasNumericProgress ? lastSync : null,
        confidence: hasNumericProgress ? 1 : 0,
      },

      'summary.budget.cost': {
        kind: isBudgetCostLive ? 'LIVE' : 'PLACEHOLDER',
        source: isBudgetCostLive ? 'ledger.summary.budget_cost via /api/missions' : 'fallback (12.45)',
        updatedAt: isBudgetCostLive ? lastSync : null,
        confidence: isBudgetCostLive ? 1 : 0,
      },

      'summary.budget.limit': {
        kind: isBudgetLimitLive ? 'LIVE' : 'PLACEHOLDER',
        source: isBudgetLimitLive ? 'ledger.summary.budget_limit via /api/missions' : 'fallback (25)',
        updatedAt: isBudgetLimitLive ? lastSync : null,
        confidence: isBudgetLimitLive ? 1 : 0,
      },

      'summary.budget.percent': isBudgetLimitZero
        ? {
            kind: 'PLACEHOLDER',
            source: 'visual fallback because live budget limit is zero',
            updatedAt: null,
            confidence: 0,
          }
        : isBudgetCompleteLive
          ? {
              kind: 'DERIVED',
              source: '(budget_cost / budget_limit) * 100, both LIVE',
              updatedAt: lastSync,
              confidence: 1,
            }
          : isBudgetCostLive || isBudgetLimitLive
            ? {
                kind: 'ESTIMATED',
                source: 'partial budget: only one of cost/limit is LIVE',
                updatedAt: lastSync,
                confidence: 0.5,
              }
            : {
                kind: 'PLACEHOLDER',
                source: 'fallback (49)',
                updatedAt: null,
                confidence: 0,
              },

      'summary.tokens': {
        kind: 'PLACEHOLDER',
        source: 'hardcoded (no runtime source yet)',
        updatedAt: null,
        confidence: 0,
      },

      'summary.activeAgent': {
        kind: areAgentsLive ? 'LIVE' : 'PLACEHOLDER',
        source: areAgentsLive ? 'ledger.agents[0] via /api/agents (already scoped to mission)' : 'fallback',
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
        source: 'hardcoded values in view-model (no per-node runtime data); agent label scoped to mission roster',
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
        kind: isMissionLive ? 'DERIVED' : 'PLACEHOLDER',
        source: isMissionLive ? 'formatted from ledger.missions[0] via /api/missions' : 'no active mission',
        updatedAt: isMissionLive ? lastSync : null,
        confidence: isMissionLive ? 1 : 0,
      },

      health: {
        kind: 'PLACEHOLDER',
        source: 'hardcoded values (no runtime health metrics)',
        updatedAt: null,
        confidence: 0,
      },

      connected: {
        kind: isConnectedLive ? 'LIVE' : 'PLACEHOLDER',
        source: isConnectedLive ? 'EventSource /api/stream connection state' : 'fallback (no ledgerData.connected key)',
        updatedAt: isConnectedLive ? lastSync ?? null : null,
        confidence: isConnectedLive ? 1 : 0,
      },

      lastSync: {
        kind: isLastSyncLive ? 'LIVE' : 'PLACEHOLDER',
        source: isLastSyncLive ? 'latest event timestamp from ledger' : 'fallback (no sync recorded)',
        updatedAt: isLastSyncLive ? lastSync : null,
        confidence: isLastSyncLive ? 1 : 0,
      },
    },
  }
}

export { FLOW, CONNECTIONS, DEFAULT_SELECTED_NODE_ID }
