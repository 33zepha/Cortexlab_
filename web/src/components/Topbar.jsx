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
        <div className="console-identity">
          <span className="console-kicker">Cortex / Observatory</span>
          <h1>Mission Control</h1>
        </div>
        <div className="runtime-cluster">
          <span className={`runtime-state ${hermesOnline ? 'is-online' : ''}`}>
            <i aria-hidden="true" />
            {hermesOnline ? 'HERMES ONLINE' : 'HERMES OFFLINE'}
          </span>
          <span className="last-sync">
            {streamConnected ? 'SSE CONNECTÉ' : 'SSE INTERROMPU'}
            {' / '}
            {lastSync ? relativeTime(lastSync, now) : 'AUCUNE ACTIVITÉ'}
          </span>
        </div>
      </div>

      <div className="topbar-actions">
        <label className="global-search">
          <Icon name="search" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Rechercher dans le système"
            aria-label="Rechercher"
          />
        </label>
        <button
          type="button"
          className={`secondary-button ${attentionOnly ? 'is-active' : ''}`}
          onClick={onToggleFilters}
        >
          <Icon name="filter" />
          Signaux
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
