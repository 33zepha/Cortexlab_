const TABS = [
  ['Vue d’ensemble', true],
  ['Graphe d’exécution', false],
  ['Journal des événements', false],
  ['Results', false],
  ['Evaluations', false],
]

export default function MissionTabs() {
  return (
    <nav className="reference-tabs">
      {TABS.map(([label, enabled]) => (
        <button
          key={label}
          type="button"
          className={enabled ? 'is-active' : 'is-disabled'}
          disabled={!enabled}
          title={enabled ? undefined : 'Bientôt disponible'}
        >
          {label}
        </button>
      ))}
    </nav>
  )
}
