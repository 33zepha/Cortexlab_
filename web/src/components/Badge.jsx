// Pill badge. variant must stay one of the 4 INV-006-mapped meanings —
// see ui/DESIGN.md "Don't invent a 4th meaning".
const VARIANTS = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  error: 'bg-error-bg text-error',
  running: 'bg-running-bg text-running',
}

export default function Badge({ variant = 'running', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${VARIANTS[variant] || VARIANTS.running} ${className}`}
    >
      {children}
    </span>
  )
}
