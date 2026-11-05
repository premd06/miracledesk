import { useEffect, useState } from 'react'

// the badges row on the dashboard: one line per agent, three badges
// each. earned badges are filled in, the ones nobody has hit yet stay
// greyed out with what they still take — that's what makes people
// chase them.
function BadgesRow() {
  const [rows, setRows] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/badges')
      .then((res) => res.json())
      .then((data) => setRows(data))
      .catch(() => setFailed(true))
  }, [])

  if (failed) {
    return (
      <p className="table-note">
        Couldn&apos;t reach the server — make sure it&apos;s running, then
        refresh this page.
      </p>
    )
  }

  if (!rows) {
    return <p className="table-note">Loading badges…</p>
  }

  return (
    <div>
      {rows.map((row) => (
        <div className="badge-row" key={row.id}>
          <p className="recent-address">{row.name}</p>
          <div className="badges">
            {row.badges.map((badge) => (
              <span
                key={badge.id}
                className={badge.earned ? 'badge earned' : 'badge locked'}
                title={badge.detail}
              >
                {badge.label}
                <span className="badge-detail">{badge.detail}</span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default BadgesRow
