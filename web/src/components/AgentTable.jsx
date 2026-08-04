import { useMemo, useState } from 'react'
import Icon from './Icon.jsx'
import { agentActivity, relativeTime } from '../lib/ledger.js'

function percent(value) {
  if (!Number.isFinite(Number(value))) return 0
  const normalized = Number(value) <= 1 ? Number(value) * 100 : Number(value)
  return Math.max(0, Math.min(100, Math.round(normalized)))
}

function currentMissionFor(agentId, missions) {
  return missions.find((mission) => mission.agents?.some((agent) => agent.id === agentId)) || null
}

export default function AgentTable({ agents, events, missions, now, globalQuery = '' }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const effectiveQuery = `${globalQuery} ${query}`.trim().toLocaleLowerCase('fr-FR')

  const rows = useMemo(() => agents.map((agent) => ({
    agent,
    activity: agentActivity(agent.id, events),
    mission: currentMissionFor(agent.id, missions),
  })), [agents, events, missions])

  const visible = rows.filter(({ agent, activity, mission }) => {
    const active = activity.running || agent.status === 'active'
    if (filter === 'active' && !active) return false
    if (filter === 'paused' && active) return false
    if (!effectiveQuery) return true
    return [agent.name, agent.role, agent.model, agent.provider, mission?.name]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('fr-FR')
      .includes(effectiveQuery)
  })

  return (
    <section className="panel agents-panel">
      <div className="panel-heading agent-heading">
        <div>
          <h2>Agents</h2>
          <p>Travail en cours, coût, qualité et dernière preuve.</p>
        </div>
        <div className="agent-tools">
          <label className="inline-search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un agent…"
              aria-label="Rechercher un agent"
            />
          </label>
          <div className="segmented-control" aria-label="Filtrer les agents">
            {[
              ['all', 'Tous'],
              ['active', 'Actifs'],
              ['paused', 'En pause'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={filter === id ? 'is-active' : ''}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="table-viewport">
        <table className="data-table agent-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Rôle</th>
              <th>Modèle</th>
              <th>Statut</th>
              <th>Mission actuelle</th>
              <th>Coût</th>
              <th>Qualité</th>
              <th>Dernier événement</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan="8" className="empty-cell">Aucun agent ne correspond aux filtres.</td></tr>
            ) : visible.map(({ agent, activity, mission }) => {
              const quality = percent(agent.quality_index)
              const active = activity.running || agent.status === 'active'
              const lastEvent = activity.lastResult
              return (
                <tr key={agent.id}>
                  <td>
                    <div className="agent-identity-cell">
                      <span className={`agent-avatar avatar-${agent.name?.toLowerCase()}`}>{agent.name?.slice(0, 1) || 'A'}</span>
                      <span><strong>{agent.name}</strong><small>{agent.id}</small></span>
                    </div>
                  </td>
                  <td><span className="role-cell">{agent.role || '—'}</span></td>
                  <td>
                    <div className="model-cell"><strong>{agent.model || '—'}</strong><small>{agent.provider || '—'}</small></div>
                  </td>
                  <td>
                    <span className={`status-pill ${active ? 'status-success' : 'status-neutral'}`}>
                      {activity.running ? 'En cours' : active ? 'Actif' : 'Inactif'}<i aria-hidden="true" />
                    </span>
                  </td>
                  <td>
                    <div className="mission-agent-cell">
                      <strong>{mission?.name || '—'}</strong>
                      <small>{activity.rule || (mission ? `${mission.phase} · ${mission.progress}%` : 'Disponible')}</small>
                    </div>
                  </td>
                  <td><strong className="mono-number">{activity.cost.toFixed(2).replace('.', ',')}</strong></td>
                  <td>
                    <div className="quality-cell">
                      <strong>{quality}%</strong>
                      <span className="mini-progress"><i style={{ width: `${quality}%` }} /></span>
                    </div>
                  </td>
                  <td>
                    <div className="event-cell">
                      <strong>{lastEvent ? (lastEvent.violation ? 'violation' : 'check_passed') : activity.running ? 'task_started' : 'idle'}</strong>
                      <small>{relativeTime(lastEvent?.ts || activity.since, now)}</small>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="panel-footer-count">{visible.length} agent{visible.length > 1 ? 's' : ''}</div>
    </section>
  )
}
