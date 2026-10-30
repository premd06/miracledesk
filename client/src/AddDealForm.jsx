import { useEffect, useState } from 'react'

// a form for adding a deal. posts to the api, and when it works it
// tells the page (through onAdded) so the table refreshes and the new
// deal shows up with its math done. if something's off, the server's
// error message shows under the form.
function AddDealForm({ onAdded }) {
  const [agents, setAgents] = useState([])
  const [agentId, setAgentId] = useState('')
  const [address, setAddress] = useState('')
  const [price, setPrice] = useState('')
  const [commissionPct, setCommissionPct] = useState('2.5')
  const [side, setSide] = useState('buyer')
  const [closingDate, setClosingDate] = useState('')
  const [status, setStatus] = useState('pending')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/agents')
      .then((res) => res.json())
      .then((data) => {
        setAgents(data)
        if (data.length > 0) {
          setAgentId(String(data[0].id))
        }
      })
      .catch(() => {})
  }, [])

  function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaved(false)

    fetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: Number(agentId),
        address,
        price: Number(price),
        commission_pct: Number(commissionPct),
        side,
        closing_date: closingDate || null,
        status,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'could not save the deal')
        }
        return res.json()
      })
      .then(() => {
        setSaved(true)
        setAddress('')
        setPrice('')
        setClosingDate('')
        onAdded()
      })
      .catch((err) => setError(err.message))
  }

  return (
    <form className="deal-form" onSubmit={handleSubmit}>
      <h2>Add a deal</h2>

      <label>
        Agent
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          required
        >
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Address
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. 12 Maple Grove Cres, Brampton"
          required
        />
      </label>

      <label>
        Price
        <input
          type="number"
          min="1"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. 925000"
          required
        />
      </label>

      <label>
        Commission %
        <input
          type="number"
          step="0.1"
          min="0.1"
          value={commissionPct}
          onChange={(e) => setCommissionPct(e.target.value)}
          required
        />
      </label>

      <label>
        Side
        <select value={side} onChange={(e) => setSide(e.target.value)}>
          <option value="buyer">Buyer</option>
          <option value="seller">Seller</option>
        </select>
      </label>

      <label>
        Closing date
        <input
          type="date"
          value={closingDate}
          onChange={(e) => setClosingDate(e.target.value)}
        />
      </label>

      <label>
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Pending</option>
          <option value="conditional">Conditional</option>
          <option value="closed">Closed</option>
        </select>
      </label>

      <button type="submit">Save deal</button>

      {error && <p className="form-error">{error}</p>}
      {saved && <p className="form-saved">Deal saved — it&apos;s in the table below.</p>}
    </form>
  )
}

export default AddDealForm
