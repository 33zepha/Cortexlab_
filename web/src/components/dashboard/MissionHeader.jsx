import { relativeTime } from '../../lib/ledger.js'

export default function MissionHeader({ mission, connected, lastSync, now }) {
  return (
    <header className="reference-header">
      <div>
        <div className="reference-title-row">
          <h1>{mission?.name || mission?.mission || 'Refonte plateforme RH multi-agent'}</h1>
          <span className={`reference-running ${connected ? 'is-live' : ''}`}><i />{connected ? 'Running' : 'Offline'}</span>
        </div>
        <p>
          ID: {mission?.id || 'MIS-2024-05-24-001'}
          <span>◷ Démarrée {mission?.started_at ? relativeTime(mission.started_at, now) : 'il y a 2 h 47 m'}</span>
          <span>♟ Hermes (Chief of Staff)</span>
        </p>
      </div>
      <div className="reference-actions">
        <button>Partager</button>
        <button aria-label="Plein écran">⛶</button>
        <button aria-label="Plus d'options">•••</button>
        <button className="reference-intervene">Intervenir <b>⌄</b></button>
        <span className="reference-sync" title={lastSync ? `Synchronisé ${relativeTime(lastSync, now)}` : 'Non synchronisé'}>◔</span>
      </div>
    </header>
  )
}
