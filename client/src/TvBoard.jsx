import { useEffect, useState } from 'react'
import './App.css'

// the office TV board — open it at /tv and leave it on the screen in
// the office. big type so it reads from across the room, and it
// reloads the numbers itself every minute so nobody has to touch it.
function money(n) {
  return '$' + Math.round(n).toLocaleString()
}

function TvBoard() {
  const [leaders, setLeaders] = useState(null)
  const [summary, setSummary] = useState(null)
  const [failed, setFailed] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)

  // one function for loading, so the first load and the timer below
  // both just call the same thing.
  function load() {
    Promise.all([
      fetch('/api/leaderboard').then((res) => res.json()),
      fetch('/api/summary').then((res) => res.json()),
    ])
      .then(([leaderData, summaryData]) => {
        setLeaders(leaderData)
        setSummary(summaryData)
        setFailed(false)
        setUpdatedAt(new Date())
      })
      .catch(() => setFailed(true))
  }

  useEffect(() => {
    load()
    // refresh every minute — that's the whole point of a TV board.
    const timer = setInterval(load, 60 * 1000)
    return () => clearInterval(timer)
  }, [])

  if (failed) {
    return (
      <div className="tv">
        <p className="tv-error">
          Couldn&apos;t reach the server — make sure it&apos;s running, then
          this page will pick the numbers back up on its own.
        </p>
      </div>
    )
  }

  if (!leaders || !summary) {
    return (
      <div className="tv">
        <p className="tv-loading">Loading office numbers…</p>
      </div>
    )
  }

  const updatedText = updatedAt
    ? updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : ''

  return (
    <div className="tv">
      <header className="tv-header">
        <p className="tv-title">MiracleDesk — office leaderboard</p>
        <p className="tv-office-net">
          <span className="tv-label">Office net this year</span>
          {money(summary.netThisYear)}
        </p>
      </header>

      <ol className="tv-list">
        {leaders.map((agent, i) => (
          <li className="tv-row" key={agent.id}>
            <span className="tv-rank">{i + 1}</span>
            <span className="tv-name">{agent.name}</span>
            <span className="tv-closed">
              {agent.closedThisYearCount} closed
            </span>
            <span className="tv-net">{money(agent.netThisYear)}</span>
          </li>
        ))}
      </ol>

      <footer className="tv-footer">
        <span>Sample data</span>
        <span>
          Updated {updatedText} · refreshes every minute
        </span>
      </footer>
    </div>
  )
}

export default TvBoard
