export default function Topbar({ title, onRunMission, running }) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="Rechercher un agent, une mission…"
          aria-label="Rechercher"
          className="w-64 rounded-sm border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="button"
          className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text hover:bg-bg"
        >
          Filters
        </button>
        <button
          type="button"
          onClick={onRunMission}
          disabled={running}
          className="rounded-sm bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? 'Exécution…' : '+ Run Mission'}
        </button>
      </div>
    </header>
  )
}
