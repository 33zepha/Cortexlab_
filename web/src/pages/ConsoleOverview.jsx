import { useState } from 'react'
import Topbar from '../components/Topbar.jsx'
import MissionTable from '../components/MissionTable.jsx'
import AgentTable from '../components/AgentTable.jsx'
import LiveActivity from '../components/LiveActivity.jsx'
import { relativeTime } from '../lib/ledger.js'

function KpiTile({ label, value, sub, progress }) {
  const display = value == null ? '—' : value
  return (
    <div className="kpi-card">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{display}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
      {progress != null && (
        <span className="kpi-progress"><i style={{ width: `${progress}%` }} /></span>
      )}
    </div>
  )
}

export default function ConsoleOverview({ view, onOpenMission, onMenu }) {
  const [query, setQuery] = useState('')
  const [attentionOnly, setAttentionOnly] = useState(false)

  const { connected, lastSync, now, agents, events, missions, hasMissions, kpis } = view

  return (
    <>
      <Topbar
        connected={connected}
        lastSync={lastSync}
        now={now}
        query={query}
        onQueryChange={setQuery}
        attentionOnly={attentionOnly}
        onToggleFilters={() => setAttentionOnly((value) => !value)}
        onMenu={onMenu}
      />

      <div className="dashboard-canvas">
        <div className="kpi-grid">
          <KpiTile label="Managers actifs" value={kpis.activeManagers.value} sub={kpis.activeManagers.sub} />
          <KpiTile label="Missions (24h)" value={kpis.missionsRecent.value} sub={kpis.missionsRecent.sub} />
          <KpiTile label="Clôtures autonomes" value={kpis.autonomousClosures.value} sub={kpis.autonomousClosures.sub} />
          <KpiTile
            label="Dernière activité"
            value={kpis.lastActivity.value ? relativeTime(kpis.lastActivity.value, now).replace('il y a ', '') : null}
          />
          <KpiTile
            label="Coût"
            value={kpis.budget.cost ? `${kpis.budget.cost} / ${kpis.budget.limit || '—'}` : null}
            progress={kpis.budget.percent}
          />
        </div>

        <div className="workspace-grid">
          <div className="workspace-primary">
            {hasMissions ? (
              <MissionTable
                missions={missions}
                now={now}
                query={query}
                attentionOnly={attentionOnly}
                onSelect={onOpenMission}
              />
            ) : (
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Missions</h2>
                    <p>Progression, budget, preuves et dernier événement.</p>
                  </div>
                </div>
                <div className="empty-cell" style={{ height: 140 }}>Aucune mission dans le ledger pour le moment.</div>
              </section>
            )}
            <AgentTable agents={agents} events={events} missions={missions} now={now} globalQuery={query} />
          </div>
          <div className="activity-column">
            <LiveActivity events={events} now={now} connected={connected} />
          </div>
        </div>
      </div>
    </>
  )
}
