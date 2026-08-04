import { useMemo, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import SystemHealth from './components/SystemHealth.jsx'
import MissionTable from './components/MissionTable.jsx'
import MissionInspector from './components/MissionInspector.jsx'
import AgentTable from './components/AgentTable.jsx'
import AgentInspector from './components/AgentInspector.jsx'
import LiveActivity from './components/LiveActivity.jsx'
import EventExplorer from './components/EventExplorer.jsx'
import { relativeTime, useLedger, useNow } from './lib/ledger.js'

function queryValue(name) {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(name)
}

function formatNumber(value, digits = 2) {
  return Number(value || 0).toFixed(digits).replace('.', ',')
}

function KpiCard({ label, value, sub, progress }) {
  return (
    <article className="kpi-card">
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
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
    system,
    connected,
    lastSync,
    demo,
  } = useLedger()
  const now = useNow()
  const [active, setActive] = useState('dashboard')
  const [query, setQuery] = useState('')
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [selectedMissionId, setSelectedMissionId] = useState(() => queryValue('mission'))
  const [selectedAgentId, setSelectedAgentId] = useState(() => queryValue('agent'))
  const [ledgerOpen, setLedgerOpen] = useState(() => queryValue('ledger') === '1')

  const managers = useMemo(
    () => agents.filter((agent) => agent.tier === 'manager'),
    [agents]
  )
  const activeManagers = useMemo(
    () => managers.filter((agent) => ['running', 'online', 'active'].includes(agent.runtime_status || agent.status)).length,
    [managers]
  )
  const selectedMission = useMemo(
    () => missions.find((mission) => mission.id === selectedMissionId) || null,
    [missions, selectedMissionId]
  )
  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) || null,
    [agents, selectedAgentId]
  )
  const missions24h = useMemo(() => {
    const limit = now - 24 * 60 * 60 * 1000
    return missions.filter((mission) => new Date(mission.started_at).getTime() >= limit).length
  }, [missions, now])
  const budgetPct = summary.budget_limit > 0
    ? Math.round((summary.budget_cost / summary.budget_limit) * 100)
    : 0
  const availableSources = (system.sources || []).filter((source) => source.available).length
  const totalSources = (system.sources || []).length
  const latestEvent = events.at(-1)

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
          hermesOnline={Boolean(system.hermes?.online)}
          streamConnected={connected}
          hermesUrl={system.hermes?.url || null}
          lastSync={lastSync}
          now={now}
          query={query}
          onQueryChange={setQuery}
          attentionOnly={attentionOnly}
          onToggleFilters={() => setAttentionOnly((value) => !value)}
        />

        <main className="dashboard-canvas" id="dashboard">
          {demo && <div className="demo-chip">Jeu de données de démonstration</div>}

          <section className="kpi-grid" aria-label="Indicateurs clés">
            <KpiCard
              label="Managers observés"
              value={activeManagers}
              sub={`${managers.length} configurés · ${availableSources}/${totalSources || 0} sources disponibles`}
            />
            <KpiCard
              label="Missions sur 24 h"
              value={missions24h}
              sub={`${summary.running || 0} en cours · ${summary.needs_attention || 0} à surveiller`}
            />
            <KpiCard
              label="Closures autonomes"
              value={summary.autonomous || 0}
              sub={summary.total ? `${Math.round(((summary.autonomous || 0) / summary.total) * 100)}% des missions observées` : 'Aucune mission observée'}
            />
            <KpiCard
              label="Dernière activité"
              value={lastSync ? relativeTime(lastSync, now).replace('il y a ', '') : '—'}
              sub={latestEvent?.type || 'Aucun événement reçu'}
            />
            <KpiCard
              label="Coût observé"
              value={`${formatNumber(summary.budget_cost)} u`}
              sub={summary.budget_limit > 0 ? `${budgetPct}% des budgets déclarés (${formatNumber(summary.budget_limit)} u)` : 'Aucun budget déclaré'}
              progress={summary.budget_limit > 0 ? budgetPct : null}
            />
          </section>

          <div id="system" className="anchor-section system-anchor">
            <SystemHealth system={system} streamConnected={connected} now={now} />
          </div>

          <div className="workspace-grid">
            <div className="workspace-primary">
              <div id="missions" className="anchor-section">
                <MissionTable
                  missions={missions}
                  now={now}
                  query={query}
                  attentionOnly={attentionOnly}
                  selectedMissionId={selectedMissionId}
                  onSelectMission={(mission) => {
                    setSelectedAgentId(null)
                    setSelectedMissionId(mission.id)
                  }}
                />
              </div>
              <div id="agents" className="anchor-section">
                <AgentTable
                  agents={agents}
                  events={events}
                  missions={missions}
                  now={now}
                  globalQuery={query}
                  selectedAgentId={selectedAgentId}
                  onSelectAgent={(agent) => {
                    setSelectedMissionId(null)
                    setSelectedAgentId(agent.id)
                  }}
                />
              </div>
            </div>

            <div id="activity" className="anchor-section activity-column">
              <LiveActivity
                events={events}
                now={now}
                connected={connected}
                onOpenLedger={() => setLedgerOpen(true)}
              />
            </div>
          </div>
        </main>
      </div>

      <MissionInspector
        mission={selectedMission}
        now={now}
        onClose={() => setSelectedMissionId(null)}
      />
      <AgentInspector
        agent={selectedAgent}
        events={events}
        missions={missions}
        system={system}
        now={now}
        onClose={() => setSelectedAgentId(null)}
      />
      <EventExplorer
        open={ledgerOpen}
        events={events}
        now={now}
        onClose={() => setLedgerOpen(false)}
      />
    </div>
  )
}
