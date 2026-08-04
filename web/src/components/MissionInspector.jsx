import Icon from './Icon.jsx'
import { describeEvent, relativeTime } from '../lib/ledger.js'

const STATUS_LABEL = {
  running: 'En cours',
  autonomous: 'Autonome',
  information: 'Avec information',
  escalated: 'Escalade humaine',
  incomplete: 'Incomplète',
  closed: 'Terminée',
  unknown: 'État indéterminé',
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date)
}

function formatCost(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(2).replace('.', ',') : '—'
}

function observableEventData(event) {
  const data = event?.data || {}
  return [
    ['Règle', data.rule],
    ['Agent', data.name || data.agent],
    ['Modèle', data.model],
    ['Coût', data.cost],
    ['Résultats', data.findings],
    ['Violation', data.violation === undefined ? null : data.violation ? 'Oui' : 'Non'],
    ['Closure', data.closure],
    ['Note', data.note],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '')
}

export default function MissionInspector({ mission, now, onClose }) {
  if (!mission) return null
  const timeline = mission.timeline?.length ? mission.timeline : [mission.latest_event].filter(Boolean)
  const closureReason = mission.closure_data?.reason
    || mission.closure_data?.rationale
    || mission.closure_data?.note
    || null

  return (
    <div className="inspector-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="mission-inspector"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-inspector-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="inspector-header">
          <div>
            <span className="inspector-source">
              {mission.source === 'hermes-state' ? 'État Hermes' : 'Ledger Cortex'}
            </span>
            <h2 id="mission-inspector-title">{mission.name}</h2>
            <p>{mission.id}</p>
          </div>
          <button className="inspector-close" type="button" onClick={onClose} aria-label="Fermer l’inspecteur">
            <Icon name="close" />
          </button>
        </header>

        <div className="inspector-scroll">
          <section className="inspector-summary-grid">
            <div><span>Statut</span><strong>{STATUS_LABEL[mission.status] || mission.status}</strong></div>
            <div><span>Progression</span><strong>{mission.progress ?? 0}%</strong></div>
            <div><span>Démarrée</span><strong>{formatDate(mission.started_at)}</strong></div>
            <div><span>Dernière activité</span><strong>{relativeTime(mission.latest_event?.ts, now)}</strong></div>
          </section>

          <section className="inspector-section">
            <h3>Contexte observé</h3>
            <dl className="inspector-facts">
              <div><dt>Source</dt><dd>{mission.source === 'hermes-state' ? `state.db · ${mission.source_table || 'table inconnue'}` : 'ledger/events.ndjson'}</dd></div>
              <div><dt>Domaine</dt><dd>{mission.domain || '—'}</dd></div>
              <div><dt>Cible</dt><dd>{mission.target || '—'}</dd></div>
              <div><dt>Événements</dt><dd>{mission.event_count || timeline.length}</dd></div>
            </dl>
          </section>

          <section className="inspector-section">
            <h3>Agents mobilisés</h3>
            {mission.agents?.length ? (
              <div className="inspector-agent-list">
                {mission.agents.map((agent) => (
                  <article key={agent.id}>
                    <span className="agent-avatar">{agent.name?.slice(0, 1) || 'A'}</span>
                    <div><strong>{agent.name || agent.id}</strong><small>{agent.model || agent.id}</small></div>
                    <div className="inspector-agent-metrics"><b>{agent.mandates || 1}</b><small>mandat(s)</small></div>
                    <div className="inspector-agent-metrics"><b>{formatCost(agent.cost)}</b><small>coût</small></div>
                  </article>
                ))}
              </div>
            ) : <p className="inspector-empty">Aucun agent structuré détecté.</p>}
          </section>

          <section className="inspector-section inspector-columns">
            <div>
              <h3>Budget</h3>
              <dl className="inspector-facts compact">
                <div><dt>Consommé</dt><dd>{formatCost(mission.budget?.cost)}</dd></div>
                <div><dt>Maximum</dt><dd>{formatCost(mission.budget?.limits?.maxCost)}</dd></div>
                <div><dt>Explorations</dt><dd>{mission.budget?.explorations ?? '—'}</dd></div>
                <div><dt>Reprises</dt><dd>{mission.budget?.reworks ?? '—'}</dd></div>
              </dl>
            </div>
            <div>
              <h3>Contrôles</h3>
              <dl className="inspector-facts compact">
                <div><dt>Validés</dt><dd>{mission.checks?.passed || 0}</dd></div>
                <div><dt>Violations</dt><dd>{mission.checks?.violations || 0}</dd></div>
                <div><dt>Résultats</dt><dd>{mission.checks?.findings || 0}</dd></div>
                <div><dt>Escalades</dt><dd>{mission.escalations || 0}</dd></div>
              </dl>
            </div>
          </section>

          {(mission.closure || closureReason) && (
            <section className="inspector-section closure-section">
              <h3>Décision de closure</h3>
              <strong>{mission.closure || STATUS_LABEL[mission.status]}</strong>
              {closureReason && <p>{closureReason}</p>}
            </section>
          )}

          <section className="inspector-section">
            <h3>Chronologie</h3>
            <div className="inspector-timeline">
              {timeline.map((event, index) => {
                const description = describeEvent(event)
                const facts = observableEventData(event)
                return (
                  <article key={event?.hash || `${event?.ts}-${index}`}>
                    <span className={`timeline-node timeline-${description.variant || 'neutral'}`}><Icon name={description.icon || 'activity'} /></span>
                    <div>
                      <time>{formatDate(event?.ts)}</time>
                      <strong>{description.title}</strong>
                      <p>{description.detail}</p>
                      {facts.length > 0 && (
                        <div className="timeline-facts">
                          {facts.map(([label, value]) => <span key={label}><b>{label}</b> {String(value)}</span>)}
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      </aside>
    </div>
  )
}
