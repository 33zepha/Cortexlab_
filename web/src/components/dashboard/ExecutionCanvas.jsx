import ExecutionNode from './ExecutionNode.jsx'

export default function ExecutionCanvas({ graph, onSelect }) {
  const { nodes, edges, selectedNodeId, activeAgentCount } = graph

  return (
    <section className="reference-canvas-panel">
      <div className="canvas-toolbar">
        <button>⌁</button><button>⌕</button><button>⌘</button><button>□</button><button>⌘</button>
      </div>
      <div className="canvas-agent-count">♙ {activeAgentCount || 7} agents actifs</div>
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
      <div className="canvas-zoom"><button>−</button><span>100%</span><button>+</button></div>
      <button className="canvas-fit">⛶</button>
      <button className="canvas-lock">♙</button>
      <div className="canvas-minimap"><span /><span /><span /><span /><span /><span /></div>
    </section>
  )
}
