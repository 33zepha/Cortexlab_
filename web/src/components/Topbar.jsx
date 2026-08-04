import Icon from './Icon.jsx'
import { relativeTime } from '../lib/ledger.js'

export default function Topbar({
  hermesOnline,
  streamConnected,
  hermesUrl,
  lastSync,
  now,
  query,
  onQueryChange,
  attentionOnly,
  onToggleFilters,
}) {
  return (
    <header className="topbar-shell">
      <div className="topbar-title-block">
        <h1>Console</h1>
        <span className={`runtime-state ${hermesOnline ? 'is-online' : ''}`}>
          <i aria-hidden="true" />
          {hermesOnline ? 'Hermes opérationnel' : 'Hermes hors ligne'}
        </span>
        <span className="last-sync">
          {streamConnected ? 'Flux connecté' : 'Flux interrompu'}
          {' · '}
          {lastSync ? relativeTime(lastSync, now) : 'aucune activité'}
        </span>
      </div>

      <div className="topbar-actions">
        <label className="global-search">
          <Icon name="search" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Rechercher (⌘K)"
            aria-label="Rechercher"
          />
        </label>
        <button
          type="button"
          className={`secondary-button ${attentionOnly ? 'is-active' : ''}`}
          onClick={onToggleFilters}
        >
          <Icon name="filter" />
          Filtres
        </button>
        <a
          className={`primary-button ${hermesUrl ? '' : 'is-disabled'}`}
          href={hermesUrl || undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!hermesUrl}
          title={hermesUrl ? 'Ouvrir l’interface Hermes' : 'Configurer HERMES_URL sur le serveur'}
          onClick={(event) => {
            if (!hermesUrl) event.preventDefault()
          }}
        >
          <Icon name="link" />
          Ouvrir Hermes
        </a>
      </div>
    </header>
  )
}
