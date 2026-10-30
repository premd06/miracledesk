import { useEffect, useState } from 'react'

// pulls the deals from the api and shows them as a table.
// if the server isn't running, it says so plainly instead of
// showing an empty table and leaving you guessing.
// refreshKey changes when a new deal is added, so the table reloads.
function DealsTable({ refreshKey }) {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/deals')
      .then((res) => res.json())
      .then((data) => {
        setDeals(data)
        setLoading(false)
      })
      .catch(() => {
        setFailed(true)
        setLoading(false)
      })
  }, [refreshKey])

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

  return (
    <table className="deals-table">
      <thead>
        <tr>
          <th>Address</th>
          <th>Price</th>
          <th>Side</th>
          <th>Gross</th>
          <th>Net</th>
          <th>Status</th>
          <th>Closing date</th>
        </tr>
      </thead>
      <tbody>
        {deals.map((deal) => (
          <tr key={deal.id}>
            <td>{deal.address}</td>
            <td>${deal.price.toLocaleString()}</td>
            <td>{deal.side}</td>
            <td>${deal.gross.toLocaleString()}</td>
            <td>${deal.net.toLocaleString()}</td>
            <td>
              <span className={`status status-${deal.status}`}>
                {deal.status}
              </span>
            </td>
            <td>{deal.closing_date}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default DealsTable
