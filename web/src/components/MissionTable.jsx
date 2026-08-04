import Icon from './Icon.jsx'
import { relativeTime } from '../lib/ledger.js'

const STATUS = {
  running: { label: 'Running', tone: 'success' },
  autonomous: { label: 'Autonome', tone: 'success' },
  information: { label: 'Information', tone: 'warning' },
  escalated: { label: 'Attention', tone: 'error' },
  incomplete: { label: 'Incomplète', tone: 'warning' },
  closed: { label: 'Fermée', tone: 'neutral' },
}

const PHASE = {
  starting: 'Initialisation',
  delegating: 'Délégation',
  executing: 'Exécution',
  checking: 'Vérification',
  budget: 'Budget',
  closed: 'Terminé',
  unknown: 'En cours',
}

function formatDuration(ms, startedAt, now) {
  const duration = ms ?? Math.max(0, now - new Date(startedAt).getTime())
  if (!Number.isFinite(duration)) return '—'
  const seconds = Math.floor(duration / 1000)
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}m ${String(rest).padStart(2, '0')}s`
}

function formatCost(value) {
  return Number.isFinite(value) ? value.toFixed(2).replace('.', ',') : '0,00'
}

function ManagerCell({ manager }) {
  if (!manager) return <span className="muted-cell">Non assigné</span>
  const initials = manager.name?.slice(0, 1).toUpperCase() || 'A'
  return (
    <div className="manager-cell">
      <span className="agent-avatar agent-avatar-small">{initials}</span>
      <span>
        <strong>{manager.name}</strong>
        <small>{manager.model || manager.id}</small>
      </span>
    </div>
  )
}

function CheckStack({ checks }) {
  return (
    <div className="check-stack" aria-label="Résultat des checks">
      <span><b>{checks?.passed || 0}</b><Icon name="check" className="micro-icon success-text" /></span>
      <span><b>{checks?.violations || 0}</b><Icon name="close" className="micro-icon error-text" /></span>
      <span><b>{checks?.findings || 0}</b><Icon name="alert" className="micro-icon warning-text" /></span>
    </div>
  )
}

export default function MissionTable({ missions, now, query = '', attentionOnly = false }) {
  const normalized = query.trim().toLocaleLowerCase('fr-FR')
  const visible = missions.filter((mission) => {
    if (attentionOnly && !['running', 'escalated', 'incomplete'].includes(mission.status)) return false
    if (!normalized) return true
    const text = [
      mission.name,
      mission.id,
      mission.domain,
      mission.manager?.name,
      mission.manager?.model,
      mission.latest_event?.type,
    ].filter(Boolean).join(' ').toLocaleLowerCase('fr-FR')
    return text.includes(normalized)
  })

  return (
    <section className="panel missions-panel">
      <div className="panel-heading">
        <div>
          <h2>Missions actives</h2>
          <p>Progression, budget, preuves et dernier événement.</p>
        </div>
        <button className="quiet-button" type="button">Voir toutes</button>
      </div>

      <div className="table-viewport">
        <table className="data-table mission-table">
          <thead>
            <tr>
              <th>Mission</th>
              <th>Manager</th>
              <th>Statut</th>
              <th>Progression</th>
              <th>Budget</th>
              <th>Checks</th>
              <th>Dernier événement</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan="7" className="empty-cell">Aucune mission ne correspond à cette vue.</td></tr>
            ) : visible.map((mission) => {
              const status = STATUS[mission.status] || STATUS.closed
              const budget = mission.budget || { cost: 0, limits: {}, percentage: null }
              return (
                <tr key={mission.id}>
                  <td>
                    <div className="primary-cell mission-name-cell">
                      <strong>{mission.name}</strong>
                      <small>#{mission.id}</small>
                      <span>{mission.domain || 'Mission Cortex'}</span>
                    </div>
                  </td>
                  <td><ManagerCell manager={mission.manager} /></td>
                  <td>
                    <div className="status-cell">
                      <span className={`status-pill status-${status.tone}`}>
                        {status.label}<i aria-hidden="true" />
                      </span>
                      <small>{PHASE[mission.phase] || PHASE.unknown}</small>
                      <span>{formatDuration(mission.duration_ms, mission.started_at, now)}</span>
                    </div>
                  </td>
                  <td>
                    <div className="progress-cell">
                      <strong>{mission.progress ?? 0}%</strong>
                      <span className="progress-track"><i style={{ width: `${mission.progress ?? 0}%` }} /></span>
                    </div>
                  </td>
                  <td>
                    <div className="budget-cell">
                      <strong>{formatCost(budget.cost)}</strong>
                      <small>/ {formatCost(budget.limits?.maxCost || 0)}</small>
                      <span>{budget.percentage == null ? '—' : `${budget.percentage}%`}</span>
                    </div>
                  </td>
                  <td><CheckStack checks={mission.checks} /></td>
                  <td>
                    <div className="event-cell">
                      <strong>{mission.latest_event?.type || '—'}</strong>
                      <small>{relativeTime(mission.latest_event?.ts, now)}</small>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
