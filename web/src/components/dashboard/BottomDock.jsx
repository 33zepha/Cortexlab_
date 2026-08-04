import EventDock from './EventDock.jsx'
import TerminalPanel from './TerminalPanel.jsx'

export default function BottomDock({ events, now }) {
  return (
    <section className="reference-dock">
      <div className="dock-main">
        <nav><button className="is-active">Journal des événements</button><button>Terminal</button><button>Ledger</button><button>Artefacts</button><button>Décisions</button></nav>
        <EventDock events={events} now={now} />
      </div>
      <TerminalPanel />
    </section>
  )
}
