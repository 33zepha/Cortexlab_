import { useEffect, useMemo, useState } from 'react'
import Icon from './Icon.jsx'
import { describeEvent, relativeTime } from '../lib/ledger.js'

const FILTERS = [
  ['all', 'Tous'],
  ['mission', 'Missions'],
  ['agent', 'Agents'],
  ['system', 'Système'],
  ['alert', 'Alertes'],
]

function eventSource(event) {
  const explicit = event.data?.source
  if (explicit === 'journalctl' || String(event.type).startsWith('hermes.')) return 'Hermes'
  if (explicit === 'hermes-observability' || event.type === 'system.snapshot') return 'Système'
  return 'Ledger Cortex'
}

function eventGroup(event) {
  const type = String(event.type || '')
  if (/error|warning|violation|escalat|approval/.test(type) || event.data?.violation) return 'alert'
  if (type.startsWith('mission.') || type.startsWith('hermes.state.')) return 'mission'
  if (type.startsWith('agent.') || event.data?.agent || event.data?.agent_id) return 'agent'
  if (type.startsWith('system.') || type.startsWith('hermes.log') || type.startsWith('hermes.gateway')) return 'system'
  return 'system'
}

function actorFor(event) {
  const data = event.data || {}
  if (data.name) return data.name
  if (data.agent) return String(data.agent).replace(/^AG-/, '')
  if (data.service) return data.service.replace('.service', '')
  if (String(event.type).startsWith('hermes.')) return 'Hermes'
  if (String(event.type).startsWith('mission.')) return 'Hermes'
  return 'Cortex'
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

function displayValue(value) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '[]'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function EventExplorer({ open, events, now, onClose }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedKey, setSelectedKey] = useState(null)

  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fr-FR')
    return [...events]
      .reverse()
      .filter((event) => filter === 'all' || eventGroup(event) === filter)
      .filter((event) => {
        if (!normalized) return true
        const description = describeEvent(event)
        const text = [
          event.type,
          event.hash,
          eventSource(event),
          actorFor(event),
          description.title,
          description.detail,
          ...Object.values(event.data || {}).map(displayValue),
        ].filter(Boolean).join(' ').toLocaleLowerCase('fr-FR')
        return text.includes(normalized)
      })
      .slice(0, 250)
  }, [events, filter, query])

  const selected = visible.find((event, index) => (event.hash || `${event.ts}-${index}`) === selectedKey)
    || visible[0]
    || null

  useEffect(() => {
    if (!open || visible.length === 0) return
    const stillVisible = visible.some((event, index) => (event.hash || `${event.ts}-${index}`) === selectedKey)
    if (!stillVisible) setSelectedKey(visible[0].hash || `${visible[0].ts}-0`)
  }, [open, selectedKey, visible])

  if (!open) return null

  const selectedDescription = selected ? describeEvent(selected) : null
  const selectedVariant = selectedDescription?.variant || 'neutral'
  const selectedData = Object.entries(selected?.data || {})
    .filter(([, value]) => value !== undefined)
    .slice(0, 40)

  return (
    <div className="ledger-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="ledger-explorer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ledger-explorer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="ledger-header">
          <div>
            <span className="inspector-source">Flux temps réel</span>
            <h2 id="ledger-explorer-title">Explorateur du ledger</h2>
            <p>{events.length} événements observés · {visible.length} visibles</p>
          </div>
          <button className="inspector-close" type="button" onClick={onClose} aria-label="Fermer l’explorateur">
            <Icon name="close" />
          </button>
        </header>

        <div className="ledger-toolbar">
          <label className="ledger-search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type, agent, service, hash, détail…"
              aria-label="Rechercher dans le ledger"
              autoFocus
            />
          </label>
          <div className="ledger-filter-row" aria-label="Filtrer les événements">
            {FILTERS.map(([id, label]) => (
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

        <div className="ledger-body">
          <div className="ledger-event-list" role="listbox" aria-label="Événements">
            {visible.length === 0 ? (
              <div className="ledger-empty">Aucun événement ne correspond aux filtres.</div>
            ) : visible.map((event, index) => {
              const description = describeEvent(event)
              const variant = description.variant || 'neutral'
              const key = event.hash || `${event.ts}-${index}`
              return (
                <button
                  key={key}
                  type="button"
                  className={`ledger-event-row ${key === selectedKey || (!selectedKey && index === 0) ? 'is-selected' : ''}`}
                  onClick={() => setSelectedKey(key)}
                  role="option"
                  aria-selected={key === selectedKey}
                >
                  <span className={`ledger-row-icon row-${variant}`}><Icon name={description.icon || 'activity'} /></span>
                  <span className="ledger-row-copy">
                    <span className="ledger-row-meta"><b>{actorFor(event)}</b><time>{relativeTime(event.ts, now)}</time></span>
                    <strong>{description.title}</strong>
                    <small>{description.detail}</small>
                  </span>
                  <span className="ledger-row-source">{eventSource(event)}</span>
                </button>
              )
            })}
          </div>

          <aside className="ledger-event-detail">
            {!selected ? (
              <div className="ledger-empty">Sélectionner un événement.</div>
            ) : (
              <>
                <div className="ledger-detail-heading">
                  <span className={`ledger-detail-icon detail-${selectedVariant}`}><Icon name={selectedDescription.icon || 'activity'} /></span>
                  <div>
                    <span>{eventSource(selected)}</span>
                    <h3>{selectedDescription.title}</h3>
                    <p>{selectedDescription.detail}</p>
                  </div>
                </div>

                <dl className="ledger-core-facts">
                  <div><dt>Type</dt><dd>{selected.type}</dd></div>
                  <div><dt>Date</dt><dd>{formatDate(selected.ts)}</dd></div>
                  <div><dt>Acteur</dt><dd>{actorFor(selected)}</dd></div>
                  <div><dt>Groupe</dt><dd>{eventGroup(selected)}</dd></div>
                  <div className="ledger-hash-fact"><dt>Hash</dt><dd>{selected.hash || 'Non fourni'}</dd></div>
                </dl>

                <div className="ledger-data-section">
                  <div className="system-section-title">
                    <span>Données observées</span>
                    <small>{selectedData.length} champ{selectedData.length > 1 ? 's' : ''}</small>
                  </div>
                  {selectedData.length === 0 ? (
                    <div className="ledger-data-empty">Aucune donnée structurée.</div>
                  ) : (
                    <dl className="ledger-data-list">
                      {selectedData.map(([key, value]) => (
                        <div key={key}><dt>{key}</dt><dd title={displayValue(value)}>{displayValue(value)}</dd></div>
                      ))}
                    </dl>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      </section>
    </div>
  )
}
