import { useState } from 'react'
import Icon from './Icon.jsx'
import { describeEvent, relativeTime } from '../lib/ledger.js'

function actorFor(event) {
  const data = event.data || {}
  if (data.name) return data.name
  if (data.agent) return String(data.agent).replace(/^AG-/, '').toLowerCase().replace(/^./, (c) => c.toUpperCase())
  if (event.type.startsWith('mission.') || event.type === 'budget.eval') return 'Hermes'
  return 'Cortex'
}

export default function LiveActivity({ events, now, connected }) {
  const [expanded, setExpanded] = useState(false)
  const visible = [...events].slice(expanded ? -40 : -9).reverse()

  return (
    <aside className={`panel live-panel ${expanded ? 'is-expanded' : ''}`}>
      <div className="panel-heading live-heading">
        <div>
          <h2>Activité en direct</h2>
          <p>Derniers événements enregistrés dans le ledger.</p>
        </div>
        <span className={`live-status ${connected ? 'is-online' : ''}`}>
          <i aria-hidden="true" />{connected ? 'En direct' : 'Hors ligne'}
        </span>
      </div>

      <div className="activity-timeline">
        {visible.length === 0 ? (
          <div className="activity-empty">Aucun événement pour le moment.</div>
        ) : visible.map((event, index) => {
          const description = describeEvent(event)
          const actor = actorFor(event)
          const variant = description.variant || 'neutral'
          return (
            <article className="activity-item" key={event.hash || `${event.ts}-${index}`}>
              <div className={`activity-icon activity-${variant}`}>
                <Icon name={description.icon || 'dot'} />
              </div>
              <div className="activity-copy">
                <time>{relativeTime(event.ts, now)}</time>
                <strong>{actor}</strong>
                <span className={`activity-event event-${variant}`} title={event.type}>
                  {description.title}
                </span>
                <p>{description.detail}</p>
              </div>
            </article>
          )
        })}
      </div>

      {events.length > 9 && (
        <button
          className="activity-footer-button"
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? 'Réduire le ledger' : `Afficher tout le ledger (${Math.min(events.length, 40)})`}
        </button>
      )}
    </aside>
  )
}
