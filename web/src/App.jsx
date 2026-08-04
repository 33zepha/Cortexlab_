import { useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import { useLedger, useNow } from './lib/ledger.js'
import { buildDashboardViewModel, DEFAULT_SELECTED_NODE_ID } from './lib/dashboard-view-model.js'
import MissionHeader from './components/dashboard/MissionHeader.jsx'
import MissionTabs from './components/dashboard/MissionTabs.jsx'
import MissionSummary from './components/dashboard/MissionSummary.jsx'
import ExecutionCanvas from './components/dashboard/ExecutionCanvas.jsx'
import BottomDock from './components/dashboard/BottomDock.jsx'
import ProcessInspector from './components/dashboard/ProcessInspector.jsx'
import HealthPanel from './components/dashboard/HealthPanel.jsx'

export default function App() {
  const ledger = useLedger()
  const now = useNow()
  const [active, setActive] = useState('dashboard')
  const [selectedNodeId, setSelectedNodeId] = useState(DEFAULT_SELECTED_NODE_ID)

  const view = buildDashboardViewModel(ledger, now, selectedNodeId)

  return (
    <div className="app-shell reference-shell">
      <Sidebar active={active} onNavigate={setActive} />
      <main className="reference-app">
        <MissionHeader mission={view.mission} connected={view.connected} lastSync={view.lastSync} now={view.now} />
        <MissionTabs />
        <div className="reference-layout">
          <div className="reference-left-column">
            <MissionSummary summary={view.summary} />
          </div>
          <div className="reference-center-column">
            <ExecutionCanvas graph={view.graph} onSelect={(node) => setSelectedNodeId(node.id)} />
            <BottomDock events={view.events} now={view.now} terminal={view.terminal} />
          </div>
          <div className="reference-right-column">
            <ProcessInspector inspector={view.inspector} />
            <HealthPanel health={view.health} />
          </div>
        </div>
      </main>
    </div>
  )
}
