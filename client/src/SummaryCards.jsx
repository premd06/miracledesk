import { useEffect, useState } from 'react'

// pulls the totals from /api/summary and shows them as cards.
// same idea as the deals table: if the server isn't running,
// it says so instead of showing made-up numbers.
function money(n) {
  return '$' + Math.round(n).toLocaleString()
}

function SummaryCards() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/summary')
      .then((res) => res.json())
      .then((data) => {
        setSummary(data)
        setLoading(false)
      })
      .catch(() => {
        setFailed(true)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <p className="table-note">Loading totals…</p>
  }

  if (failed) {
    return (
      <p className="table-note">
        Couldn&apos;t reach the server — make sure it&apos;s running, then
        refresh this page.
      </p>
    )
  }

  // the bar shouldn't run past the end even if the goal is beaten
  const barWidth = Math.min(summary.goalProgress, 100)

  const cards = [
    {
      label: 'Net earned this year',
      value: money(summary.netThisYear),
      note: 'from ' + summary.closedThisYearCount + ' closed deals',
    },
    {
      label: 'Closing soon',
      value: money(summary.closingSoonNet),
      note: summary.closingSoonCount + ' deals in the next 45 days',
    },
    {
      label: 'Deals this year',
      value: String(summary.dealCount),
      note: summary.closedThisYearCount + ' closed this year',
    },
    {
      label: 'Goal progress',
      value: summary.goalProgress + '%',
      note: money(summary.netThisYear) + ' of a ' + money(summary.goal) + ' goal',
    },
  ]

  return (
    <section className="cards">
      {cards.map((card) => (
        <div className="card" key={card.label}>
          <p className="card-label">{card.label}</p>
          <p className="card-value">{card.value}</p>
          <p className="card-note">{card.note}</p>
          {card.label === 'Goal progress' && (
            <div className="goal-bar">
              <div className="goal-fill" style={{ width: barWidth + '%' }} />
            </div>
          )}
        </div>
      ))}
    </section>
  )
}

export default SummaryCards
