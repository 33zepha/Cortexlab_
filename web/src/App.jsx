import { useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import KpiCard from './components/KpiCard.jsx'
import AgentCard from './components/AgentCard.jsx'
import AgentDrawer from './components/AgentDrawer.jsx'
import { useLedger } from './lib/ledger.js'

export default function App() {
  const { agents, events, kpis, runMission } = useLedger()
  const [selectedAgentId, setSelectedAgentId] = useState(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || null

  const handleRunMission = async () => {
    setRunning(true)
    setError(null)
    try {
      await runMission()
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar active="Dashboard" />

      <div className="flex flex-1 flex-col">
        <Topbar title="Console" onRunMission={handleRunMission} running={running} />

        <main className="flex flex-1 flex-col gap-6 p-6">
          {error && (
            <div className="rounded-sm bg-error-bg px-4 py-2 text-sm text-error">
              Échec Run Mission : {error}
            </div>
          )}

          <section className="grid grid-cols-4 gap-4" aria-label="Indicateurs clés">
            <KpiCard label="Active Managers" value={kpis.managers} />
            <KpiCard label="Missions (24h)" value={kpis.missions24h} />
            <KpiCard label="Closures autonomes" value={kpis.closuresAuto} />
            <KpiCard label="Dernier run" value={kpis.lastRun} />
          </section>

          <section aria-label="Agents">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Agents</h2>
              <span className="text-sm text-text-muted">{agents.length} enregistré(s)</span>
            </div>
            {agents.length === 0 ? (
              <p className="text-sm text-text-muted">Aucun agent enregistré.</p>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onClick={() => setSelectedAgentId(agent.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      <AgentDrawer
        agent={selectedAgent}
        events={events}
        onClose={() => setSelectedAgentId(null)}
      />
    </div>
  )
}
