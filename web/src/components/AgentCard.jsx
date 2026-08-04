import Card from './Card.jsx'
import Badge from './Badge.jsx'
import Icon from './Icon.jsx'
import { relativeTime } from '../lib/ledger.js'

const TIER_VARIANT = { ceo: 'success', manager: 'running' }

/** Headline answers "what is it doing", not "how is it configured". */
function Headline({ activity, isCeo, now }) {
  if (isCeo) {
    return (
      <>
        <p className="text-sm font-medium">Orchestre les mandats</p>
        <p className="text-xs text-text-muted">décide la closure · ne s'exécute pas (INV-001)</p>
      </>
    )
  }

  if (activity.running) {
    return (
      <>
        <p className="text-sm font-medium">
          {activity.rule}
          {activity.mission ? ` · ${activity.mission}` : ''}
        </p>
        <p className="text-xs text-text-muted">
          en cours{activity.since ? ` · ${relativeTime(activity.since, now)}` : ''}
        </p>
      </>
    )
  }

  if (activity.lastResult) {
    const r = activity.lastResult
    return (
      <>
        <p className="text-sm font-medium">
          {r.rule}
          {activity.mission ? ` · ${activity.mission}` : ''}
        </p>
        <p className="text-xs text-text-muted">
          {r.violation ? `bloqué · ${r.findings} finding(s)` : 'conforme'} ·{' '}
          {relativeTime(r.ts, now)}
        </p>
      </>
    )
  }

  return (
    <>
      <p className="text-sm font-medium text-text-muted">Aucun mandat reçu</p>
      <p className="text-xs text-text-muted">en attente d'une mission de son domaine</p>
    </>
  )
}

export default function AgentCard({ agent, activity, now, onClick }) {
  const isCeo = agent.tier === 'ceo'
  const blocked = activity.lastResult?.violation && !activity.running

  // "inactif" would be wrong for an agent that is simply not being routed to.
  const status = isCeo
    ? { variant: 'success', label: 'orchestre' }
    : agent.status !== 'active'
      ? { variant: 'warning', label: agent.status }
      : activity.running
        ? { variant: 'running', label: 'en cours' }
        : blocked
          ? { variant: 'error', label: 'bloqué' }
          : activity.hasHistory
            ? { variant: 'success', label: 'disponible' }
            : { variant: 'running', label: 'en attente' }

  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card
        className={`flex h-full flex-col gap-3 transition-colors hover:border-border-strong ${
          blocked ? 'border-error' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{agent.name || agent.id}</span>
            <Badge variant={TIER_VARIANT[agent.tier] || 'warning'}>{agent.tier}</Badge>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        <div className="min-h-[2.5rem]">
          <Headline activity={activity} isCeo={isCeo} now={now} />
        </div>

        <div className="mt-auto grid grid-cols-3 divide-x divide-border rounded-md border border-border bg-sub-surface">
          <div className="flex flex-col px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Mandats
            </span>
            <span className="font-mono text-sm">{activity.mandates}</span>
          </div>
          <div className="flex flex-col px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Coût
            </span>
            <span className="font-mono text-sm">{activity.cost || '—'}</span>
          </div>
          <div className="flex flex-col px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Violations
            </span>
            <span className={`font-mono text-sm ${activity.violations ? 'text-error' : ''}`}>
              {activity.violations}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 border-t border-border pt-3 text-xs text-text-muted">
          <Icon name="target" className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {agent.strengths?.length ? agent.strengths.join(' · ') : agent.model || '—'}
          </span>
        </div>
      </Card>
    </button>
  )
}
