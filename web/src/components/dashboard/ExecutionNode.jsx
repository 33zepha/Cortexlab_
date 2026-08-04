export default function ExecutionNode({ item, state, active, onSelect }) {
  return (
    <button
      type="button"
      className={`reference-node state-${state}${active ? ' is-active' : ''}`}
      style={{ left: `${item.x}%`, top: `${item.y}%` }}
      onClick={() => onSelect(item)}
    >
      <span className="reference-node-icon">{item.label.slice(0, 1)}</span>
      <span className="reference-node-copy"><strong>{item.label}</strong><small>{item.role}</small></span>
      <span className="reference-node-progress"><i />{state === 'done' ? '100%' : state === 'waiting' ? 'En attente' : state === 'queued' ? '40%' : '80%'}</span>
    </button>
  )
}
