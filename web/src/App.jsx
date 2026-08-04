import { useMemo, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import { relativeTime, useLedger, useNow } from './lib/ledger.js'

const FLOW = [
  { id: 'hermes', label: 'Hermes', role: 'Chief of Staff', x: 50, y: 8 },
  { id: 'planner', label: 'Planner', role: 'Mission Planner', x: 50, y: 25 },
  { id: 'research', label: 'Researcher', role: 'Deep Research', x: 19, y: 46 },
  { id: 'frontend', label: 'Frontend Agent', role: 'UI/UX Specialist', x: 50, y: 46 },
  { id: 'backend', label: 'Backend Agent', role: 'Codex', x: 81, y: 46 },
  { id: 'design', label: 'Design System', role: 'Visual Agent', x: 50, y: 64 },
  { id: 'api', label: 'API Development', role: 'Backend Specialist', x: 81, y: 64 },
  { id: 'review', label: 'Reviewer', role: 'Quality Assurance', x: 50, y: 81 },
  { id: 'human', label: 'Human Approval', role: 'En attente', x: 50, y: 96 },
]

const CONNECTIONS = [
  ['hermes', 'planner'], ['planner', 'research'], ['planner', 'frontend'], ['planner', 'backend'],
  ['frontend', 'design'], ['backend', 'api'], ['research', 'review'], ['design', 'review'], ['api', 'review'], ['review', 'human'],
]

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0))
}

function formatNumber(value, digits = 2) {
  return Number(value || 0).toFixed(digits).replace('.', ',')
}

function statusFor(node, index, selected) {
  if (node.id === 'human') return 'waiting'
  if (selected?.id === node.id) return 'running'
  if (index < 3) return 'done'
  if (index < 7) return 'running'
  return 'queued'
}

function TopHeader({ mission, connected, lastSync, now }) {
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
        <button aria-label="Plus d’options">•••</button>
        <button className="reference-intervene">Intervenir <b>⌄</b></button>
        <span className="reference-sync" title={lastSync ? `Synchronisé ${relativeTime(lastSync, now)}` : 'Non synchronisé'}>◔</span>
      </div>
    </header>
  )
}

function MissionSummary({ mission, summary, progress, agents }) {
  const budgetPct = summary.budget_limit > 0 ? clamp((summary.budget_cost / summary.budget_limit) * 100) : 49
  return (
    <aside className="mission-summary-card">
      <span className="reference-kicker">ACTIVE MISSION</span>
      <h2>{mission?.name || mission?.mission || 'Refonte plateforme RH'}</h2>
      <p>{mission?.id || 'MIS-2024-05-24-001'}</p>
      <span className="summary-running"><i />Running</span>
      <div className="summary-meter"><span><b style={{ width: `${progress}%` }} /></span><strong>{progress}%</strong></div>
      <div className="summary-divider" />
      <SummaryMetric label="Budget" value={`€${formatNumber(summary.budget_cost || 12.45)} / €${formatNumber(summary.budget_limit || 25)}`} percent={budgetPct} />
      <SummaryMetric label="Tokens" value="1.24M / 3M" percent={41} />
      <div className="summary-agent">
        <span className="summary-avatar">H</span>
        <div><strong>{agents[0]?.name || 'Hermes'}</strong><small>Chief of Staff</small></div>
        <b>›</b>
      </div>
    </aside>
  )
}

function SummaryMetric({ label, value, percent }) {
  return (
    <section className="summary-metric">
      <span>{label}</span>
      <div><strong>{value}</strong><b>{Math.round(percent)}%</b></div>
      <i><em style={{ width: `${clamp(percent)}%` }} /></i>
    </section>
  )
}

