export default function EventDock({ events, now }) {
  const rows = events.slice(-5).reverse()
  const fallback = [
    ['14:35:22','Frontend Agent','Démarrage de la génération des composants'],
    ['14:35:18','Planner','Mandat décomposé en 5 sous-tâches'],
    ['14:35:15','Hermes','Routage vers Frontend Agent (Claude 3.5 Sonnet)'],
    ['14:35:10','Researcher','Recherche utilisateur terminée'],
    ['14:34:58','Hermes','Mission démarrée par commande externe'],
  ]

  return (
    <div className="dock-events">
      {(rows.length ? rows.map((event) => [new Date(event.ts).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}), event.data?.name || event.data?.agent || 'Cortex', event.type]) : fallback).map(([time, actor, message]) => (
        <article key={`${time}-${actor}-${message}`}><time>{time}</time><i>{actor.slice(0,1)}</i><strong>{actor}</strong><span>{message}</span></article>
      ))}
    </div>
  )
}
