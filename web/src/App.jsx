import { useMemo, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import MissionTable from './components/MissionTable.jsx'
import AgentTable from './components/AgentTable.jsx'
import LiveActivity from './components/LiveActivity.jsx'
import { relativeTime, useLedger, useNow } from './lib/ledger.js'

function formatNumber(value, digits = 2) {
  return Number(value || 0).toFixed(digits).replace('.', ',')
}

function KpiCard({ label, value, sub, delta, progress }) {
  return (
    <article className="kpi-card">
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {delta && <span className="kpi-delta">▲ {delta}</span>}
      {sub && <span className="kpi-sub">{sub}</span>}
      {progress != null && (
        <span className="kpi-progress"><i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></span>
      )}
    </article>
  )
}

export default function App() {
  const {
    agents,
    events,
    missions,
    summary,
    connected,
    lastSync,
    runMission,
    demo,
  } = useLedger()
  const now = useNow()
  const [active, setActive] = useState('dashboard')
  const [query, setQuery] = useState('')
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)

  const activeManagers = useMemo(
    () => agents.filter((agent) => agent.tier === 'manager' && agent.status === 'active').length,
    [agents]
  )
  const missions24h = useMemo(() => {
    const limit = now - 24 * 60 * 60 * 1000
    return missions.filter((mission) => new Date(mission.started_at).getTime() >= limit).length
  }, [missions, now])
  const budgetPct = summary.budget_limit > 0
    ? Math.round((summary.budget_cost / summary.budget_limit) * 100)
    : 0

  const handleRunMission = async () => {
    setRunning(true)
    setError(null)
    try {
      await runMission()
    } catch (runError) {
      setError(runError.message)
    } finally {
      setRunning(false)
    }
  }

  const handleNavigate = (destination) => {
    setActive(destination)
    const target = destination === 'dashboard'
      ? document.getElementById('dashboard')
      : document.getElementById(destination)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="app-shell">
      <Sidebar active={active} onNavigate={handleNavigate} />

      <div className="app-main">
        <Topbar
          connected={connected}
          lastSync={lastSync}
          now={now}
          query={query}
          onQueryChange={setQuery}
          attentionOnly={attentionOnly}
          onToggleFilters={() => setAttentionOnly((value) => !value)}
          onRunMission={handleRunMission}
          running={running}
        />

        <main className="dashboard-canvas" id="dashboard">
          {error && <div className="error-banner">La mission a échoué : {error}</div>}
          {demo && <div className="demo-chip">Jeu de données de démonstration</div>}

          <section className="kpi-grid" aria-label="Indicateurs clés">
            <KpiCard
              label="Managers actifs"
              value={activeManagers}
              delta="20% par rapport à hier"
            />
            <KpiCard
              label="Missions sur 24 h"
              value={missions24h || summary.total || 0}
              delta="67% par rapport à hier"
            />
            <KpiCard
              label="Closures autonomes"
              value={summary.autonomous || 0}
              sub={summary.total ? `${Math.round(((summary.autonomous || 0) / summary.total) * 100)}% du total` : 'Aucune closure'}
            />
            <KpiCard
              label="Dernière activité"
              value={lastSync ? relativeTime(lastSync, now).replace('il y a ', '') : '—'}
              sub={events.at(-1)?.data?.name ? `${events.at(-1).data.name} · résultat agent` : 'Aucun événement'}
            />
            <KpiCard
              label="Coût aujourd’hui"
              value={`${formatNumber(summary.budget_cost)} u`}
              sub={`${budgetPct}% du budget (${formatNumber(summary.budget_limit)} u)`}
              progress={budgetPct}
            />
          </section>

          <div className="workspace-grid">
            <div className="workspace-primary">
              <div id="missions" className="anchor-section">
                <MissionTable
                  missions={missions}
                  now={now}
                  query={query}
                  attentionOnly={attentionOnly}
                />
              </div>
              <div id="agents" className="anchor-section">
                <AgentTable
                  agents={agents}
                  events={events}
                  missions={missions}
                  now={now}
                  globalQuery={query}
                />
              </div>
            </div>

            <div id="activity" className="anchor-section activity-column">
              <LiveActivity events={events} now={now} connected={connected} />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
