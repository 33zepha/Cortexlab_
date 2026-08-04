import Badge from './Badge.jsx'
import ReasoningTrace from './ReasoningTrace.jsx'
import { lastMissionTrace } from '../lib/ledger.js'

const TIER_VARIANT = { ceo: 'success', manager: 'running' }

export default function AgentDrawer({ agent, events, onClose }) {
  if (!agent) return null

  const trace = lastMissionTrace(events)
  const isCeo = agent.tier === 'ceo'

  return (
    <div className="fixed inset-0 z-20 flex justify-end">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-black/20"
      />

      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-surface p-6 shadow-overlay">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{agent.name || agent.id}</h2>
              <Badge variant={TIER_VARIANT[agent.tier] || 'warning'}>{agent.tier}</Badge>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              {agent.provider || '—'} · {agent.model || '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le panneau"
            className="rounded-sm px-2 py-1 text-text-muted hover:bg-bg"
          >
            ✕
          </button>
        </div>

        <section className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Task Overview
          </h3>
          <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-text-muted">Rôle</dt>
              <dd>{agent.role || '—'}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Statut</dt>
              <dd>{agent.status || '—'}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Cost index</dt>
              <dd className="font-mono">{agent.cost_index ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Quality index</dt>
              <dd className="font-mono">{agent.quality_index ?? '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 flex-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Reasoning Trace
          </h3>
          {!isCeo && (
            <p className="mt-1 text-xs text-text-muted">
              Ce manager n'émet pas encore d'événements propres — trace de la dernière mission
              orchestrée par Hermes (CEO).
            </p>
          )}
          <div className="mt-3">
            <ReasoningTrace events={trace} />
          </div>
        </section>
      </aside>
    </div>
  )
}
