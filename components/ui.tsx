'use client'

export function Badge({ label, tone = 'tone-gray' }: { label: string; tone?: string }) {
  return <span className={`badge ${tone}`}>{label}</span>
}

export function BarChart({ data, total }: { data: Record<string, number>; total: number }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 12)
  if (!entries.length) return <div className="empty">Sem dados para exibir.</div>
  return (
    <>
      {entries.map(([label, value]) => {
        const pct = total ? Math.round(value / total * 100) : 0
        return (
          <div className="bar-row" key={label}>
            <div className="bar-label" title={label}>{label}</div>
            <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
            <div className="bar-value">{value}</div>
          </div>
        )
      })}
    </>
  )
}
