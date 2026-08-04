import Card from './Card.jsx'

export default function KpiCard({ label, value }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</span>
      <span className="text-2xl font-bold">{value}</span>
    </Card>
  )
}
