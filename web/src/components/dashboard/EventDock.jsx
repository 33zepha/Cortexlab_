export default function EventDock({ events }) {
  const rows = events.slice(-5).reverse()

  return (
    <div className="dock-events">
      {rows.map((event) => {
        const time = new Date(event.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        const actor = event.data?.name || event.data?.agent || 'Cortex'
        const message = event.type
        return (
          <article key={`${time}-${actor}-${message}`}><time>{time}</time><i>{actor.slice(0, 1)}</i><strong>{actor}</strong><span>{message}</span></article>
        )
      })}
    </div>
  )
}
