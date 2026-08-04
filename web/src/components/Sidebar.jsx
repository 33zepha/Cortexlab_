import Icon from './Icon.jsx'

// Section 1/2 of docs/UI_VISION.md: seven business spaces + a separated
// System/Settings utility zone. Only Overview ships with a real view in this
// PR — everything else is a real, present entry marked as not-yet-available
// rather than a dead link or a page full of invented data.
const BUSINESS_SPACES = [
  { id: 'overview', label: 'Overview', icon: 'grid', path: '/', enabled: true },
  { id: 'missions', label: 'Missions', icon: 'target', enabled: false },
  { id: 'agents', label: 'Agents', icon: 'users', enabled: false },
  { id: 'memory', label: 'Memory', icon: 'book', enabled: false },
  { id: 'skills', label: 'Skills', icon: 'layers', enabled: false },
  { id: 'automations', label: 'Automations', icon: 'zap', enabled: false },
  { id: 'results', label: 'Results', icon: 'box', enabled: false },
  { id: 'evaluations', label: 'Evaluations', icon: 'gauge', enabled: false },
]

const UTILITY_SPACES = [
  { id: 'system', label: 'System', icon: 'shield', enabled: false },
  { id: 'settings', label: 'Settings', icon: 'gear', enabled: false },
]

function NavItem({ item, active, onNavigate }) {
  if (!item.enabled) {
    return (
      <span className="sidebar-item is-disabled" aria-disabled="true" title="Bientôt disponible">
        <Icon name={item.icon} />
        <span>{item.label}</span>
        <small className="sidebar-item-soon">Bientôt</small>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.path)}
      className={`sidebar-item ${active ? 'is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon name={item.icon} />
      <span>{item.label}</span>
    </button>
  )
}

export default function Sidebar({ activeSpace = 'overview', onNavigate = () => {}, open = false, onClose = () => {} }) {
  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside className={`sidebar-shell ${open ? 'is-open' : ''}`}>
        <div className="brand-row">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <span className="brand-name">Cortex Lab</span>
          <button type="button" className="sidebar-close" onClick={onClose} aria-label="Fermer la navigation">
            <Icon name="close" />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Navigation principale">
          <div className="sidebar-group">
            <span className="sidebar-group-label">Espaces</span>
            {BUSINESS_SPACES.map((item) => (
              <NavItem key={item.id} item={item} active={activeSpace === item.id} onNavigate={onNavigate} />
            ))}
          </div>
        </nav>

        <div className="sidebar-utility">
          <span className="sidebar-group-label">Système</span>
          {UTILITY_SPACES.map((item) => (
            <NavItem key={item.id} item={item} active={activeSpace === item.id} onNavigate={onNavigate} />
          ))}
        </div>

        <div className="profile-row">
          <span className="profile-avatar">D</span>
          <span className="profile-copy">
            <strong>drix</strong>
            <small>Gouverneur</small>
          </span>
          <Icon name="chevron" className="profile-chevron" />
        </div>
      </aside>
    </>
  )
}
