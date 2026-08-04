import ExecutionNode from './ExecutionNode.jsx'
import { FLOW, CONNECTIONS } from '../../lib/dashboard-view-model.js'

function statusFor(nodeId, index, selectedId) {
  if (nodeId === 'human') return 'waiting'
  if (selectedId === nodeId) return 'running'
  if (index < 3) return 'done'
  if (index < 7) return 'running'
  return 'queued'
}

export default function ExecutionCanvas({ selected, onSelect, activeAgents }) {
  const point = (id) => FLOW.find((item) => item.id === id)

  return (
    <section className="reference-canvas-panel">
      <div className="canvas-toolbar">
        <button>⌁</button><button>⌕</button><button>⌘</button><button>□</button><button>⌘</button>
      </div>
      <div className="canvas-agent-count">♙ {activeAgents || 7} agents actifs</div>
      <svg className="reference-connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {CONNECTIONS.map(([from, to]) => {
          const a = point(from)
          const b = point(to)
          const mid = (a.y + b.y) / 2
          return <path key={`${from}-${to}`} d={`M ${a.x} ${a.y + 3} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y - 3}`} />
        })}
      </svg>
      {FLOW.map((item, index) => (
        <ExecutionNode
          key={item.id}
          item={item}
          state={statusFor(item.id, index, selected?.id)}
          active={selected?.id === item.id}
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
