import Card from './Card.jsx'
import Badge from './Badge.jsx'

const TIER_VARIANT = { ceo: 'success', manager: 'running' }

export default function AgentCard({ agent, onClick }) {
  const active = agent.status === 'active'
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className="flex h-full flex-col gap-3 transition-colors hover:border-border-strong">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{agent.name || agent.id}</span>
          <Badge variant={TIER_VARIANT[agent.tier] || 'warning'}>{agent.tier || 'agent'}</Badge>
        </div>

        <div className="text-sm text-text-muted">
          {agent.provider || '—'} · {agent.model || '—'}
        </div>
        <div className="text-sm text-text">{agent.role || '—'}</div>

        <div className="mt-auto grid grid-cols-2 divide-x divide-border rounded-md border border-border bg-sub-surface">
          <div className="flex flex-col px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Cost</span>
            <span className="font-mono text-sm">{agent.cost_index ?? '—'}</span>
          </div>
          <div className="flex flex-col px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Quality</span>
            <span className="font-mono text-sm">{agent.quality_index ?? '—'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <span
            className={`h-2 w-2 rounded-full ${active ? 'bg-success' : 'bg-border'}`}
            aria-hidden="true"
          />
          <span className="text-xs font-medium text-text-muted">
            {active ? 'Actif' : agent.status || 'inconnu'}
          </span>
        </div>
      </Card>
    </button>
  )
}
