import { useMemo, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import { useLedger, useNow } from './lib/ledger.js'
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
  const [selected, setSelected] = useState(null)

  const mission = ledger.missions.find((m) => /running|active/i.test(m.status || '')) || ledger.missions[0]
  const activeAgents = useMemo(() => ledger.agents.filter((a) => /active|running/i.test(a.status || '')).length, [ledger.agents])
  const progress = Math.max(0, Math.min(100, Number(mission?.progress) || 62))

  return (
    <div className="app-shell reference-shell">
      <Sidebar active={active} onNavigate={setActive} />
      <main className="reference-app">
        <MissionHeader mission={mission} connected={ledger.connected} lastSync={ledger.lastSync} now={now} />
        <MissionTabs />
        <div className="reference-layout">
          <div className="reference-left-column">
            <MissionSummary mission={mission} summary={ledger.summary} progress={progress} agents={ledger.agents} />
          </div>
          <div className="reference-center-column">
            <ExecutionCanvas selected={selected} onSelect={setSelected} activeAgents={activeAgents} />
            <BottomDock events={ledger.events} now={now} />
          </div>
          <div className="reference-right-column">
            <ProcessInspector selected={selected} />
            <HealthPanel />
          </div>
        </div>
      </main>
    </div>
  )
}
