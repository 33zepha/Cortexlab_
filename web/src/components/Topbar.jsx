import Icon from './Icon.jsx'
import { relativeTime } from '../lib/ledger.js'

export default function Topbar({
  connected,
  lastSync,
  now,
  query,
  onQueryChange,
  attentionOnly,
  onToggleFilters,
  onRunMission,
  running,
}) {
  return (
    <header className="topbar-shell">
      <div className="topbar-title-block">
        <h1>Console</h1>
        <span className={`runtime-state ${connected ? 'is-online' : ''}`}>
          <i aria-hidden="true" />
          {connected ? 'Runtime operational' : 'Runtime offline'}
        </span>
        <span className="last-sync">Last sync: {lastSync ? relativeTime(lastSync, now).replace('il y a ', '') : '—'}</span>
      </div>

      <div className="topbar-actions">
        <label className="global-search">
          <Icon name="search" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search (⌘K)"
            aria-label="Rechercher"
          />
        </label>
        <button
          type="button"
          className={`secondary-button ${attentionOnly ? 'is-active' : ''}`}
          onClick={onToggleFilters}
        >
          <Icon name="filter" />
          Filters
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={onRunMission}
          disabled={running}
        >
          <Icon name="play" />
          {running ? 'Running…' : 'Run Mission'}
        </button>
      </div>
    </header>
  )
}
