function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0))
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

export default function MissionSummary({ mission, summary, progress, agents }) {
  const budgetPct = summary.budget_limit > 0 ? clamp((summary.budget_cost / summary.budget_limit) * 100) : 49
  return (
    <aside className="mission-summary-card">
      <span className="reference-kicker">ACTIVE MISSION</span>
      <h2>{mission?.name || mission?.mission || 'Refonte plateforme RH'}</h2>
      <p>{mission?.id || 'MIS-2024-05-24-001'}</p>
      <span className="summary-running"><i />Running</span>
      <div className="summary-meter"><span><b style={{ width: `${progress}%` }} /></span><strong>{progress}%</strong></div>
      <div className="summary-divider" />
      <SummaryMetric label="Budget" value={`€${(summary.budget_cost || 12.45).toFixed(2).replace('.', ',')} / €${(summary.budget_limit || 25).toFixed(2).replace('.', ',')}`} percent={budgetPct} />
      <SummaryMetric label="Tokens" value="1.24M / 3M" percent={41} />
      <div className="summary-agent">
        <span className="summary-avatar">H</span>
        <div><strong>{agents[0]?.name || 'Hermes'}</strong><small>Chief of Staff</small></div>
        <b>›</b>
      </div>
    </aside>
  )
}
