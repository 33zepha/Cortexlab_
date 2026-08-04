import Badge from './Badge.jsx'
import ReasoningTrace from './ReasoningTrace.jsx'
import { lastMissionTrace, agentActivity, relativeTime } from '../lib/ledger.js'

const TIER_VARIANT = { ceo: 'success', manager: 'running' }

export default function AgentDrawer({ agent, events, now, onClose }) {
  if (!agent) return null

  const isCeo = agent.tier === 'ceo'
  const activity = agentActivity(agent.id, events)
  // A manager's trace is its own mandates; Hermes orchestrates the whole mission.
  const trace = isCeo
    ? lastMissionTrace(events)
    : events.filter(
        (e) =>
          (e.type === 'agent.assigned' || e.type === 'agent.result') &&
          e.data?.agent === agent.id
      )

  return (
    <div className="fixed inset-0 z-20 flex justify-end">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-[#17191C]/35"
      />

      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border-strong bg-surface shadow-overlay">
        <div className="flex items-start justify-between border-b border-border p-6">
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
            className="rounded-sm border border-transparent px-2 py-1 text-text-muted hover:border-border hover:bg-sub-surface hover:text-text"
          >
            ✕
          </button>
        </div>

        <section className="border-b border-border p-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Mandat en cours
          </h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 rounded-md border border-border bg-sub-surface p-4 text-sm">
            {isCeo ? (
              <div className="col-span-2">
                <dt className="text-text-muted">Rôle</dt>
                <dd>Orchestre les mandats et décide la closure — ne s'exécute pas (INV-001).</dd>
              </div>
            ) : activity.hasHistory ? (
              <>
                <div>
                  <dt className="text-text-muted">Règle</dt>
                  <dd className="font-mono text-xs">{activity.rule || '—'}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Mission</dt>
                  <dd>{activity.mission || '—'}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">État</dt>
                  <dd className={activity.lastResult?.violation ? 'text-error' : ''}>
                    {activity.running
                      ? 'en cours'
                      : activity.lastResult?.violation
                        ? `bloqué · ${activity.lastResult.findings} finding(s)`
                        : 'conforme'}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted">Depuis</dt>
                  <dd>{activity.since ? relativeTime(activity.since, now) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Mandats · coût</dt>
                  <dd className="font-mono">
                    {activity.mandates} · {activity.cost}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted">Durée dernier run</dt>
                  <dd className="font-mono">
                    {activity.lastResult?.durationMs != null
                      ? `${activity.lastResult.durationMs} ms`
                      : '—'}
                  </dd>
                </div>
              </>
            ) : (
              <div className="col-span-2 text-text-muted">
                Aucun mandat reçu — cet agent n'a pas encore été routé sur une mission de son
                domaine.
              </div>
            )}
          </dl>
        </section>

        <section className="border-b border-border p-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Pourquoi ce modèle
          </h3>
          <p className="mt-2 text-sm">
            {activity.rationale ||
              (isCeo
                ? "Hermes est le Chief of Staff : il n'est pas routé, il route."
                : 'Pas encore de décision de routage enregistrée pour cet agent.')}
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-3 rounded-md border border-border bg-sub-surface p-4 text-sm">
            <div>
              <dt className="text-text-muted">Coût</dt>
              <dd className="font-mono">{agent.cost_index ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Qualité</dt>
              <dd className="font-mono">{agent.quality_index ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Ratio</dt>
              <dd className="font-mono">
                {agent.cost_index && agent.quality_index
                  ? Math.round((agent.quality_index / agent.cost_index) * 100) / 100
                  : '—'}
              </dd>
            </div>
            <div className="col-span-3">
              <dt className="text-text-muted">Aptitudes</dt>
              <dd>{agent.strengths?.length ? agent.strengths.join(' · ') : '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="flex-1 p-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Reasoning Trace
          </h3>
          <p className="mt-1 text-xs text-text-muted">
            {isCeo
              ? 'Dernière mission orchestrée, de bout en bout.'
              : 'Mandats confiés à cet agent et leurs résultats.'}
          </p>
          <div className="mt-3">
            <ReasoningTrace events={trace} />
          </div>
        </section>
      </aside>
    </div>
  )
}
