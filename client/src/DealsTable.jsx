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
// an open row also has edit + delete: edit opens a small form right
// there in the row, delete asks first, then removes the deal.
function DealsTable({ refreshKey }) {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [openDeal, setOpenDeal] = useState(null)
  const [checklist, setChecklist] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [editAddress, setEditAddress] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCommissionPct, setEditCommissionPct] = useState('')
  const [editSide, setEditSide] = useState('buyer')
  const [editStatus, setEditStatus] = useState('pending')
  const [editClosingDate, setEditClosingDate] = useState('')
  const [editError, setEditError] = useState('')

  function loadDeals() {
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
  }

  // start editing a deal: fill the form with what the deal has now.
  function startEdit(deal) {
    setEditAddress(deal.address)
    setEditPrice(String(deal.price))
    setEditCommissionPct(String(deal.commission_pct))
    setEditSide(deal.side)
    setEditStatus(deal.status)
    setEditClosingDate(deal.closing_date || '')
    setEditError('')
    setEditing(deal.id)
  }

  function saveEdit(deal) {
    setEditError('')
    apiFetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: editAddress,
        price: Number(editPrice),
        commission_pct: Number(editCommissionPct),
        side: editSide,
        status: editStatus,
        closing_date: editClosingDate || null,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'could not save the changes')
        }
        return res.json()
      })
      .then(() => {
        setEditing(null)
        loadDeals()
      })
      .catch((err) => setEditError(err.message))
  }

  // delete asks first — there's no undo, so the browser's confirm
  // box is the safety net.
  function deleteDeal(deal) {
    if (
      !window.confirm(
        `Delete the deal at ${deal.address}? This can't be undone.`
      )
    ) {
      return
    }
    apiFetch(`/api/deals/${deal.id}`, { method: 'DELETE' })
      .then((res) => {
        if (!res.ok) {
          throw new Error('could not delete the deal')
        }
        setOpenDeal(null)
        setEditing(null)
        loadDeals()
      })
      .catch(() => setEditError('could not delete the deal'))
  }

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

  useEffect(loadDeals, [refreshKey])

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
                  {editing === deal.id ? (
                    <form
                      className="edit-form"
                      onSubmit={(e) => {
                        e.preventDefault()
                        saveEdit(deal)
                      }}
                    >
                      <label>
                        Address
                        <input
                          type="text"
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Price
                        <input
                          type="number"
                          min="1"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Commission %
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={editCommissionPct}
                          onChange={(e) =>
                            setEditCommissionPct(e.target.value)
                          }
                          required
                        />
                      </label>
                      <label>
                        Side
                        <select
                          value={editSide}
                          onChange={(e) => setEditSide(e.target.value)}
                        >
                          <option value="buyer">Buyer</option>
                          <option value="seller">Seller</option>
                        </select>
                      </label>
                      <label>
                        Closing date
                        <input
                          type="date"
                          value={editClosingDate}
                          onChange={(e) =>
                            setEditClosingDate(e.target.value)
                          }
                        />
                      </label>
                      <label>
                        Status
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                        >
                          <option value="pending">Pending</option>
                          <option value="conditional">Conditional</option>
                          <option value="closed">Closed</option>
                        </select>
                      </label>
                      <button type="submit">Save changes</button>
                      <button type="button" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                      {editError && (
                        <p className="form-error">{editError}</p>
                      )}
                    </form>
                  ) : (
                    <div className="row-actions">
                      <button type="button" onClick={() => startEdit(deal)}>
                        Edit deal
                      </button>
                      <button
                        type="button"
                        className="delete-button"
                        onClick={() => deleteDeal(deal)}
                      >
                        Delete deal
                      </button>
                      {editError && (
                        <p className="form-error">{editError}</p>
                      )}
                    </div>
                  )}
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
