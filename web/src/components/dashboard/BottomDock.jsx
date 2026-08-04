import { useState } from 'react'
import EventDock from './EventDock.jsx'
import TerminalPanel from './TerminalPanel.jsx'

// Hierarchy rule (Section 4): the terminal must never dominate the screen.
// Instead of a permanent 360px panel sitting next to the event journal, the
// dock is a single tabbed surface — one panel visible at a time, journal
// shown first by default.
const TABS = [
  ['events', 'Journal des événements'],
  ['terminal', 'Terminal'],
  ['ledger', 'Ledger'],
  ['artifacts', 'Artefacts'],
  ['decisions', 'Décisions'],
]

function ComingSoon({ label }) {
  return <div className="dock-empty">{label} — pas encore disponible dans cette vue.</div>
}

export default function BottomDock({ events, now, terminal }) {
  const [tab, setTab] = useState('events')

  return (
    <section className="reference-dock">
      <nav className="dock-tabs">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'is-active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="dock-body">
        {tab === 'events' && <EventDock events={events} now={now} />}
        {tab === 'terminal' && <TerminalPanel output={terminal} />}
        {tab === 'ledger' && <ComingSoon label="Ledger" />}
        {tab === 'artifacts' && <ComingSoon label="Artefacts" />}
        {tab === 'decisions' && <ComingSoon label="Décisions" />}
      </div>
    </section>
  )
}
