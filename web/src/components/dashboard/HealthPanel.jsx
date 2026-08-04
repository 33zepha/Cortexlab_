export default function HealthPanel({ health }) {
  const { status, agents, services, memory } = health
  return (
    <section className="reference-health">
      <header><span className="reference-kicker">SANTÉ DU SYSTÈME</span><strong><i />{status}</strong></header>
      <div className="health-stats"><div><span>AGENTS</span><strong>{agents.online}/{agents.total}</strong><small>En ligne</small></div><div><span>SERVICES</span><strong>{services.online}/{services.total}</strong><small>En ligne</small></div><div><span>MÉMOIRE</span><strong>{memory}%</strong><small>Utilisée</small></div></div>
      <svg viewBox="0 0 300 70" preserveAspectRatio="none"><polyline points="0,50 15,43 27,48 40,39 58,36 76,38 94,30 110,46 126,35 142,37 159,34 177,38 194,35 211,42 228,36 246,32 263,27 281,34 300,25" /></svg>
    </section>
  )
}
