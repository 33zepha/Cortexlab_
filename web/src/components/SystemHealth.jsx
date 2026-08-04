import { useMemo, useState } from 'react'
import Icon from './Icon.jsx'
import { relativeTime } from '../lib/ledger.js'

const SOURCE_META = {
  systemd: { label: 'Services', icon: 'gear' },
  journalctl: { label: 'Journaux', icon: 'list' },
  'hermes-cli': { label: 'CLI Hermes', icon: 'activity' },
  'state-db': { label: 'État Hermes', icon: 'grid' },
  processes: { label: 'Processus', icon: 'pulse' },
  tailscale: { label: 'Tailscale', icon: 'link' },
}

function serviceLabel(name = '') {
  if (name.includes('gateway')) return 'Gateway'
  if (name.includes('serve')) return 'Serveur Hermes'
  return name.replace('.service', '')
}

function sourceDetail(source, system) {
  switch (source.id) {
    case 'systemd': {
      const active = system.services?.filter((service) => service.active).length || 0
      const total = system.services?.length || 0
      return `${active}/${total} services actifs`
    }
    case 'journalctl':
      return 'Événements opérationnels'
    case 'hermes-cli':
      return system.hermes?.cli?.version || 'Version non détectée'
    case 'state-db': {
      const tables = system.database?.tables?.length || 0
      return `${tables} table${tables > 1 ? 's' : ''} visible${tables > 1 ? 's' : ''}`
    }
    case 'processes': {
      const count = system.processes?.items?.length || 0
      return `${count} processus détecté${count > 1 ? 's' : ''}`
    }
    case 'tailscale':
      return system.tailscale?.dns_name || system.tailscale?.ip || system.tailscale?.backend_state || 'Réseau privé'
    default:
      return 'Source système'
  }
}

function serviceDetail(service) {
  if (!service.available) return service.error || 'Source indisponible'
  if (!service.active) return `${service.active_state || 'inactive'} · ${service.sub_state || 'unknown'}`
  const parts = []
  if (service.pid) parts.push(`PID ${service.pid}`)
  if (Number.isFinite(service.restarts)) parts.push(`${service.restarts} redémarrage${service.restarts > 1 ? 's' : ''}`)
  return parts.join(' · ') || `${service.active_state} · ${service.sub_state}`
}

function healthLabel(system, streamConnected) {
  const errors = system.issues?.filter((issue) => issue.level === 'error').length || 0
  const warnings = system.issues?.filter((issue) => issue.level !== 'error').length || 0
  if (!system.hermes?.online || errors > 0) return { label: 'Dégradé', tone: 'error', detail: `${errors || 1} anomalie critique` }
  if (!streamConnected || warnings > 0) return { label: 'À surveiller', tone: 'warning', detail: `${warnings || 1} signalement` }
  return { label: 'Opérationnel', tone: 'success', detail: 'Toutes les sources attendues répondent' }
}

