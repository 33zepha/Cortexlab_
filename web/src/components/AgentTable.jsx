import { useMemo, useState } from 'react'
import Icon from './Icon.jsx'
import { agentActivity, relativeTime } from '../lib/ledger.js'

const PHASE_LABELS = {
  starting: 'Initialisation',
  delegating: 'Délégation',
  executing: 'Exécution',
  checking: 'Vérification',
  budget: 'Budget',
  closed: 'Terminée',
}

const STATUS = {
  running: { label: 'En cours', tone: 'success' },
  online: { label: 'En ligne', tone: 'success' },
  available: { label: 'Disponible', tone: 'warning' },
  offline: { label: 'Hors ligne', tone: 'neutral' },
  active: { label: 'En ligne', tone: 'success' },
}

function percent(value) {
  if (!Number.isFinite(Number(value))) return 0
  const normalized = Number(value) <= 1 ? Number(value) * 100 : Number(value)
  return Math.max(0, Math.min(100, Math.round(normalized)))
}

function currentMissionFor(agent, missions) {
  if (agent.current_mission_id) {
    const direct = missions.find((mission) => mission.id === agent.current_mission_id)
    if (direct) return direct
  }
  return missions.find((mission) => (
    mission.manager?.id === agent.id
    || mission.manager?.name === agent.name
    || mission.agents?.some((item) => item.id === agent.id || item.name === agent.name)
  )) || null
}

function runtimeStatus(agent, activity) {
  if (activity.running) return 'running'
  return agent.runtime_status || (agent.status === 'active' ? 'online' : 'offline')
}

function lastEventLabel(activity, status) {
  if (activity.lastResult?.violation) return 'Violation détectée'
  if (activity.lastResult) return 'Contrôle validé'
  if (activity.running) return 'Tâche lancée'
  if (status === 'online') return 'Présence détectée'
  if (status === 'available') return 'Configuré, sans activité récente'
  return 'Aucune présence détectée'
}

export default function AgentTable({ agents, events, missions, now, globalQuery = '' }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const effectiveQuery = `${globalQuery} ${query}`.trim().toLocaleLowerCase('fr-FR')

  const rows = useMemo(() => agents.map((agent) => {
    const activity = agentActivity(agent.id, events)
    return {
      agent,
      activity,
      status: runtimeStatus(agent, activity),
      mission: currentMissionFor(agent, missions),
    }
  }), [agents, events, missions])

  const visible = rows.filter(({ agent, status, mission }) => {
    const live = ['running', 'online'].includes(status)
    if (filter === 'live' && !live) return false
    if (filter === 'offline' && status !== 'offline') return false
    if (!effectiveQuery) return true
    return [agent.name, agent.role, agent.model, agent.provider, mission?.name, status]
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
          <p>Présence runtime, mission courante, coût et dernière preuve observée.</p>
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
              ['live', 'En ligne'],
              ['offline', 'Hors ligne'],
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
              <th>Statut réel</th>
              <th>Mission actuelle</th>
              <th>Coût</th>
              <th>Qualité</th>
              <th>Dernière présence</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan="8" className="empty-cell">Aucun agent ne correspond aux filtres.</td></tr>
            ) : visible.map(({ agent, activity, mission, status }) => {
              const quality = percent(agent.quality_index)
              const statusMeta = STATUS[status] || STATUS.offline
              const lastEvent = activity.lastResult
              const seenAt = lastEvent?.ts || activity.since || agent.last_seen_at
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
                    <span className={`status-pill status-${statusMeta.tone}`}>
                      {statusMeta.label}<i aria-hidden="true" />
                    </span>
                  </td>
                  <td>
                    <div className="mission-agent-cell">
                      <strong>{mission?.name || '—'}</strong>
                      <small>{activity.rule || (mission ? `${PHASE_LABELS[mission.phase] || 'En cours'} · ${mission.progress}%` : 'Aucune mission détectée')}</small>
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
                      <strong>{lastEventLabel(activity, status)}</strong>
                      <small>{relativeTime(seenAt, now)}</small>
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
