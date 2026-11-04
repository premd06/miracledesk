import { useEffect, useState } from 'react'

// the follow-up nudges on the dashboard: clients I haven't talked to
// in 14+ days, and closing anniversaries coming up in the next month.
// quiet clients are how deals slip away, so this sits right on the
// dashboard where I can't miss it.
function NudgesPanel() {
  const [nudges, setNudges] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/nudges')
      .then((res) => res.json())
      .then((data) => setNudges(data))
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

  if (!nudges) {
    return <p className="table-note">Loading follow-ups…</p>
  }

  if (nudges.stale.length === 0 && nudges.anniversaries.length === 0) {
    return <p className="table-note">All caught up — nobody to follow up with.</p>
  }

  return (
    <div>
      {nudges.stale.map((client) => (
        <div className="recent-row" key={`stale-${client.id}`}>
          <p className="recent-address">
            {client.name} ({client.agent_name}) —{' '}
            {client.daysSinceContact === null
              ? 'never contacted'
              : `last talked to ${client.daysSinceContact} days ago`}
          </p>
          <p className="recent-status">follow up</p>
        </div>
      ))}

      {nudges.anniversaries.map((deal) => (
        <div className="recent-row" key={`anniversary-${deal.id}`}>
          <p className="recent-address">
            {deal.address} ({deal.agent_name}) — {deal.years}-year closing
            anniversary on {deal.anniversaryDate}
          </p>
          <p className="recent-status">send a text</p>
        </div>
      ))}
    </div>
  )
}

export default NudgesPanel