function Node({ item, state, active, onSelect }) {
  return (
    <button
      type="button"
      className={`reference-node state-${state}${active ? ' is-active' : ''}`}
      style={{ left: `${item.x}%`, top: `${item.y}%` }}
      onClick={() => onSelect(item)}
    >
      <span className="reference-node-icon">{item.label.slice(0, 1)}</span>
      <span className="reference-node-copy"><strong>{item.label}</strong><small>{item.role}</small></span>
      <span className="reference-node-progress"><i />{state === 'done' ? '100%' : state === 'waiting' ? 'En attente' : state === 'queued' ? '40%' : '80%'}</span>
    </button>
  )
}

function ExecutionCanvas({ selected, onSelect, activeAgents }) {
  const point = (id) => FLOW.find((item) => item.id === id)
  return (
    <section className="reference-canvas-panel">
      <div className="canvas-toolbar">
        <button>⌁</button><button>⌕</button><button>⌘</button><button>□</button><button>⌘</button>
      </div>
      <div className="canvas-agent-count">♙ {activeAgents || 7} agents actifs</div>
      <svg className="reference-connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {CONNECTIONS.map(([from, to]) => {
          const a = point(from); const b = point(to)
          const mid = (a.y + b.y) / 2
          return <path key={`${from}-${to}`} d={`M ${a.x} ${a.y + 3} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y - 3}`} />
        })}
      </svg>
      {FLOW.map((item, index) => <Node key={item.id} item={item} state={statusFor(item, index, selected)} active={selected?.id === item.id} onSelect={onSelect} />)}
      <div className="canvas-zoom"><button>−</button><span>100%</span><button>+</button></div>
      <button className="canvas-fit">⛶</button>
      <button className="canvas-lock">♙</button>
      <div className="canvas-minimap"><span /><span /><span /><span /><span /><span /></div>
    </section>
  )
}

function Inspector({ selected }) {
  const item = selected || FLOW[3]
  return (
    <aside className="reference-inspector">
      <header><span className="inspector-icon">{item.label.slice(0, 1)}</span><strong>{item.label}</strong><button>×</button></header>
      <section className="inspector-block inspector-state">
        <span className="reference-kicker">STATUT</span>
        <div><strong><i />En cours d’exécution</strong><b>80%</b></div>
        <em><i /></em>
      </section>
      <section className="inspector-stats">
        <div><span>DURÉE</span><strong>1h 24m 17s</strong></div><div><span>COÛT</span><strong>€0.18</strong></div><div><span>TOKENS</span><strong>243,672</strong></div><div><span>MODÈLE</span><strong>Claude 3.5 Sonnet</strong></div>
      </section>
      <InspectorText title="MANDAT">Créer l’interface utilisateur pour le tableau de bord RH en respectant le design system et les composants existants.</InspectorText>
      <InspectorList title="CONTEXTE" trailing="3,240 tokens" items={[['Bundle: RH Platform Guidelines','v2.1'],['Figma: Dashboard Design','Updated'],['Codebase: /frontend/src','Latest']]} />
      <InspectorList title="PREUVES (2/3)" items={[['UI Components','Validé'],['Storybook','Validé'],['Tests E2E','En attente']]} status />
      <InspectorList title="DÉPENDANCES" items={[['Design System','Terminé'],['API Contracts','En cours']]} status />
      <footer><button>▷ Intervenir</button><button>Ⅱ Mettre en pause</button><button className="danger">▱ Arrêter</button></footer>
    </aside>
  )
}

function InspectorText({ title, children }) {
  return <section className="inspector-block"><span className="reference-kicker">{title}</span><p>{children}</p></section>
}

function InspectorList({ title, trailing, items, status }) {
  return (
    <section className="inspector-block">
      <div className="inspector-label-row"><span className="reference-kicker">{title}</span>{trailing && <b>{trailing}</b>}</div>
      <ul>{items.map(([label, value], index) => <li key={label}><span>▧ {label}</span><b className={status ? (index === items.length - 1 ? 'is-waiting' : 'is-valid') : ''}>{status && '● '}{value}</b></li>)}</ul>
    </section>
  )
}