export default function SystemHealth({ system, streamConnected, now }) {
  const [view, setView] = useState('sources')
  const sources = system.sources || []
  const services = system.services || []
  const issues = system.issues || []
  const health = healthLabel(system, streamConnected)
  const availableSources = sources.filter((source) => source.available).length
  const lastCollection = system.generated_at || null

  const issueGroups = useMemo(() => ({
    errors: issues.filter((issue) => issue.level === 'error'),
    warnings: issues.filter((issue) => issue.level !== 'error'),
  }), [issues])

  return (
    <section className="panel system-health-panel">
      <div className="panel-heading system-health-heading">
        <div>
          <h2>Santé du système</h2>
          <p>État consolidé de Hermes, des services et des sources d’observabilité.</p>
        </div>
        <div className="system-health-actions">
          <span className={`system-health-badge health-${health.tone}`}>
            <i aria-hidden="true" />
            <strong>{health.label}</strong>
            <small>{health.detail}</small>
          </span>
          <div className="segmented-control" aria-label="Vue santé système">
            <button type="button" className={view === 'sources' ? 'is-active' : ''} onClick={() => setView('sources')}>Sources</button>
            <button type="button" className={view === 'alerts' ? 'is-active' : ''} onClick={() => setView('alerts')}>
              Alertes{issues.length ? ` · ${issues.length}` : ''}
            </button>
          </div>
        </div>
      </div>

      {view === 'sources' ? (
        <div className="system-health-body">
          <div className="system-service-column">
            <div className="system-section-title">
              <span>Services Hermes</span>
              <small>{services.filter((service) => service.active).length}/{services.length} actifs</small>
            </div>
            <div className="service-health-list">
              {services.length ? services.map((service) => (
                <article key={service.name} className={`service-health-item ${service.active ? 'is-online' : 'is-offline'}`}>
                  <span className="service-health-icon"><Icon name={service.name.includes('gateway') ? 'link' : 'pulse'} /></span>
                  <div>
                    <strong>{serviceLabel(service.name)}</strong>
                    <small>{serviceDetail(service)}</small>
                  </div>
                  <span className={`source-state ${service.active ? 'source-online' : 'source-offline'}`}>
                    {service.active ? 'Actif' : 'Inactif'}
                  </span>
                </article>
              )) : (
                <div className="system-empty-state">Aucun service Hermes détecté.</div>
              )}
            </div>
          </div>

          <div className="system-source-column">
            <div className="system-section-title">
              <span>Sources de données</span>
              <small>{availableSources}/{sources.length} disponibles</small>
            </div>
            <div className="source-health-grid">
              {sources.map((source) => {
                const meta = SOURCE_META[source.id] || { label: source.id, icon: 'activity' }
                return (
                  <article key={source.id} className={`source-health-card ${source.available ? 'is-online' : 'is-offline'}`}>
                    <div className="source-health-card-top">
                      <span className="source-health-icon"><Icon name={meta.icon} /></span>
                      <span className={`source-state ${source.available ? 'source-online' : 'source-offline'}`}>
                        {source.available ? 'Disponible' : 'Absent'}
                      </span>
                    </div>
                    <strong>{meta.label}</strong>
                    <small>{sourceDetail(source, system)}</small>
                  </article>
                )
              })}
            </div>
          </div>

          <div className="system-runtime-column">
            <div className="system-section-title">
              <span>Runtime</span>
              <small>{lastCollection ? relativeTime(lastCollection, now) : 'jamais collecté'}</small>
            </div>
            <dl className="runtime-facts">
              <div><dt>Hermes</dt><dd>{system.hermes?.online ? 'En ligne' : 'Hors ligne'}</dd></div>
              <div><dt>Flux SSE</dt><dd>{streamConnected ? 'Connecté' : 'Déconnecté'}</dd></div>
              <div><dt>Base d’état</dt><dd>{system.database?.available ? 'Lisible' : 'Indisponible'}</dd></div>
              <div><dt>Tailscale</dt><dd>{system.tailscale?.backend_state || (system.tailscale?.available ? 'Disponible' : 'Indisponible')}</dd></div>
            </dl>
          </div>
        </div>
      ) : (
        <div className="system-alert-view">
          {issues.length === 0 ? (
            <div className="system-all-clear">
              <span><Icon name="check" /></span>
              <div><strong>Aucun signalement actif</strong><p>Les sources disponibles ne remontent aucune anomalie.</p></div>
            </div>
          ) : (
            <div className="system-issue-list">
              {[...issueGroups.errors, ...issueGroups.warnings].map((issue, index) => (
                <article key={`${issue.source}-${index}`} className={`system-issue issue-${issue.level === 'error' ? 'error' : 'warning'}`}>
                  <span><Icon name="alert" /></span>
                  <div><strong>{issue.source}</strong><p>{issue.message}</p></div>
                  <small>{issue.level === 'error' ? 'Critique' : 'À surveiller'}</small>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
