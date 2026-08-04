import { FLOW } from '../../lib/dashboard-view-model.js'

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

export default function ProcessInspector({ selected }) {
  const item = selected || FLOW[3]

  return (
    <aside className="reference-inspector">
      <header><span className="inspector-icon">{item.label.slice(0, 1)}</span><strong>{item.label}</strong><button>×</button></header>
      <section className="inspector-block inspector-state">
        <span className="reference-kicker">STATUT</span>
        <div><strong><i />En cours d'exécution</strong><b>80%</b></div>
        <em><i /></em>
      </section>
      <section className="inspector-stats">
        <div><span>DURÉE</span><strong>1h 24m 17s</strong></div><div><span>COÛT</span><strong>€0.18</strong></div><div><span>TOKENS</span><strong>243,672</strong></div><div><span>MODÈLE</span><strong>Claude 3.5 Sonnet</strong></div>
      </section>
      <InspectorText title="MANDAT">Créer l'interface utilisateur pour le tableau de bord RH en respectant le design system et les composants existants.</InspectorText>
      <InspectorList title="CONTEXTE" trailing="3,240 tokens" items={[['Bundle: RH Platform Guidelines','v2.1'],['Figma: Dashboard Design','Updated'],['Codebase: /frontend/src','Latest']]} />
      <InspectorList title="PREUVES (2/3)" items={[['UI Components','Validé'],['Storybook','Validé'],['Tests E2E','En attente']]} status />
      <InspectorList title="DÉPENDANCES" items={[['Design System','Terminé'],['API Contracts','En cours']]} status />
      <footer><button>▷ Intervenir</button><button>Ⅱ Mettre en pause</button><button className="danger">▱ Arrêter</button></footer>
    </aside>
  )
}
