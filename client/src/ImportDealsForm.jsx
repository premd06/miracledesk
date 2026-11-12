import { useEffect, useState } from 'react'
import { apiFetch } from './api'

// import deals from a csv file — for offices moving off a
// spreadsheet. pick a file, pick whose deals they are, and the
// server adds the good rows and reports back the ones it skipped
// and why, so the file can be fixed and tried again. the columns
// it wants are: address, price, commission %, side, status,
// closing date, city (optional). an agent only ever sees
// themselves in the dropdown — the broker sees everyone.
function ImportDealsForm({ onAdded }) {
  const [agents, setAgents] = useState([])
  const [agentId, setAgentId] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileText, setFileText] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    apiFetch('/api/agents')
      .then((res) => res.json())
      .then((data) => {
        setAgents(data)
        if (data.length > 0) {
          setAgentId(String(data[0].id))
        }
      })
      .catch(() => {})
  }, [])

  function handleFile(event) {
    const file = event.target.files && event.target.files[0]
    if (!file) {
      return
    }
    setFileName(file.name)
    setError('')
    setResult(null)
    const reader = new FileReader()
    reader.onload = () => setFileText(String(reader.result || ''))
    reader.onerror = () => setError('could not read that file')
    reader.readAsText(file)
  }

  function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setResult(null)

    apiFetch('/api/deals/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: fileText, agent_id: Number(agentId) }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.error || 'could not import the file')
        }
        return data
      })
      .then((data) => {
        setResult(data)
        if (data.imported.length > 0) {
          onAdded()
        }
      })
      .catch((err) => setError(err.message))
  }

  return (
    <form className="deal-form" onSubmit={handleSubmit}>
      <h2>Import deals from a CSV</h2>
      <p className="table-note">
        Columns: address, price, commission %, side, status, closing
        date, city (optional). The first row is the header — a row
        with a problem is skipped, not the whole file.
      </p>

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
        CSV file
        <input type="file" accept=".csv" onChange={handleFile} required />
      </label>
      {fileName && <p className="table-note">Picked: {fileName}</p>}

      <button type="submit">Import deals</button>

      {error && <p className="form-error">{error}</p>}
      {result && (
        <div>
          <p className="form-saved">
            Imported {result.imported.length}{' '}
            {result.imported.length === 1 ? 'deal' : 'deals'}
            {result.skipped.length > 0 &&
              ` — skipped ${result.skipped.length}`}
          </p>
          {result.skipped.map((row) => (
            <p key={row.row} className="form-error">
              Row {row.row}: {row.reason}
            </p>
          ))}
        </div>
      )}
    </form>
  )
}

export default ImportDealsForm
