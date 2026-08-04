import { useEffect, useMemo } from 'react'
import Icon from './Icon.jsx'
import { agentActivity, describeEvent, relativeTime } from '../lib/ledger.js'

const STATUS = {
  running: { label: 'En cours', tone: 'success' },
  online: { label: 'En ligne', tone: 'success' },
  active: { label: 'En ligne', tone: 'success' },
  available: { label: 'Disponible', tone: 'warning' },
  offline: { label: 'Hors ligne', tone: 'neutral' },
  paused: { label: 'En pause', tone: 'neutral' },
}

function formatNumber(value, digits = 2) {
  return Number(value || 0).toFixed(digits).replace('.', ',')
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

function eventMatchesAgent(event, agent) {
  const data = event?.data || {}
  const identifiers = [data.agent, data.agent_id, data.name, data.model]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
  return identifiers.includes(String(agent.id).toLowerCase())
    || identifiers.includes(String(agent.name).toLowerCase())
    || identifiers.includes(String(agent.model).toLowerCase())
}

function currentMission(agent, missions) {
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

export default function AgentInspector({ agent, events, missions, system, now, onClose }) {
  useEffect(() => {
    if (!agent) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [agent, onClose])

  const recentEvents = useMemo(() => {
    if (!agent) return []
    return [...events].filter((event) => eventMatchesAgent(event, agent)).slice(-16).reverse()
  }, [agent, events])

  if (!agent) return null

  const activity = agentActivity(agent.id, events)
  const mission = currentMission(agent, missions)
  const runtimeStatus = activity.running ? 'running' : agent.runtime_status || agent.status || 'offline'
  const status = STATUS[runtimeStatus] || STATUS.offline
  const lastSeen = activity.lastResult?.ts || activity.since || agent.last_seen_at || recentEvents[0]?.ts
  const quality = Number(agent.quality_index) <= 1
    ? Math.round(Number(agent.quality_index || 0) * 100)
    : Math.round(Number(agent.quality_index || 0))
  const hermesServices = agent.id === 'AG-HERMES' ? system.services || [] : []

  return (
    <div className="inspector-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="mission-inspector agent-inspector"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-inspector-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="inspector-header agent-inspector-header">
          <div className="agent-inspector-title-row">
            <span className={`agent-avatar agent-inspector-avatar avatar-${agent.name?.toLowerCase()}`}>{agent.name?.slice(0, 1) || 'A'}</span>
            <div>
              <span className="inspector-source">Registre + runtime</span>
              <h2 id="agent-inspector-title">{agent.name}</h2>
              <p>{agent.id}</p>
            </div>
          </div>
          <button className="inspector-close" type="button" onClick={onClose} aria-label="Fermer l’inspecteur agent">
            <Icon name="close" />
          </button>
        </header>

        <div className="inspector-scroll">
          <section className="inspector-summary-grid agent-summary-grid">
            <div>
              <span>Statut réel</span>
              <strong className={`agent-runtime-value runtime-${status.tone}`}><i />{status.label}</strong>
            </div>
            <div><span>Dernière présence</span><strong>{relativeTime(lastSeen, now)}</strong></div>
            <div><span>Qualité configurée</span><strong>{quality}%</strong></div>
            <div><span>Coût observé</span><strong>{formatNumber(activity.cost)} u</strong></div>
          </section>

          <section className="inspector-section">
            <h3>Configuration</h3>
            <dl className="inspector-facts agent-config-facts">
              <div><dt>Niveau</dt><dd>{agent.tier || '—'}</dd></div>
              <div><dt>Provider</dt><dd>{agent.provider || '—'}</dd></div>
              <div><dt>Modèle</dt><dd>{agent.model || '—'}</dd></div>
              <div><dt>État configuré</dt><dd>{agent.configured_status || agent.status || '—'}</dd></div>
              <div className="agent-role-fact"><dt>Rôle</dt><dd>{agent.role || '—'}</dd></div>
            </dl>
            {agent.strengths?.length > 0 && (
              <div className="agent-strength-list">
                {agent.strengths.map((strength) => <span key={strength}>{strength}</span>)}
              </div>
            )}
          </section>

          <section className="inspector-section">
            <h3>Mission courante</h3>
            {mission ? (
              <article className="agent-current-mission">
                <div>
                  <span>{mission.domain || mission.source || 'Mission observée'}</span>
                  <strong>{mission.name}</strong>
                  <small>{mission.id}</small>
                </div>
                <div className="agent-mission-progress">
                  <b>{mission.progress ?? 0}%</b>
                  <span className="progress-track"><i style={{ width: `${mission.progress ?? 0}%` }} /></span>
                </div>
              </article>
            ) : (
              <p className="inspector-empty">Aucune mission courante détectée.</p>
            )}
          </section>

          <section className="inspector-section inspector-columns">
            <div>
              <h3>Activité observée</h3>
              <dl className="inspector-facts compact">
                <div><dt>Mandats</dt><dd>{activity.mandates}</dd></div>
                <div><dt>Violations</dt><dd>{activity.violations}</dd></div>
                <div><dt>Dernière règle</dt><dd>{activity.rule || '—'}</dd></div>
                <div><dt>Événements liés</dt><dd>{recentEvents.length}</dd></div>
              </dl>
            </div>
            <div>
              <h3>Indices du registre</h3>
              <dl className="inspector-facts compact">
                <div><dt>Qualité</dt><dd>{quality}%</dd></div>
                <div><dt>Coût relatif</dt><dd>{formatNumber(agent.cost_index)}</dd></div>
                <div><dt>Mission détectée</dt><dd>{mission ? 'Oui' : 'Non'}</dd></div>
                <div><dt>Présence récente</dt><dd>{lastSeen ? 'Oui' : 'Non'}</dd></div>
              </dl>
            </div>
          </section>

          {hermesServices.length > 0 && (
            <section className="inspector-section">
              <h3>Services Hermes</h3>
              <div className="agent-service-list">
                {hermesServices.map((service) => (
                  <article key={service.name}>
                    <span className={`service-dot ${service.active ? 'is-online' : 'is-offline'}`} />
                    <div><strong>{service.name}</strong><small>{service.active_state || 'unknown'} · {service.sub_state || 'unknown'}</small></div>
                    <div><b>{service.pid || '—'}</b><small>PID</small></div>
                    <div><b>{service.restarts || 0}</b><small>restart</small></div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="inspector-section">
            <h3>Événements récents</h3>
            {recentEvents.length === 0 ? (
              <p className="inspector-empty">Aucun événement directement attribué à cet agent.</p>
            ) : (
              <div className="inspector-timeline agent-event-timeline">
                {recentEvents.map((event, index) => {
                  const description = describeEvent(event)
                  return (
                    <article key={event.hash || `${event.ts}-${index}`}>
                      <span className={`timeline-node timeline-${description.variant || 'neutral'}`}><Icon name={description.icon || 'activity'} /></span>
                      <div>
                        <time>{formatDate(event.ts)}</time>
                        <strong>{description.title}</strong>
                        <p>{description.detail}</p>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  )
}
