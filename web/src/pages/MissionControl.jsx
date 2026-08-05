import { useMemo, useState } from 'react'
import { buildDashboardViewModel, DEFAULT_SELECTED_NODE_ID } from '../lib/dashboard-view-model.js'
import { scopeEventsToMission, scopeAgentsToMission } from '../lib/mission-scope.js'
import Icon from '../components/Icon.jsx'
import MissionHeader from '../components/dashboard/MissionHeader.jsx'
import MissionTabs from '../components/dashboard/MissionTabs.jsx'
import MissionSummary from '../components/dashboard/MissionSummary.jsx'
import ExecutionCanvas from '../components/dashboard/ExecutionCanvas.jsx'
import ExecutionTimeline from '../components/dashboard/ExecutionTimeline.jsx'
import BottomDock from '../components/dashboard/BottomDock.jsx'
import ProcessInspector from '../components/dashboard/ProcessInspector.jsx'
import HealthPanel from '../components/dashboard/HealthPanel.jsx'

export default function MissionControl({ missionId, ledger, now, onBack, onMenu }) {
  const [selectedNodeId, setSelectedNodeId] = useState(DEFAULT_SELECTED_NODE_ID)
  const [inspectorOpen, setInspectorOpen] = useState(false)

  const hasLedgerMissions = ledger.missions && ledger.missions.length > 0
  const matchedMission = hasLedgerMissions ? ledger.missions.find((m) => m.id === missionId) : null
  const missionNotFound = hasLedgerMissions && missionId && !matchedMission

  // Filter to the requested mission so buildDashboardViewModel (unchanged)
  // selects it as the active mission, instead of picking the first running one.
  // Events and agents are scoped the same way so the page never leaks another
  // mission's activity or roster.
  const scopedLedger = useMemo(() => ({
    ...ledger,
    missions: matchedMission ? [matchedMission] : ledger.missions,
    events: matchedMission ? scopeEventsToMission(ledger.events, matchedMission) : ledger.events,
    agents: matchedMission ? scopeAgentsToMission(ledger.agents, matchedMission) : ledger.agents,
  }), [ledger, matchedMission])

  const view = buildDashboardViewModel(scopedLedger, now, selectedNodeId)

  const selectNode = (node) => {
    setSelectedNodeId(node.id)
    setInspectorOpen(true)
  }

  return (
    <div className="reference-app">
      <div className="mission-breadcrumb">
        <button type="button" className="topbar-menu mission-breadcrumb-menu" onClick={onMenu} aria-label="Ouvrir la navigation">
          <Icon name="menu" />
        </button>
        <button type="button" className="mission-breadcrumb-back" onClick={onBack}>
          <Icon name="chevron-left" />
          Console
        </button>
        <span className="mission-breadcrumb-sep">/</span>
        <span className="mission-breadcrumb-current">{view.mission?.name || view.mission?.mission || 'Mission'}</span>
      </div>

      {missionNotFound && (
        <div className="error-banner">Mission introuvable dans le ledger actuel — affichage de repli.</div>
      )}

      <MissionHeader mission={view.mission} connected={view.connected} lastSync={view.lastSync} now={view.now} />
      <MissionTabs />
      <div className="reference-layout">
        <div className="reference-left-column">
          <MissionSummary summary={view.summary} />
        </div>
        <div className="reference-center-column">
          <ExecutionCanvas graph={view.graph} onSelect={selectNode} />
          <ExecutionTimeline graph={view.graph} onSelect={selectNode} />
          <BottomDock events={view.events} now={view.now} terminal={view.terminal} />
        </div>
        {inspectorOpen && (
          <div className="inspector-backdrop" onClick={() => setInspectorOpen(false)} aria-hidden="true" />
        )}
        <div className={`reference-right-column ${inspectorOpen ? 'is-open' : ''}`}>
          <ProcessInspector inspector={view.inspector} onClose={() => setInspectorOpen(false)} />
          <HealthPanel health={view.health} />
        </div>
      </div>
    </div>
  )
}
