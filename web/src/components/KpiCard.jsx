import Card from './Card.jsx'
import Icon from './Icon.jsx'

// Tone carries meaning, not decoration: a card only turns red when something
// actually needs a human (INV-006), so colour stays trustworthy.
const TONES = {
  neutral: { card: '', value: 'text-text', icon: 'text-text-muted' },
  success: { card: '', value: 'text-text', icon: 'text-success' },
  warning: { card: 'border-warning', value: 'text-warning', icon: 'text-warning' },
  // `!` so the tint wins over Card's default surface, whatever the CSS order.
  error: { card: 'border-error !bg-error-bg', value: 'text-error', icon: 'text-error' },
}

const BARS = {
  neutral: 'bg-border-strong',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
}

function Delta({ value, unit = 'pts' }) {
  if (value == null || value === 0) return null
  const up = value > 0
  return (
    <span className={`text-xs font-medium ${up ? 'text-success' : 'text-error'}`}>
      {up ? '↗' : '↘'} {up ? '+' : ''}
      {value} {unit}
    </span>
  )
}

export default function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = 'neutral',
  delta,
  progress,
  progressTone = 'neutral',
  compact = false,
}) {
  const t = TONES[tone] || TONES.neutral

  return (
    <Card className={`flex flex-col gap-1 ${t.card}`}>
      <div className="flex items-center gap-1.5">
        {icon && <Icon name={icon} className={`h-3.5 w-3.5 ${t.icon}`} />}
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className={`font-bold tracking-tight ${compact ? 'text-xl' : 'text-3xl'} ${t.value}`}
        >
          {value}
        </span>
        {delta != null && <Delta value={delta} />}
      </div>

      {progress != null && (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className={`h-full rounded-full ${BARS[progressTone] || BARS.neutral}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}

      {sub && <span className="mt-0.5 text-xs text-text-muted">{sub}</span>}
    </Card>
  )
}
