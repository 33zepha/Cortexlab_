import ExecutionNode from './ExecutionNode.jsx'
import Icon from '../Icon.jsx'

export default function ExecutionCanvas({ graph, onSelect }) {
  const { nodes, edges, selectedNodeId, activeAgentCount } = graph

  return (
    <section className="reference-canvas-panel">
      <div className="canvas-toolbar">
        <button type="button" aria-label="Sélectionner"><Icon name="crosshair" /></button>
        <button type="button" aria-label="Rechercher"><Icon name="search" /></button>
        <button type="button" aria-label="Réorganiser"><Icon name="layers" /></button>
        <button type="button" aria-label="Cadre"><Icon name="expand" /></button>
        <button type="button" aria-label="Actualiser"><Icon name="refresh" /></button>
      </div>
      <div className="canvas-agent-count"><Icon name="users" className="micro-icon" /> {activeAgentCount || 0} agents actifs</div>
      <svg className="reference-connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {edges.map(({ from, to, fromPoint, toPoint }) => {
          const mid = (fromPoint.y + toPoint.y) / 2
          return <path key={`${from}-${to}`} d={`M ${fromPoint.x} ${fromPoint.y + 3} C ${fromPoint.x} ${mid}, ${toPoint.x} ${mid}, ${toPoint.x} ${toPoint.y - 3}`} />
        })}
      </svg>
      {nodes.map((item) => (
        <ExecutionNode
          key={item.id}
          item={item}
          state={item.state}
          active={selectedNodeId === item.id}
          onSelect={onSelect}
        />
      ))}
      <div className="canvas-zoom">
        <button type="button" aria-label="Zoom arrière"><Icon name="minus" /></button>
        <span>100%</span>
        <button type="button" aria-label="Zoom avant"><Icon name="plus" /></button>
      </div>
      <button type="button" className="canvas-fit" aria-label="Ajuster à l'écran"><Icon name="expand" /></button>
      <button type="button" className="canvas-lock" aria-label="Verrouiller la vue"><Icon name="lock" /></button>
      <div className="canvas-minimap" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>
    </section>
  )
}
