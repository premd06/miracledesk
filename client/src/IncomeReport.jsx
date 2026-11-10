import { useEffect, useState } from 'react'
import { apiFetch } from './api'

// a printable income report for one agent — pick who, then open it in
// a new tab and print to pdf from the browser. banks ask for these
// when an agent applies for a mortgage or a loan.
//
// the report opens through a fetch, not a plain link, because a link
// can't send the login token — without it the server would just
// answer 401. an agent can only open their own report; the broker
// can open anyone's.
function IncomeReport() {
  const [agents, setAgents] = useState(null)
  const [agentId, setAgentId] = useState('')
  const [failed, setFailed] = useState(false)
  const [reportError, setReportError] = useState('')

  useEffect(() => {
    apiFetch('/api/agents')
      .then((res) => res.json())
      .then((data) => {
        setAgents(data)
        if (data.length > 0) setAgentId(String(data[0].id))
      })
      .catch(() => setFailed(true))
  }, [])

  function openReport() {
    setReportError('')
    apiFetch(`/api/report/income?agentId=${agentId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'could not open the report')
        }
        return res.text()
      })
      .then((html) => {
        const win = window.open('', '_blank')
        if (!win) {
          throw new Error(
            'the browser blocked the new tab — allow pop-ups for this site and try again'
          )
        }
        win.document.write(html)
        win.document.close()
      })
      .catch((err) => setReportError(err.message))
  }

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
        <button type="button" onClick={openReport}>
          Open income report
        </button>
      </div>
      {reportError && <p className="form-error">{reportError}</p>}
    </>
  )
}

export default IncomeReport
