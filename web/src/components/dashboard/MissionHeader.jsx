import { relativeTime } from '../../lib/ledger.js'
import Icon from '../Icon.jsx'

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
          <span><Icon name="clock" className="micro-icon" /> Démarrée {mission?.started_at ? relativeTime(mission.started_at, now) : 'il y a 2 h 47 m'}</span>
          <span><Icon name="users" className="micro-icon" /> Hermes (Chief of Staff)</span>
        </p>
      </div>
      <div className="reference-actions">
        <button type="button"><Icon name="share" className="micro-icon" /><span>Partager</span></button>
        <button type="button" aria-label="Plein écran"><Icon name="expand" /></button>
        <button type="button" aria-label="Plus d'options"><Icon name="more" /></button>
        <button type="button" className="reference-intervene"><span>Intervenir</span> <Icon name="chevron-down" className="micro-icon" /></button>
        <span
          className={`reference-sync ${connected ? 'is-live' : ''}`}
          title={lastSync ? `Synchronisé ${relativeTime(lastSync, now)}` : 'Non synchronisé'}
        >
          <Icon name="refresh" />
        </span>
      </div>
    </header>
  )
}
