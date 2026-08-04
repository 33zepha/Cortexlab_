import Icon from './Icon.jsx'
import { relativeTime } from '../lib/ledger.js'

const STATUS = {
  running: { label: 'En cours', tone: 'success' },
  autonomous: { label: 'Autonome', tone: 'success' },
  information: { label: 'Information', tone: 'warning' },
  escalated: { label: 'Attention', tone: 'error' },
  incomplete: { label: 'Incomplète', tone: 'warning' },
  closed: { label: 'Terminée', tone: 'neutral' },
  unknown: { label: 'Indéterminée', tone: 'neutral' },
}

const PHASE = {
  starting: 'Initialisation',
  delegating: 'Délégation',
  executing: 'Exécution',
  checking: 'Vérification',
  budget: 'Budget',
  closed: 'Terminée',
  unknown: 'État observé',
}

const EVENT_LABELS = {
  analysis_step_completed: 'Analyse terminée',
  approval_required: 'Validation requise',
  task_started: 'Tâche lancée',
  idle: 'Disponible',
  'mission.start': 'Mission lancée',
  'agent.assigned': 'Agent assigné',
  'agent.result': 'Résultat agent',
  'check.run': 'Contrôle exécuté',
  'budget.eval': 'Budget évalué',
  'mission.closure': 'Mission clôturée',
  'hermes.state.running': 'Session Hermes active',
  'hermes.state.closed': 'Session Hermes terminée',
  'hermes.state.incomplete': 'Session Hermes interrompue',
  'hermes.state.unknown': 'État Hermes détecté',
}

function formatDuration(ms, startedAt, now) {
  if (!startedAt && ms == null) return '—'
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
  if (!manager) return <span className="muted-cell">Non détecté</span>
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
    <div className="check-stack" aria-label="Résultat des contrôles">
      <span><b>{checks?.passed || 0}</b><Icon name="check" className="micro-icon success-text" /></span>
      <span><b>{checks?.violations || 0}</b><Icon name="close" className="micro-icon error-text" /></span>
      <span><b>{checks?.findings || 0}</b><Icon name="alert" className="micro-icon warning-text" /></span>
    </div>
  )
}

export default function MissionTable({
  missions,
  now,
  query = '',
  attentionOnly = false,
  selectedMissionId = null,
  onSelectMission = () => {},
}) {
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
      mission.source,
    ].filter(Boolean).join(' ').toLocaleLowerCase('fr-FR')
    return text.includes(normalized)
  })

  return (
    <section className="panel missions-panel">
      <div className="panel-heading">
        <div>
          <h2>Missions</h2>
          <p>Cliquer sur une ligne pour inspecter la chronologie et les preuves.</p>
        </div>
        <span className="panel-count">{visible.length} visible{visible.length > 1 ? 's' : ''}</span>
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
              <th>Contrôles</th>
              <th>Dernier événement</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan="7" className="empty-cell">Aucune mission ne correspond à cette vue.</td></tr>
            ) : visible.map((mission) => {
              const status = STATUS[mission.status] || STATUS.unknown
              const budget = mission.budget || { cost: 0, limits: {}, percentage: null }
              const rawEvent = mission.latest_event?.type || '—'
              return (
                <tr
                  key={mission.id}
                  className={`mission-row ${selectedMissionId === mission.id ? 'is-selected' : ''}`}
                  tabIndex="0"
                  aria-selected={selectedMissionId === mission.id}
                  onClick={() => onSelectMission(mission)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectMission(mission)
                    }
                  }}
                >
                  <td>
                    <div className="primary-cell mission-name-cell">
                      <strong>{mission.name}</strong>
                      <small>#{mission.id}</small>
                      <span>{mission.source === 'hermes-state' ? `Hermes · ${mission.domain || 'session'}` : mission.domain || 'Mission Cortex'}</span>
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
                    <div className="event-cell" title={rawEvent}>
                      <strong>{EVENT_LABELS[rawEvent] || rawEvent.replaceAll('_', ' ')}</strong>
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
