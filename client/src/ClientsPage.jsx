import { useEffect, useState } from 'react'

// the clients page: a table of every agent's buyers and sellers, plus
// a form to add one. if the server isn't running it says so plainly,
// same as the deals table does.
function ClientsPage() {
  const [clients, setClients] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [agentId, setAgentId] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('buyer')
  const [status, setStatus] = useState('active')
  const [lastContacted, setLastContacted] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function loadClients() {
    fetch('/api/clients')
      .then((res) => res.json())
      .then((data) => {
        setClients(data)
        setLoading(false)
      })
      .catch(() => {
        setFailed(true)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadClients()
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

    fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: Number(agentId),
        name,
        type,
        status,
        last_contacted: lastContacted || null,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'could not save the client')
        }
        return res.json()
      })
      .then(() => {
        setSaved(true)
        setName('')
        setLastContacted('')
        loadClients()
      })
      .catch((err) => setError(err.message))
  }

  return (
    <>
      <form className="deal-form" onSubmit={handleSubmit}>
        <h2>Add a client</h2>

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
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Maya Chen"
            required
          />
        </label>

        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
          </select>
        </label>

        <label>
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="active">Active</option>
            <option value="lead">Lead</option>
            <option value="past">Past</option>
          </select>
        </label>

        <label>
          Last contacted
          <input
            type="date"
            value={lastContacted}
            onChange={(e) => setLastContacted(e.target.value)}
          />
        </label>

        <button type="submit">Save client</button>

        {error && <p className="form-error">{error}</p>}
        {saved && (
          <p className="form-saved">
            Client saved — it&apos;s in the table below.
          </p>
        )}
      </form>

      <section className="deals-section">
        {loading && <p className="table-note">Loading clients…</p>}

        {failed && (
          <p className="table-note">
            Couldn&apos;t reach the server — make sure it&apos;s running,
            then refresh this page.
          </p>
        )}

        {!loading && !failed && clients.length === 0 && (
          <p className="table-note">No clients yet.</p>
        )}

        {!loading && !failed && clients.length > 0 && (
          <table className="deals-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Agent</th>
                <th>Type</th>
                <th>Status</th>
                <th>Last contacted</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td>{client.name}</td>
                  <td>{client.agent_name}</td>
                  <td>{client.type}</td>
                  <td>
                    <span className={`status status-${client.status}`}>
                      {client.status}
                    </span>
                  </td>
                  <td>{client.last_contacted || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}

export default ClientsPage
