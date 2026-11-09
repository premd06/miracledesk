import { useEffect, useState } from 'react'

// a printable income report for one agent — pick who, then open it in
// a new tab and print to pdf from the browser. banks ask for these
// when an agent applies for a mortgage or a loan.
function IncomeReport() {
  const [agents, setAgents] = useState(null)
  const [agentId, setAgentId] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/agents')
      .then((res) => res.json())
      .then((data) => {
        setAgents(data)
        if (data.length > 0) setAgentId(String(data[0].id))
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

  if (!agents) {
    return <p className="table-note">Loading agents…</p>
  }

  return (
    <>
      <p className="table-note">
        A clean earnings summary for one agent — pick who, open it, then
        print to PDF from the browser.
      </p>
      <div className="export-row">
        <label>
          Agent
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
        <a
          href={`/api/report/income?agentId=${agentId}`}
          target="_blank"
          rel="noreferrer"
        >
          Open income report
        </a>
      </div>
    </>
  )
}

export default IncomeReport
