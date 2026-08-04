import Badge from './Badge.jsx'
import Icon from './Icon.jsx'
import { describeEvent, shortTs } from '../lib/ledger.js'

export default function ReasoningTrace({ events }) {
  if (!events.length) {
    return <p className="text-sm text-text-muted">Aucune mission enregistrée pour le moment.</p>
  }

  return (
    <ol className="flex flex-col gap-4">
      {events.map((e, i) => {
        const { icon, title, detail, variant, badgeLabel } = describeEvent(e)
        return (
          <li key={e.hash || i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg text-text-muted">
                <Icon name={icon} />
              </span>
              {i < events.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{title}</span>
                <span className="font-mono text-xs text-text-muted">{shortTs(e.ts)}</span>
              </div>
              <p className="mt-0.5 text-sm text-text-muted">{detail}</p>
              {badgeLabel && (
                <Badge variant={variant} className="mt-1">
                  {badgeLabel}
                </Badge>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
