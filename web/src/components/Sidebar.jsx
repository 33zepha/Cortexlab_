import Icon from './Icon.jsx'

const NAVIGATION = [
  ['dashboard', 'Vue d’ensemble', 'grid'],
  ['system', 'Santé système', 'gear'],
  ['missions', 'Missions', 'target'],
  ['agents', 'Agents', 'users'],
  ['activity', 'Activité', 'pulse'],
]

export default function Sidebar({ active = 'dashboard', onNavigate = () => {} }) {
  return (
    <aside className="sidebar-shell">
      <div className="brand-row">
        <span className="brand-mark" aria-hidden="true"><i /></span>
        <span className="brand-name">Cortex</span>
      </div>

      <nav className="sidebar-nav" aria-label="Navigation principale">
        <div className="sidebar-group">
          <span className="sidebar-group-label">Observation</span>
          {NAVIGATION.map(([id, label, icon]) => (
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
