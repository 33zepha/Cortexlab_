export default function Card({ className = '', children, ...props }) {
  return (
    <div
      className={`bg-surface rounded-lg border border-border shadow-card p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
