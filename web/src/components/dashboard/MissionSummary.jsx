function SummaryMetric({ label, value, percent }) {
  return (
    <section className="summary-metric">
      <span>{label}</span>
      <div><strong>{value}</strong><b>{Math.round(percent)}%</b></div>
      <i><em style={{ width: `${percent}%` }} /></i>
    </section>
  )
}

export default function MissionSummary({ summary }) {
  const { mission, progress, budget, tokens, activeAgent } = summary
  const isRunning = /running|active/i.test(mission?.status || '')
  return (
    <aside className="mission-summary-card">
      <span className="reference-kicker">ACTIVE MISSION</span>
      <h2>{mission?.name || mission?.mission || 'Aucune mission active'}</h2>
      <p>{mission?.id || '—'}</p>
      <span className="summary-running"><i />{mission ? (isRunning ? 'Running' : mission.status) : 'Hors ligne'}</span>
      <div className="summary-meter"><span><b style={{ width: `${progress}%` }} /></span><strong>{progress}%</strong></div>
      <div className="summary-divider" />
      <SummaryMetric label="Budget" value={`${budget.cost} / ${budget.limit}`} percent={budget.percent} />
      <SummaryMetric label="Tokens" value={`${tokens.used} / ${tokens.limit}`} percent={tokens.percent} />
      <div className="summary-agent">
        <span className="summary-avatar">{activeAgent?.name?.slice(0, 1) || 'H'}</span>
        <div><strong>{activeAgent?.name || 'Hermes'}</strong><small>{activeAgent?.role || 'Chief of Staff'}</small></div>
        <b>›</b>
      </div>
    </aside>
  )
}
