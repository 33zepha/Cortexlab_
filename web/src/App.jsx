import { useMemo, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import { relativeTime, useLedger, useNow } from './lib/ledger.js'

const STATUS = {
  active: 'running',
  running: 'running',
  complete: 'done',
  completed: 'done',
  failed: 'failed',
  blocked: 'blocked',
  idle: 'idle',
}

function formatNumber(value, digits = 2) {
  return Number(value || 0).toFixed(digits).replace('.', ',')
}

function Metric({ label, value, detail, progress }) {
  return (
    <div className="clinical-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      {progress != null && <i><b style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></i>}
    </div>
  )
}

function AgentNode({ agent, selected, onSelect, x, y, fallbackRole }) {
  const state = STATUS[agent?.status] || 'idle'
  const name = agent?.name || fallbackRole
  const model = agent?.model || agent?.provider || 'Unassigned'
  return (
    <button
      className={`agent-node state-${state}${selected ? ' is-selected' : ''}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      onClick={() => onSelect({ ...agent, name, model, state })}
      type="button"
    >
      <span className="agent-node-icon">{name.slice(0, 1).toUpperCase()}</span>
      <span className="agent-node-copy">
        <strong>{name}</strong>
        <small>{model}</small>
      </span>
      <span className="agent-node-state"><i />{state}</span>
    </button>
  )
}

function MissionGraph({ agents, selected, onSelect }) {
  const nodes = [
    { agent: agents.find((a) => /hermes|chief/i.test(`${a.name} ${a.id}`)) || agents[0], role: 'Chief of Staff', x: 50, y: 10 },
    { agent: agents.find((a) => /plan/i.test(`${a.name} ${a.id}`)) || agents[1], role: 'Planner', x: 50, y: 31 },
    { agent: agents.find((a) => /research|kimi/i.test(`${a.name} ${a.id}`)) || agents[2], role: 'Research', x: 21, y: 56 },
    { agent: agents.find((a) => /front|codex/i.test(`${a.name} ${a.id}`)) || agents[3], role: 'Frontend', x: 50, y: 56 },
    { agent: agents.find((a) => /back|claude/i.test(`${a.name} ${a.id}`)) || agents[4], role: 'Backend', x: 79, y: 56 },
    { agent: agents.find((a) => /review|critic/i.test(`${a.name} ${a.id}`)) || agents[5], role: 'Reviewer', x: 50, y: 82 },
  ]

  return (
    <section className="execution-stage" aria-label="Graphe d’exécution">
      <header className="stage-header">
        <div>
          <span className="eyebrow">LIVE EXECUTION GRAPH</span>
          <h2>Architecture d’exécution</h2>
        </div>
        <div className="stage-tools"><button type="button">−</button><span>100%</span><button type="button">+</button></div>
      </header>
      <div className="graph-canvas">
        <svg className="graph-lines" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
          <path d="M500 110 L500 205" />
          <path d="M500 260 C500 310 210 285 210 350" />
          <path d="M500 260 L500 350" />
          <path d="M500 260 C500 310 790 285 790 350" />
          <path d="M210 430 C210 505 500 475 500 520" />
          <path d="M500 430 L500 520" />
          <path d="M790 430 C790 505 500 475 500 520" />
        </svg>
        {nodes.map((node, index) => (
          <AgentNode
            key={`${node.role}-${index}`}
            agent={node.agent}
            fallbackRole={node.role}
            x={node.x}
            y={node.y}
            selected={selected?.name === (node.agent?.name || node.role)}
            onSelect={onSelect}
          />
        ))}
        <div className="graph-legend"><span><i className="dot-running" />Running</span><span><i className="dot-done" />Done</span><span><i className="dot-blocked" />Blocked</span></div>
      </div>
    </section>
  )
}

function Inspector({ agent, events }) {
  const latest = events.filter((event) => event.data?.agent === agent?.id || event.data?.name === agent?.name).slice(-3).reverse()
  return (
    <aside className="clinical-inspector">
      <header>
        <span className="eyebrow">PROCESS INSPECTOR</span>
        <h2>{agent?.name || 'Select a process'}</h2>
        <p>{agent?.model || 'Aucun processus sélectionné'}</p>
      </header>
      <div className="inspector-status"><span><i />{agent?.state || 'idle'}</span><strong>{agent?.progress || (agent?.state === 'running' ? 68 : 100)}%</strong></div>
      <div className="inspector-grid">
        <div><span>Durée</span><strong>{agent?.duration || '01:24:17'}</strong></div>
        <div><span>Coût</span><strong>{formatNumber(agent?.cost || 0.18)} u</strong></div>
        <div><span>Contexte</span><strong>{agent?.tokens || '3 240'} t</strong></div>
        <div><span>Essai</span><strong>1 / 2</strong></div>
      </div>
      <section className="inspector-section"><span>MANDAT</span><p>{agent?.mandate || 'Exécuter la sous-tâche assignée, produire les preuves demandées et respecter le budget de mission.'}</p></section>
      <section className="inspector-section"><span>PREUVES</span><ul><li><i className="is-valid" />Résultat agent reçu</li><li><i className="is-valid" />Contrôle automatique</li><li><i />Revue finale en attente</li></ul></section>
      <section className="inspector-section"><span>DERNIERS ÉVÉNEMENTS</span><ul>{latest.length ? latest.map((event) => <li key={event.hash}><i className="is-valid" />{event.type}</li>) : <li><i />Aucun événement ciblé</li>}</ul></section>
      <footer><button type="button">Mettre en pause</button><button type="button" className="danger">Arrêter</button></footer>
    </aside>
  )
}

function EventDock({ events, now }) {
  const visible = events.slice(-6).reverse()
  return (
    <section className="event-dock">
      <header><div><span className="eyebrow">EVENT LEDGER</span><h2>Journal d’exécution</h2></div><nav><button className="is-active">Événements</button><button>Artefacts</button><button>Décisions</button></nav></header>
      <div className="event-list">
        {visible.length ? visible.map((event) => (
          <article key={event.hash || `${event.ts}-${event.type}`}>
            <time>{relativeTime(event.ts, now)}</time><i /><strong>{event.data?.name || event.data?.agent || 'Cortex'}</strong><span>{event.type}</span>
          </article>
        )) : <p className="event-empty">Le ledger attend le premier événement.</p>}
      </div>
    </section>
  )
}

export default function App() {
  const { agents, events, missions, summary, connected, lastSync, runMission, demo } = useLedger()
  const now = useNow()
  const [active, setActive] = useState('dashboard')
  const [query, setQuery] = useState('')
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)

  const mission = missions.find((item) => /running|active/i.test(item.status || '')) || missions[0]
  const activeAgents = useMemo(() => agents.filter((agent) => /active|running/i.test(agent.status || '')).length, [agents])
  const budgetPct = summary.budget_limit > 0 ? Math.round((summary.budget_cost / summary.budget_limit) * 100) : 0
  const progress = mission?.progress || Math.min(100, Math.round(((summary.autonomous || 0) / Math.max(1, summary.total || 1)) * 100))
  const inspected = selected || { ...(agents[0] || {}), name: agents[0]?.name || 'Hermes', model: agents[0]?.model || 'Chief of Staff', state: connected ? 'running' : 'idle' }

  const handleRunMission = async () => {
    setRunning(true); setError(null)
    try { await runMission() } catch (runError) { setError(runError.message) } finally { setRunning(false) }
  }

  const handleNavigate = (destination) => {
    setActive(destination)
    document.getElementById(destination === 'dashboard' ? 'dashboard' : destination)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="app-shell clinical-shell">
      <Sidebar active={active} onNavigate={handleNavigate} />
      <div className="app-main">
        <Topbar connected={connected} lastSync={lastSync} now={now} query={query} onQueryChange={setQuery} attentionOnly={attentionOnly} onToggleFilters={() => setAttentionOnly((value) => !value)} onRunMission={handleRunMission} running={running} />
        <main className="clinical-dashboard" id="dashboard">
          {error && <div className="error-banner">La mission a échoué : {error}</div>}
          <header className="mission-header">
            <div><span className="eyebrow">ACTIVE MISSION · {mission?.id || 'MIS-LOCAL-001'}</span><div className="mission-title-row"><h1>{mission?.name || mission?.mission || 'Cortex runtime supervision'}</h1><span className={`mission-state ${connected ? 'is-running' : ''}`}><i />{connected ? 'Running' : 'Offline'}</span></div><p>Chief of Staff · {inspected.name} · dernière synchronisation {lastSync ? relativeTime(lastSync, now) : 'indisponible'}</p></div>
            <div className="mission-actions"><button type="button">Partager</button><button type="button">•••</button><button type="button" className="intervene">Intervenir</button></div>
          </header>

          {demo && <div className="demo-chip">Données de démonstration</div>}

          <section className="mission-metrics">
            <Metric label="Progression" value={`${progress}%`} detail={`${summary.autonomous || 0} closures autonomes`} progress={progress} />
            <Metric label="Agents actifs" value={`${activeAgents}/${agents.length || 1}`} detail={connected ? 'Runtime opérationnel' : 'Connexion interrompue'} />
            <Metric label="Budget" value={`${formatNumber(summary.budget_cost)} u`} detail={`${budgetPct}% de ${formatNumber(summary.budget_limit)} u`} progress={budgetPct} />
            <Metric label="Événements" value={events.length} detail={events.at(-1)?.type || 'Ledger vide'} />
          </section>

          <div className="mission-workspace">
            <MissionGraph agents={agents} selected={inspected} onSelect={setSelected} />
            <Inspector agent={inspected} events={events} />
          </div>
          <EventDock events={events} now={now} />
        </main>
      </div>
    </div>
  )
}