function BottomDock({ events, now }) {
  const rows = events.slice(-5).reverse()
  const fallback = [
    ['14:35:22','Frontend Agent','Démarrage de la génération des composants'],
    ['14:35:18','Planner','Mandat décomposé en 5 sous-tâches'],
    ['14:35:15','Hermes','Routage vers Frontend Agent (Claude 3.5 Sonnet)'],
    ['14:35:10','Researcher','Recherche utilisateur terminée'],
    ['14:34:58','Hermes','Mission démarrée par commande externe'],
  ]
  return (
    <section className="reference-dock">
      <div className="dock-main">
        <nav><button className="is-active">Journal des événements</button><button>Terminal</button><button>Ledger</button><button>Artefacts</button><button>Décisions</button></nav>
        <div className="dock-events">
          {(rows.length ? rows.map((event) => [new Date(event.ts).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}), event.data?.name || event.data?.agent || 'Cortex', event.type]) : fallback).map(([time, actor, message]) => (
            <article key={`${time}-${actor}-${message}`}><time>{time}</time><i>{actor.slice(0,1)}</i><strong>{actor}</strong><span>{message}</span></article>
          ))}
        </div>
      </div>
      <pre className="dock-terminal">{`> cortex mission status MIS-2024-05-24-001\n\nMission: Refonte plateforme RH multi-agent\nStatus: Running\nProgress: 62%\nActive Agents: 7\nBudget: €12.45 / €25.00\nTokens: 1,243,672 / 3,000,000\nStart Time: 2024-05-24 12:47:33\nUptime: 2h 47m 12s\n\n>`}</pre>
    </section>
  )
}

function HealthPanel() {
  return (
    <section className="reference-health">
      <header><span className="reference-kicker">SANTÉ DU SYSTÈME</span><strong><i />Tout est opérationnel</strong></header>
      <div className="health-stats"><div><span>AGENTS</span><strong>12/12</strong><small>En ligne</small></div><div><span>SERVICES</span><strong>8/8</strong><small>En ligne</small></div><div><span>MÉMOIRE</span><strong>78%</strong><small>Utilisée</small></div></div>
      <svg viewBox="0 0 300 70" preserveAspectRatio="none"><polyline points="0,50 15,43 27,48 40,39 58,36 76,38 94,30 110,46 126,35 142,37 159,34 177,38 194,35 211,42 228,36 246,32 263,27 281,34 300,25" /></svg>
    </section>
  )
}

export default function App() {
  const { agents, events, missions, summary, connected, lastSync } = useLedger()
  const now = useNow()
  const [active, setActive] = useState('dashboard')
  const [selected, setSelected] = useState(FLOW[3])
  const mission = missions.find((item) => /running|active/i.test(item.status || '')) || missions[0]
  const activeAgents = useMemo(() => agents.filter((agent) => /active|running/i.test(agent.status || '')).length, [agents])
  const progress = clamp(mission?.progress || 62)

  return (
    <div className="app-shell reference-shell">
      <Sidebar active={active} onNavigate={setActive} />
      <main className="reference-app">
        <TopHeader mission={mission} connected={connected} lastSync={lastSync} now={now} />
        <nav className="reference-tabs"><button className="is-active">Vue d’ensemble</button><button>Graphe d’exécution</button><button>Journal des événements</button><button>Artefacts</button><button>Évaluations</button></nav>
        <div className="reference-layout">
          <div className="reference-left-column">
            <MissionSummary mission={mission} summary={summary} progress={progress} agents={agents} />
          </div>
          <div className="reference-center-column">
            <ExecutionCanvas selected={selected} onSelect={setSelected} activeAgents={activeAgents} />
            <BottomDock events={events} now={now} />
          </div>
          <div className="reference-right-column">
            <Inspector selected={selected} />
            <HealthPanel />
          </div>
        </div>
      </main>
    </div>
  )
}
