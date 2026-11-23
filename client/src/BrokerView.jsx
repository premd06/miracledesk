import { useEffect, useState } from 'react'
import { apiFetch } from './api'
import PulseFeed from './PulseFeed'
import AuditTrail from './AuditTrail'

// the broker's office page: office totals, every agent ranked by net,
// and what's closing this month. pulls from the leaderboard, summary
// and deals endpoints — same pattern as the other pages.
function money(n) {
  return '$' + Math.round(n).toLocaleString()
}

function BrokerView({ user }) {
  const [leaders, setLeaders] = useState(null)
  const [summary, setSummary] = useState(null)
  const [deals, setDeals] = useState(null)
  const [failed, setFailed] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [exportError, setExportError] = useState(false)

  useEffect(() => {
    Promise.all([
      apiFetch('/api/leaderboard').then((res) => res.json()),
      apiFetch('/api/summary').then((res) => res.json()),
      apiFetch('/api/deals').then((res) => res.json()),
    ])
      .then(([leaderData, summaryData, dealData]) => {
        setLeaders(leaderData)
        setSummary(summaryData)
        setDeals(dealData)
      })
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

  if (!leaders || !summary || !deals) {
    return <p className="table-note">Loading office numbers…</p>
  }

  // deals closing in the current month, whatever their status.
  // a deal with no closing date yet just isn't in this list.
  const now = new Date()
  const thisMonth =
    now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
  const closingThisMonth = deals.filter(
    (deal) => deal.closing_date && deal.closing_date.startsWith(thisMonth)
  )

  // the export link: blank dates mean the whole list, same as the api.
  const exportParams = new URLSearchParams()
  if (from) exportParams.set('from', from)
  if (to) exportParams.set('to', to)
  const exportQuery = exportParams.toString()

  // the download goes through apiFetch (not a plain link) so the
  // login token rides along — a plain <a href> just gets a 401 now
  // that the api needs a login. same trick as the backup button.
  function downloadExport() {
    setExportError(false)
    apiFetch(
      '/api/export/payperiod' + (exportQuery ? '?' + exportQuery : '')
    )
      .then((res) => {
        if (!res.ok) {
          throw new Error('export failed')
        }
        const name =
          res.headers
            .get('Content-Disposition')
            ?.match(/filename="([^"]+)"/)?.[1] || 'payperiod.csv'
        return res.blob().then((blob) => ({ blob, name }))
      })
      .then(({ blob, name }) => {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = name
        link.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => setExportError(true))
  }

  return (
    <>
      <section className="cards">
        <div className="card">
          <p className="card-label">Office net this year</p>
          <p className="card-value">{money(summary.netThisYear)}</p>
          <p className="card-note">
            from {summary.closedThisYearCount} closed deals
          </p>
        </div>
        <div className="card">
          <p className="card-label">Deals this year</p>
          <p className="card-value">{summary.dealCount}</p>
          <p className="card-note">
            {summary.closedThisYearCount} closed this year
          </p>
        </div>
        <div className="card">
          <p className="card-label">Agents</p>
          <p className="card-value">{leaders.length}</p>
          <p className="card-note">on the leaderboard</p>
        </div>
      </section>

      <section className="deals-section">
        <p className="section-label">Pay-period export</p>
        <p className="table-note">
          Pick a closing-date range (or leave both blank for everything)
          and download it as a spreadsheet.
        </p>
        <div className="export-row">
          <label>
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button type="button" onClick={downloadExport}>
            Download CSV
          </button>
        </div>
        {exportError && (
          <p className="table-note">
            The export didn&apos;t download — try again in a minute.
          </p>
        )}
      </section>

      <section className="deals-section">
        <p className="section-label">Leaderboard</p>
        <div className="recent-deals">
          {leaders.map((agent, i) => (
            <div className="recent-row" key={agent.id}>
              <span className="recent-status">{i + 1}</span>
              <span className="recent-address">{agent.name}</span>
              <span className="recent-status">
                {agent.closedThisYearCount} closed
              </span>
              <span className="recent-price">
                {money(agent.netThisYear)}
              </span>
              <span className="recent-status">
                of {money(agent.goal)} goal · {agent.goalProgress}%
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="deals-section">
        <p className="section-label">Office pulse</p>
        <PulseFeed />
      </section>

      <section className="deals-section">
        <p className="section-label">Closing this month</p>
        {closingThisMonth.length === 0 ? (
          <p className="table-note">Nothing closing this month.</p>
        ) : (
          <div className="recent-deals">
            {closingThisMonth.map((deal) => (
              <div className="recent-row" key={deal.id}>
                <span className="recent-address">{deal.address}</span>
                <span className="recent-status">
                  {deal.status.charAt(0).toUpperCase() +
                    deal.status.slice(1)}
                </span>
                <span className="recent-price">
                  ${deal.price.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {user && user.role === 'broker' && (
        <section className="deals-section">
          <p className="section-label">Audit trail</p>
          <AuditTrail />
        </section>
      )}
    </>
  )
}

export default BrokerView
