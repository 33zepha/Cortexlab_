function InspectorText({ title, children }) {
  return <section className="inspector-block"><span className="reference-kicker">{title}</span><p>{children}</p></section>
}

function InspectorList({ title, trailing, items, status }) {
  return (
    <section className="inspector-block">
      <div className="inspector-label-row"><span className="reference-kicker">{title}</span>{trailing && <b>{trailing}</b>}</div>
      <ul>{items.map(([label, value], index) => <li key={label}><span>▧ {label}</span><b className={status ? (index === items.length - 1 ? 'is-waiting' : 'is-valid') : ''}>{status && '● '}{value}</b></li>)}</ul>
    </section>
  )
}

export default function ProcessInspector({ inspector }) {
  const { item, progress, duration, cost, tokens, model, mandate, context, contextTokens, evidence, dependencies } = inspector

  return (
    <aside className="reference-inspector">
      <header><span className="inspector-icon">{item.label.slice(0, 1)}</span><strong>{item.label}</strong><button>×</button></header>
      <section className="inspector-block inspector-state">
        <span className="reference-kicker">STATUT</span>
        <div><strong><i />En cours d'exécution</strong><b>{progress}%</b></div>
        <em><i /></em>
      </section>
      <section className="inspector-stats">
        <div><span>DURÉE</span><strong>{duration}</strong></div><div><span>COÛT</span><strong>{cost}</strong></div><div><span>TOKENS</span><strong>{tokens}</strong></div><div><span>MODÈLE</span><strong>{model}</strong></div>
      </section>
      <InspectorText title="MANDAT">{mandate}</InspectorText>
      <InspectorList title="CONTEXTE" trailing={contextTokens} items={context} />
      <InspectorList title="PREUVES (2/3)" items={evidence} status />
      <InspectorList title="DÉPENDANCES" items={dependencies} status />
      <footer><button>▷ Intervenir</button><button>Ⅱ Mettre en pause</button><button className="danger">▱ Arrêter</button></footer>
    </aside>
  )
}
