import Icon from './Icon.jsx'

const GROUPS = [
  {
    label: 'Monitor',
    items: [
      ['dashboard', 'Dashboard', 'grid'],
      ['activity', 'Activity', 'pulse'],
      ['live', 'Live', 'activity'],
      ['history', 'History', 'clock'],
    ],
  },
  {
    label: 'Orchestrate',
    items: [
      ['agents', 'Agents', 'users'],
      ['missions', 'Missions', 'target'],
      ['playbooks', 'Playbooks', 'list'],
    ],
  },
  {
    label: 'Delegate',
    items: [
      ['integrations', 'Integrations', 'link'],
      ['events', 'Events', 'flag'],
    ],
  },
  {
    label: 'Analytics',
    items: [
      ['reports', 'Reports', 'chart'],
      ['cost', 'Cost', 'gauge'],
      ['usage', 'Usage', 'pulse'],
    ],
  },
]

export default function Sidebar({ active = 'dashboard', onNavigate = () => {} }) {
  return (
    <aside className="sidebar-shell">
      <div className="brand-row">
        <span className="brand-mark">◇</span>
        <span className="brand-name">Cortex</span>
      </div>

      <nav className="sidebar-nav" aria-label="Navigation principale">
        {GROUPS.map((group) => (
          <div className="sidebar-group" key={group.label}>
            <span className="sidebar-group-label">{group.label}</span>
            {group.items.map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                className={`sidebar-item ${active === id ? 'is-active' : ''}`}
                aria-current={active === id ? 'page' : undefined}
              >
                <Icon name={icon} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="profile-row">
        <span className="profile-avatar">D</span>
        <span className="profile-copy">
          <strong>drix</strong>
          <small>Gouverneur</small>
        </span>
        <Icon name="chevron" className="profile-chevron" />
      </div>
    </aside>
  )
}
