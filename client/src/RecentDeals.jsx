import { useEffect, useState } from 'react'
import { apiFetch } from './api'

// pulls the deals from the api and shows the five with the latest
// closing dates, like a recent deals list. the full table lives on
// the Deals page, so this one stays short.
function money(n) {
  return '$' + Math.round(n).toLocaleString()
}

function RecentDeals() {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    apiFetch('/api/deals')
      .then((res) => res.json())
      .then((data) => {
        setDeals(data)
        setLoading(false)
      })
      .catch(() => {
        setFailed(true)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <p className="table-note">Loading deals…</p>
  }

  if (failed) {
    return (
      <p className="table-note">
        Couldn&apos;t reach the server — make sure it&apos;s running, then
        refresh this page.
      </p>
    )
  }

  if (deals.length === 0) {
    return <p className="table-note">No deals yet.</p>
  }

  const recent = [...deals]
    .sort((a, b) => b.closing_date.localeCompare(a.closing_date))
    .slice(0, 5)

  return (
    <div className="recent-deals">
      {recent.map((deal) => (
        <div className="recent-row" key={deal.id}>
          <span className="recent-address">{deal.address}</span>
          <span className="recent-status">
            {deal.status.charAt(0).toUpperCase() + deal.status.slice(1)}
          </span>
          <span className="recent-price">{money(deal.price)}</span>
        </div>
      ))}
    </div>
  )
}

export default RecentDeals
