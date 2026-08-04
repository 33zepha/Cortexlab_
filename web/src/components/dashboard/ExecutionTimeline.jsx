// Mobile companion to ExecutionCanvas: a vertical, readable list of the same
// nodes instead of a compressed spatial graph. Shown only under the mobile
// breakpoint (see .execution-timeline in index.css); ExecutionCanvas is
// hidden there instead of being scaled down.
export default function ExecutionTimeline({ graph, onSelect }) {
  const { nodes, selectedNodeId } = graph

  return (
    <section className="execution-timeline">
      {nodes.map((item, index) => (
        <button
          type="button"
          key={item.id}
          className={`timeline-step state-${item.state}${selectedNodeId === item.id ? ' is-active' : ''}`}
          onClick={() => onSelect(item)}
        >
          <span className="timeline-step-index">{index + 1}</span>
          <span className="timeline-step-icon">{item.label.slice(0, 1)}</span>
          <span className="timeline-step-copy">
            <strong>{item.label}</strong>
            <small>{item.role}</small>
          </span>
          <span className="timeline-step-progress">{item.progressLabel}</span>
        </button>
      ))}
    </section>
  )
}
