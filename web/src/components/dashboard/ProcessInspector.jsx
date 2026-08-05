import Icon from '../Icon.jsx'

function InspectorText({ title, children }) {
  return <section className="inspector-block"><span className="reference-kicker">{title}</span><p>{children}</p></section>
}

const PENDING_PATTERN = /attente|cours/i

function InspectorList({ title, trailing, items, status }) {
  return (
    <section className="inspector-block">
      <div className="inspector-label-row"><span className="reference-kicker">{title}</span>{trailing && <b>{trailing}</b>}</div>
      <ul>{items.map(([label, value]) => {
        const pending = status && PENDING_PATTERN.test(String(value))
        return (
          <li key={label}>
            <span>{label}</span>
            <b className={status ? (pending ? 'is-waiting' : 'is-valid') : ''}>{value}</b>
          </li>
        )
      })}</ul>
    </section>
  )
}

export default function ProcessInspector({ inspector, onClose }) {
  const { item, progress, duration, cost, tokens, model, mandate, context, contextTokens, evidence, dependencies } = inspector

  return (
    <aside className="reference-inspector">
      <header>
        <span className="inspector-icon">{item.label.slice(0, 1)}</span>
        <strong>{item.label}</strong>
        <button type="button" onClick={onClose} aria-label="Fermer l'inspecteur"><Icon name="close" /></button>
      </header>
      <section className="inspector-block inspector-state">
        <span className="reference-kicker">STATUT</span>
        <div><strong><i />En cours d'exécution</strong><b>{progress}%</b></div>
        <em><i style={{ width: `${progress}%` }} /></em>
      </section>
      <section className="inspector-stats">
        <div><span>DURÉE</span><strong>{duration}</strong></div><div><span>COÛT</span><strong>{cost}</strong></div><div><span>TOKENS</span><strong>{tokens}</strong></div><div><span>MODÈLE</span><strong>{model}</strong></div>
      </section>
      <InspectorText title="MANDAT">{mandate}</InspectorText>
      <InspectorList title="CONTEXTE" trailing={contextTokens} items={context} />
      <InspectorList title="PREUVES" items={evidence} status />
      <InspectorList title="DÉPENDANCES" items={dependencies} status />
      <footer>
        <button type="button" className="is-primary" disabled title="Bientôt disponible"><Icon name="play" className="micro-icon" />Intervenir</button>
        <button type="button" disabled title="Bientôt disponible"><Icon name="pause" className="micro-icon" />Pause</button>
        <button type="button" className="danger" disabled title="Bientôt disponible"><Icon name="stop" className="micro-icon" />Arrêter</button>
      </footer>
    </aside>
  )
}
