const NAV_GROUPS = [
  { label: 'Monitor', items: ['Dashboard', 'Activity', 'Live', 'History'] },
  { label: 'Orchestrate', items: ['Agents', 'Missions', 'Playbooks'] },
  { label: 'Delegate', items: ['Integrations', 'Events'] },
  { label: 'Analytics', items: ['Reports', 'Cost', 'Usage'] },
]

export default function Sidebar({ active = 'Dashboard' }) {
  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col justify-between border-r border-border bg-surface">
      <div>
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="text-xl text-primary">◈</span>
          <span className="text-lg font-bold">Cortex</span>
        </div>

        <nav className="flex flex-col gap-5 px-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <span className="mb-1 block px-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                {group.label}
              </span>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase()}`}
                    className={`rounded-sm px-2 py-1.5 text-sm ${
                      item === active
                        ? 'bg-bg font-medium text-primary'
                        : 'text-text-muted hover:bg-bg hover:text-text'
                    }`}
                  >
                    {item}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2 border-t border-border px-5 py-4">
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
