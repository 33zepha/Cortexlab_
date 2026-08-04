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
  return (
    <aside className="mission-summary-card">
      <span className="reference-kicker">ACTIVE MISSION</span>
      <h2>{mission?.name || mission?.mission || 'Refonte plateforme RH'}</h2>
      <p>{mission?.id || 'MIS-2024-05-24-001'}</p>
      <span className="summary-running"><i />Running</span>
      <div className="summary-meter"><span><b style={{ width: `${progress}%` }} /></span><strong>{progress}%</strong></div>
      <div className="summary-divider" />
      <SummaryMetric label="Budget" value={`${budget.cost} / ${budget.limit}`} percent={budget.percent} />
      <SummaryMetric label="Tokens" value={`${tokens.used} / ${tokens.limit}`} percent={tokens.percent} />
      <div className="summary-agent">
        <span className="summary-avatar">H</span>
        <div><strong>{activeAgent?.name || 'Hermes'}</strong><small>Chief of Staff</small></div>
        <b>›</b>
      </div>
    </aside>
  )
}
