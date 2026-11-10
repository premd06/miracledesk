import { Fragment, useEffect, useState } from 'react'
import { apiFetch } from './api'

// pulls the deals from the api and shows them as a table.
// if the server isn't running, it says so plainly instead of
// showing an empty table and leaving you guessing.
// refreshKey changes when a new deal is added, so the table reloads.
// clicking a row opens it up to show that deal's closing checklist,
// with tickable boxes that save straight to the server.
// the search box filters by address or agent, and the status
// dropdown narrows it to pending, conditional or closed deals.
function DealsTable({ refreshKey }) {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [openDeal, setOpenDeal] = useState(null)
  const [checklist, setChecklist] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  function toggleDeal(deal) {
    if (openDeal === deal.id) {
      setOpenDeal(null)
      return
    }
    setOpenDeal(deal.id)
    apiFetch(`/api/deals/${deal.id}/checklist`)
      .then((res) => res.json())
      .then((data) => setChecklist(data))
      .catch(() => setChecklist([]))
  }

  function toggleItem(item) {
    apiFetch(`/api/deals/${openDeal}/checklist/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !item.done }),
    })
      .then((res) => res.json())
      .then((updated) => {
        setChecklist(
          checklist.map((row) => (row.id === updated.id ? updated : row))
        )
      })
  }

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

  const query = search.trim().toLowerCase()
  const shown = deals.filter((deal) => {
    if (statusFilter !== 'all' && deal.status !== statusFilter) {
      return false
    }
    if (!query) {
      return true
    }
    return (
      deal.address.toLowerCase().includes(query) ||
      (deal.agent_name || '').toLowerCase().includes(query)
    )
  })

  return (
    <>
      <div className="table-filters">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by address or agent…"
          aria-label="Search deals"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="conditional">Conditional</option>
          <option value="closed">Closed</option>
        </select>
        <span className="table-count">
          Showing {shown.length} of {deals.length}{' '}
          {deals.length === 1 ? 'deal' : 'deals'}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="table-note">
          No deals match that search — try a different address, agent or
          status.
        </p>
      ) : (
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
        {shown.map((deal) => (
          <Fragment key={deal.id}>
            <tr
              className="deal-row"
              onClick={() => toggleDeal(deal)}
            >
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
            {openDeal === deal.id && (
              <tr className="checklist-row">
                <td colSpan="7">
                  <p className="checklist-title">
                    Closing checklist — click a deal row to close this
                  </p>
                  {checklist.map((item) => (
                    <label key={item.id} className="checklist-item">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggleItem(item)}
                      />
                      {item.label}
                    </label>
                  ))}
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
        </table>
      )}
    </>
  )
}

export default DealsTable
