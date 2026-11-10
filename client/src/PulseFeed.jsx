import { useEffect, useState } from 'react'
import { apiFetch } from './api'

// the office pulse feed in the broker view: what the office has
// actually been doing lately — deals that closed, and deals closing
// soon. newest first, ten at most.
function PulseFeed() {
  const [feed, setFeed] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    apiFetch('/api/feed')
      .then((res) => res.json())
      .then((data) => setFeed(data))
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

  if (!feed) {
    return <p className="table-note">Loading the pulse…</p>
  }

  if (feed.length === 0) {
    return <p className="table-note">Nothing happening yet.</p>
  }

  return (
    <div className="recent-deals">
      {feed.map((event, i) => (
        <div className="recent-row" key={i}>
          <span className="recent-status">{event.date}</span>
          <span className="recent-address">{event.text}</span>
          <span className="recent-status">{event.kind}</span>
        </div>
      ))}
    </div>
  )
}

export default PulseFeed
