import Icon from './Icon.jsx'

// Target information architecture, grouped by what you actually do day to day.
// Only `built: true` entries render — a nav full of destinations that go nowhere
// reads as a template, not a product. Flip the flag when the view ships.
const NAV = [
  {
    group: 'Control',
    items: [
      { id: 'overview', label: 'Overview', icon: 'grid', built: true },
      { id: 'missions', label: 'Missions', icon: 'target', built: false },
      { id: 'agents', label: 'Agents', icon: 'users', countKey: 'agents', built: true },
      { id: 'approvals', label: 'Approvals', icon: 'alert', countKey: 'approvals', built: false },
    ],
  },
  {
    group: 'Observe',
    items: [
      { id: 'activity', label: 'Activity', icon: 'pulse', built: false },
      { id: 'ledger', label: 'Ledger', icon: 'list', built: false },
      { id: 'usage', label: 'Usage', icon: 'chart', built: false },
    ],
  },
  {
    group: 'System',
    items: [
      { id: 'rules', label: 'Rules', icon: 'shield', built: false },
      { id: 'connections', label: 'Connections', icon: 'link', built: false },
      { id: 'settings', label: 'Settings', icon: 'gear', built: false },
    ],
  },
]

function StatusRow({ label, value, accent }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 text-xs">
      <span className="text-text-muted">{label}</span>
      <span className={`font-mono font-medium ${accent || 'text-text'}`}>{value}</span>
    </div>
  )
}

export default function Sidebar({ active, onNavigate, counts, connected }) {
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.built) })).filter(
    (g) => g.items.length > 0
  )

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex-1">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-white">
              ◈
            </span>
            <span className="font-semibold tracking-tight">Cortex Lab</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 pl-0.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-success' : 'bg-text-muted'}`}
              aria-hidden="true"
            />
            <span className="text-xs text-text-muted">
              {connected ? 'Runtime online' : 'Runtime hors ligne'}
            </span>
          </div>
        </div>

        <nav className="flex flex-col gap-4 p-3">
          {groups.map((group) => (
            <div key={group.group}>
              <span className="mb-1.5 block px-2 text-xs font-semibold text-text-muted">
                {group.group}
              </span>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const isActive = item.id === active
                  const count = item.countKey ? counts?.[item.countKey] : undefined
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex items-center gap-2.5 rounded-sm border px-2 py-1.5 text-sm ${
                        isActive
                          ? 'border-border bg-surface font-semibold text-primary shadow-card'
                          : 'border-transparent text-text-muted hover:border-border hover:bg-sub-surface hover:text-text'
                      }`}
                    >
                      <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {count != null && (
                        <span
                          className={`font-mono text-xs ${isActive ? 'text-primary' : 'text-text-muted'}`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Live runtime readouts — state, not navigation. */}
        <div className="mx-3 rounded-md border border-border bg-sub-surface py-1">
          <StatusRow label="Missions 24h" value={counts?.missions24h ?? '—'} />
          <StatusRow
            label="Approbations"
            value={counts?.approvals ?? '—'}
            accent={counts?.approvals > 0 ? 'text-error' : undefined}
          />
          <StatusRow label="Dernier run" value={counts?.lastRun ?? '—'} />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
          D
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-medium">drix</span>
          <span className="text-xs text-text-muted">Gouverneur</span>
        </div>
      </div>
    </aside>
  )
}
