// Same placeholder series as before (see dashboard-view-model.js) — only the
// rendering is upgraded: a smoothed Catmull-Rom curve with a soft area fill
// instead of a raw polyline, to match the rest of the finish pass.
const POINTS = [
  [0, 50], [15, 43], [27, 48], [40, 39], [58, 36], [76, 38], [94, 30], [110, 46],
  [126, 35], [142, 37], [159, 34], [177, 38], [194, 35], [211, 42], [228, 36],
  [246, 32], [263, 27], [281, 34], [300, 25],
]

function smoothPath(points) {
  if (points.length < 2) return ''
  let d = `M ${points[0][0]},${points[0][1]}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`
  }
  return d
}

const LINE_PATH = smoothPath(POINTS)
const LAST_X = POINTS[POINTS.length - 1][0]
const AREA_PATH = `${LINE_PATH} L ${LAST_X},70 L 0,70 Z`

export default function HealthPanel({ health }) {
  const { status, agents, services, memory } = health
  return (
    <section className="reference-health">
      <header><span className="reference-kicker">SANTÉ DU SYSTÈME</span><strong><i />{status}</strong></header>
      <div className="health-stats">
        <div><span>AGENTS</span><strong>{agents.online}/{agents.total}</strong><small>En ligne</small></div>
        <div><span>SERVICES</span><strong>{services.online}/{services.total}</strong><small>En ligne</small></div>
        <div><span>MÉMOIRE</span><strong>{memory}%</strong><small>Utilisée</small></div>
      </div>
      <svg className="health-spark" viewBox="0 0 300 70" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="health-spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={AREA_PATH} fill="url(#health-spark-fill)" stroke="none" />
        <path d={LINE_PATH} fill="none" className="health-spark-line" />
        <circle cx={LAST_X} cy={POINTS[POINTS.length - 1][1]} r="3" className="health-spark-dot" />
      </svg>
    </section>
  )
}
